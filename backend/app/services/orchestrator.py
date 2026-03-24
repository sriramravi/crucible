"""
OrchestratorService — manages Docker container lifecycle for all lab modules.
Each method handles one module's spin-up/tear-down logic.
"""
import asyncio
import logging
from typing import Optional, Dict, Any
import docker
from docker.errors import NotFound, APIError
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _docker_client() -> docker.DockerClient:
    return docker.DockerClient(base_url=settings.DOCKER_SOCKET)


class OrchestratorService:

    # ─── Generic container helpers ───────────────────────────────────────────

    @staticmethod
    def _container_name(prefix: str, user_id: int, module_id: int) -> str:
        return f"{settings.CONTAINER_PREFIX}{prefix}_u{user_id}_m{module_id}"

    @staticmethod
    async def stop_container(container_name: str) -> bool:
        """Stop and remove a container by name."""
        def _stop():
            client = _docker_client()
            try:
                c = client.containers.get(container_name)
                c.stop(timeout=10)
                c.remove(force=True)
                return True
            except NotFound:
                return True
            except APIError as e:
                logger.error(f"Error stopping container {container_name}: {e}")
                return False

        return await asyncio.to_thread(_stop)

    @staticmethod
    async def get_container_status(container_name: str) -> str:
        def _status():
            client = _docker_client()
            try:
                c = client.containers.get(container_name)
                return c.status
            except NotFound:
                return "not_found"

        return await asyncio.to_thread(_status)

    @staticmethod
    async def exec_in_container(container_name: str, command: str) -> tuple[int, str]:
        """Run a command inside a running container, return (exit_code, output)."""
        def _exec():
            client = _docker_client()
            try:
                c = client.containers.get(container_name)
                result = c.exec_run(command, stdout=True, stderr=True)
                return result.exit_code, result.output.decode("utf-8", errors="replace")
            except NotFound:
                return 1, "Container not found"
            except APIError as e:
                return 1, str(e)

        return await asyncio.to_thread(_exec)

    # ─── Module 1: Version Control (Gitea) ───────────────────────────────────

    @staticmethod
    async def setup_gitea_user(username: str, password: str, email: str) -> Optional[str]:
        """Create Gitea user and return API token."""
        async with httpx.AsyncClient(timeout=30) as client:
            # Create user via admin API
            resp = await client.post(
                f"{settings.GITEA_URL}/api/v1/admin/users",
                json={
                    "username": username,
                    "password": password,
                    "email": email,
                    "must_change_password": False,
                    "send_notify": False,
                },
                headers={"Authorization": f"token {settings.GITEA_ADMIN_TOKEN}"},
            )
            if resp.status_code not in (201, 422):  # 422 = already exists
                logger.error(f"Failed to create Gitea user: {resp.text}")
                return None

            # Generate API token
            token_resp = await client.post(
                f"{settings.GITEA_URL}/api/v1/users/{username}/tokens",
                json={"name": "crucible-token"},
                auth=(settings.GITEA_ADMIN_USER, settings.GITEA_ADMIN_TOKEN),
            )
            if token_resp.status_code == 201:
                return token_resp.json().get("sha1")
            # Token may already exist, try to list
            list_resp = await client.get(
                f"{settings.GITEA_URL}/api/v1/users/{username}/tokens",
                auth=(settings.GITEA_ADMIN_USER, settings.GITEA_ADMIN_TOKEN),
            )
            if list_resp.status_code == 200 and list_resp.json():
                # Delete and recreate
                token_name = list_resp.json()[0]["name"]
                await client.delete(
                    f"{settings.GITEA_URL}/api/v1/users/{username}/tokens/{token_name}",
                    auth=(settings.GITEA_ADMIN_USER, settings.GITEA_ADMIN_TOKEN),
                )
                retry = await client.post(
                    f"{settings.GITEA_URL}/api/v1/users/{username}/tokens",
                    json={"name": "crucible-token"},
                    auth=(settings.GITEA_ADMIN_USER, settings.GITEA_ADMIN_TOKEN),
                )
                if retry.status_code == 201:
                    return retry.json().get("sha1")
            return None

    @staticmethod
    async def create_module1_repo(username: str, user_token: str) -> Dict[str, Any]:
        """Create starter repo for module 1 via Gitea API."""
        repo_name = "devsecops-lab"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.GITEA_URL}/api/v1/user/repos",
                json={
                    "name": repo_name,
                    "description": "Crucible - Version Control Module",
                    "private": False,
                    "auto_init": True,
                    "default_branch": "main",
                    "gitignores": "Python",
                    "readme": "Default",
                },
                headers={"Authorization": f"token {user_token}"},
            )
            if resp.status_code in (201, 409):
                return {"repo_name": repo_name, "clone_url": f"{settings.GITEA_URL}/{username}/{repo_name}.git"}

            logger.error(f"Failed to create repo: {resp.text}")
            return {}

    @staticmethod
    async def validate_module1_challenge1(username: str, user_token: str) -> Dict[str, Any]:
        """Validate: branch feature/my-first-branch exists AND PR is open."""
        async with httpx.AsyncClient(timeout=30) as client:
            headers = {"Authorization": f"token {user_token}"}
            repo = "devsecops-lab"

            # Check branch
            branches_resp = await client.get(
                f"{settings.GITEA_URL}/api/v1/repos/{username}/{repo}/branches",
                headers=headers,
            )
            branches = [b["name"] for b in branches_resp.json()] if branches_resp.status_code == 200 else []
            branch_exists = "feature/my-first-branch" in branches

            # Check PR
            prs_resp = await client.get(
                f"{settings.GITEA_URL}/api/v1/repos/{username}/{repo}/pulls",
                params={"state": "open"},
                headers=headers,
            )
            pr_open = len(prs_resp.json()) > 0 if prs_resp.status_code == 200 else False

            passed = branch_exists and pr_open
            return {
                "passed": passed,
                "branch_exists": branch_exists,
                "pr_open": pr_open,
                "details": {
                    "branches": branches,
                    "open_prs": len(prs_resp.json()) if prs_resp.status_code == 200 else 0,
                },
            }

    @staticmethod
    async def validate_module1_challenge2(username: str, user_token: str) -> Dict[str, Any]:
        """Validate: .gitignore exists and contains .env pattern."""
        async with httpx.AsyncClient(timeout=30) as client:
            headers = {"Authorization": f"token {user_token}"}
            repo = "devsecops-lab"

            resp = await client.get(
                f"{settings.GITEA_URL}/api/v1/repos/{username}/{repo}/raw/.gitignore",
                headers=headers,
            )
            if resp.status_code != 200:
                return {"passed": False, "message": ".gitignore file not found in repo"}

            content = resp.text
            has_env = ".env" in content
            return {
                "passed": has_env,
                "message": ".gitignore found and contains .env pattern" if has_env else ".gitignore missing .env exclusion",
            }

    # ─── Module 2: CI/CD (Gitea Actions + Jenkins) ───────────────────────────

    @staticmethod
    async def setup_jenkins_user(username: str) -> bool:
        """Create Jenkins user folder and account via Jenkins REST API."""
        async with httpx.AsyncClient(timeout=30) as client:
            auth = (settings.JENKINS_ADMIN_USER, settings.JENKINS_ADMIN_PASSWORD)

            # Get CSRF crumb
            crumb_resp = await client.get(
                f"{settings.JENKINS_URL}/crumbIssuer/api/json", auth=auth
            )
            headers = {}
            if crumb_resp.status_code == 200:
                crumb = crumb_resp.json()
                headers[crumb["crumbRequestField"]] = crumb["crumb"]

            # Create user folder using Job DSL / folder config XML
            folder_xml = f"""<?xml version='1.1' encoding='UTF-8'?>
<com.cloudbees.hudson.plugins.folder.Folder plugin="cloudbees-folder">
  <description>Folder for user {username}</description>
  <views><hudson.model.AllView><name>All</name></hudson.model.AllView></views>
</com.cloudbees.hudson.plugins.folder.Folder>"""

            resp = await client.post(
                f"{settings.JENKINS_URL}/job/users/createItem",
                content=folder_xml,
                params={"name": username},
                headers={**headers, "Content-Type": "application/xml"},
                auth=auth,
            )
            return resp.status_code in (200, 201, 400)  # 400 = already exists

    @staticmethod
    async def validate_module2_challenge1(username: str, user_token: str) -> Dict[str, Any]:
        """Validate Gitea Actions workflow run succeeded."""
        async with httpx.AsyncClient(timeout=30) as client:
            headers = {"Authorization": f"token {user_token}"}
            resp = await client.get(
                f"{settings.GITEA_URL}/api/v1/repos/{username}/devsecops-lab/actions/runs",
                headers=headers,
            )
            if resp.status_code != 200:
                return {"passed": False, "message": "Could not fetch workflow runs"}

            runs = resp.json().get("workflow_runs", [])
            if not runs:
                return {"passed": False, "message": "No workflow runs found"}

            latest = runs[0]
            passed = latest.get("conclusion") == "success"
            return {
                "passed": passed,
                "message": f"Latest run status: {latest.get('conclusion', 'unknown')}",
                "run_id": latest.get("id"),
            }

    @staticmethod
    async def validate_module2_challenge2(username: str) -> Dict[str, Any]:
        """Validate Jenkins pipeline completed successfully."""
        async with httpx.AsyncClient(timeout=30) as client:
            auth = (settings.JENKINS_ADMIN_USER, settings.JENKINS_ADMIN_PASSWORD)
            resp = await client.get(
                f"{settings.JENKINS_URL}/job/users/job/{username}/job/devsecops-pipeline/lastBuild/api/json",
                auth=auth,
            )
            if resp.status_code != 200:
                return {"passed": False, "message": "Jenkins job not found or no builds yet"}

            build = resp.json()
            passed = build.get("result") == "SUCCESS"
            return {
                "passed": passed,
                "result": build.get("result"),
                "duration_ms": build.get("duration"),
                "message": f"Build result: {build.get('result', 'unknown')}",
            }

    # ─── Module 4: IaC (LocalStack per user) ─────────────────────────────────

    @staticmethod
    async def start_localstack(user_id: int) -> Dict[str, Any]:
        """Spin up a per-user LocalStack container."""
        name = OrchestratorService._container_name("localstack", user_id, 4)
        port = settings.LOCALSTACK_PORT_START + user_id

        def _run():
            client = _docker_client()
            try:
                client.containers.get(name)
                return {"container_name": name, "port": port, "status": "already_running"}
            except NotFound:
                pass

            c = client.containers.run(
                settings.LOCALSTACK_IMAGE,
                name=name,
                detach=True,
                environment={"SERVICES": "s3,iam,sts"},
                ports={"4566/tcp": port},
                network=settings.CONTAINER_NETWORK,
                labels={"managed_by": "crucible", "user_id": str(user_id)},
            )
            return {"container_name": name, "container_id": c.id, "port": port, "status": "started"}

        result = await asyncio.to_thread(_run)
        # Wait for LocalStack to be ready
        await asyncio.sleep(5)
        return result

    @staticmethod
    async def validate_module4_challenge1(user_id: int, bucket_name: str = "lab-bucket") -> Dict[str, Any]:
        """Validate S3 bucket exists in user's LocalStack."""
        port = settings.LOCALSTACK_PORT_START + user_id
        exit_code, output = await OrchestratorService.exec_in_container(
            OrchestratorService._container_name("localstack", user_id, 4),
            f"aws --endpoint-url=http://localhost:4566 s3 ls",
        )
        bucket_exists = bucket_name in output
        return {
            "passed": exit_code == 0 and bucket_exists,
            "bucket_found": bucket_exists,
            "output": output[:500],
        }

    @staticmethod
    async def validate_module4_challenge3_checkov(container_name: str) -> Dict[str, Any]:
        """Parse Checkov JSON output for S3 public access check."""
        exit_code, output = await OrchestratorService.exec_in_container(
            container_name,
            "checkov -d /workspace --framework terraform -o json",
        )
        import json
        try:
            report = json.loads(output)
            failed = report.get("results", {}).get("failed_checks", [])
            passed = report.get("results", {}).get("passed_checks", [])

            # Look for CKV_AWS_20 (S3 public access) - should fail before fix
            public_check_ids = {"CKV_AWS_20", "CKV_AWS_19", "CKV2_AWS_6"}
            failing_ids = {c["check_id"] for c in failed}
            bucket_public_failed = bool(public_check_ids & failing_ids)

            return {
                "passed": True,
                "checkov_ran": True,
                "failed_checks": len(failed),
                "passed_checks": len(passed),
                "bucket_public_access_flagged": bucket_public_failed,
            }
        except Exception:
            return {"passed": False, "message": "Could not parse Checkov output", "output": output[:500]}

    # ─── Module 5: Quiz (no containers) ──────────────────────────────────────

    MODULE5_QUIZ = {
        0: {"question": "Which AWS service is equivalent to Azure Blob Storage?", "options": ["S3", "EFS", "Glacier", "DynamoDB"], "answer": "S3"},
        1: {"question": "In the shared responsibility model, who is responsible for patching the hypervisor?", "options": ["Customer", "Cloud Provider", "Both", "Neither"], "answer": "Cloud Provider"},
        2: {"question": "What does IaaS stand for?", "options": ["Infrastructure as a Service", "Integration as a Service", "Internet as a Service", "Identity as a Service"], "answer": "Infrastructure as a Service"},
        3: {"question": "Which component provides geographic fault isolation in a cloud region?", "options": ["Availability Zone", "Edge Location", "VPC", "Subnet"], "answer": "Availability Zone"},
        4: {"question": "Azure IAM equivalent to AWS IAM roles for VMs is:", "options": ["Managed Identity", "Service Principal", "Azure AD User", "RBAC Role"], "answer": "Managed Identity"},
        5: {"question": "Which cloud deployment model keeps resources on-premises?", "options": ["Private Cloud", "Public Cloud", "Hybrid Cloud", "Community Cloud"], "answer": "Private Cloud"},
        6: {"question": "PaaS removes customer responsibility for:", "options": ["OS and runtime", "Application code", "Data", "User access"], "answer": "OS and runtime"},
    }

    @staticmethod
    def validate_quiz5(answers: Dict[int, str]) -> Dict[str, Any]:
        quiz = OrchestratorService.MODULE5_QUIZ
        score = 0
        correct_answers = {}
        for idx, q in quiz.items():
            correct = q["answer"]
            correct_answers[idx] = correct
            if answers.get(idx) == correct:
                score += 1
        return {
            "score": score,
            "max_score": len(quiz),
            "passed": score >= 6,
            "correct_answers": correct_answers,
        }

    # ─── Module 6: Threat Dragon ──────────────────────────────────────────────

    @staticmethod
    async def start_threat_dragon(user_id: int) -> Dict[str, Any]:
        """Spin up per-user Threat Dragon instance."""
        name = OrchestratorService._container_name("threatdragon", user_id, 6)
        port = 8070 + user_id  # unique port per user

        def _run():
            client = _docker_client()
            try:
                client.containers.get(name)
                return {"container_name": name, "port": port, "status": "already_running"}
            except NotFound:
                pass
            c = client.containers.run(
                settings.THREAT_DRAGON_IMAGE,
                name=name,
                detach=True,
                ports={"3000/tcp": port},
                environment={
                    "NODE_ENV": "production",
                    "SERVER_API_PROTOCOL": "http",
                },
                network=settings.CONTAINER_NETWORK,
                labels={"managed_by": "crucible", "user_id": str(user_id)},
            )
            return {"container_name": name, "container_id": c.id, "port": port, "status": "started"}

        return await asyncio.to_thread(_run)

    @staticmethod
    async def validate_module6_challenge1(username: str, user_token: str) -> Dict[str, Any]:
        """Parse threat model JSON from Gitea and validate STRIDE coverage."""
        import json, base64
        async with httpx.AsyncClient(timeout=30) as client:
            headers = {"Authorization": f"token {user_token}"}
            resp = await client.get(
                f"{settings.GITEA_URL}/api/v1/repos/{username}/devsecops-lab/raw/threat-model.json",
                headers=headers,
            )
            if resp.status_code != 200:
                return {"passed": False, "message": "threat-model.json not found in repo root"}

            try:
                model = resp.json()
            except Exception:
                return {"passed": False, "message": "Invalid JSON in threat-model.json"}

            # Threat Dragon JSON structure: model.detail.diagrams[].diagramJson.cells[]
            threats = []
            for diagram in model.get("detail", {}).get("diagrams", []):
                cells = diagram.get("diagramJson", {}).get("cells", [])
                for cell in cells:
                    if cell.get("type") == "tm.Threat":
                        threats.append(cell)

            stride_categories = {"S": 0, "T": 0, "R": 0, "I": 0, "D": 0, "E": 0}
            for threat in threats:
                category = threat.get("attrs", {}).get("type", {}).get("text", "")
                if category and category[0].upper() in stride_categories:
                    stride_categories[category[0].upper()] += 1

            threats_with_mitigation = sum(
                1 for t in threats
                if t.get("attrs", {}).get("description", {}).get("text", "").strip()
            )

            total_threats = len(threats)
            min_stride_coverage = all(v >= 2 for v in stride_categories.values())
            passed = total_threats >= 12 and min_stride_coverage and threats_with_mitigation >= 12

            return {
                "passed": passed,
                "total_threats": total_threats,
                "stride_coverage": stride_categories,
                "threats_with_mitigation": threats_with_mitigation,
                "message": "Threat model validated" if passed else
                           f"Need 12+ threats with STRIDE coverage (2 per category). Found {total_threats}.",
            }

    # ─── Module 7: SAST ───────────────────────────────────────────────────────

    @staticmethod
    async def validate_module7_semgrep(container_name: str, expected_rule_ids: list) -> Dict[str, Any]:
        """Run semgrep in container and check for expected rule IDs."""
        exit_code, output = await OrchestratorService.exec_in_container(
            container_name,
            "semgrep --config=auto --json /workspace/vulnerable_app",
        )
        import json
        try:
            report = json.loads(output)
            found_ids = {r["check_id"] for r in report.get("results", [])}
            missing = set(expected_rule_ids) - found_ids
            return {
                "passed": len(missing) == 0,
                "found_rule_ids": list(found_ids),
                "missing_rule_ids": list(missing),
                "total_findings": len(report.get("results", [])),
            }
        except Exception:
            return {"passed": False, "message": "Could not parse Semgrep JSON output", "output": output[:500]}

    @staticmethod
    async def validate_module7_sqli_fixed(container_name: str, sqli_rule_id: str) -> Dict[str, Any]:
        """Confirm SQL injection rule no longer fires after fix."""
        exit_code, output = await OrchestratorService.exec_in_container(
            container_name,
            "semgrep --config=auto --json /workspace/vulnerable_app",
        )
        import json
        try:
            report = json.loads(output)
            found_ids = {r["check_id"] for r in report.get("results", [])}
            still_present = sqli_rule_id in found_ids
            return {
                "passed": not still_present,
                "sqli_rule_still_present": still_present,
                "message": "SQL injection finding resolved" if not still_present else "SQL injection still detected",
            }
        except Exception:
            return {"passed": False, "message": "Parse error", "output": output[:200]}

    # ─── Module 8: DAST (ZAP per user) ───────────────────────────────────────

    @staticmethod
    async def start_zap(user_id: int) -> Dict[str, Any]:
        """Spin up per-user OWASP ZAP container."""
        name = OrchestratorService._container_name("zap", user_id, 8)
        api_port = 8090 + user_id

        def _run():
            client = _docker_client()
            try:
                client.containers.get(name)
                return {"container_name": name, "api_port": api_port, "status": "already_running"}
            except NotFound:
                pass

            c = client.containers.run(
                settings.ZAP_IMAGE,
                name=name,
                command=f"zap.sh -daemon -host 0.0.0.0 -port {api_port} -config api.addrs.addr.name=.* -config api.addrs.addr.regex=true -config api.key=crucible",
                detach=True,
                ports={f"{api_port}/tcp": api_port},
                network=settings.CONTAINER_NETWORK,
                labels={"managed_by": "crucible", "user_id": str(user_id)},
            )
            return {"container_name": name, "container_id": c.id, "api_port": api_port, "status": "started"}

        result = await asyncio.to_thread(_run)
        await asyncio.sleep(15)  # ZAP needs time to initialise
        return result

    @staticmethod
    async def run_zap_spider(user_id: int) -> Dict[str, Any]:
        api_port = 8090 + user_id
        async with httpx.AsyncClient(timeout=120) as client:
            # Start spider
            resp = await client.get(
                f"http://localhost:{api_port}/JSON/spider/action/scan/",
                params={"url": settings.JUICE_SHOP_URL, "apikey": "crucible"},
            )
            if resp.status_code != 200:
                return {"passed": False, "message": "ZAP spider failed to start"}

            scan_id = resp.json().get("scan", "0")

            # Poll until complete
            for _ in range(60):
                await asyncio.sleep(5)
                status_resp = await client.get(
                    f"http://localhost:{api_port}/JSON/spider/view/status/",
                    params={"scanId": scan_id, "apikey": "crucible"},
                )
                progress = int(status_resp.json().get("status", 0))
                if progress >= 100:
                    break

            # Get results
            results_resp = await client.get(
                f"http://localhost:{api_port}/JSON/spider/view/results/",
                params={"scanId": scan_id, "apikey": "crucible"},
            )
            urls = results_resp.json().get("results", [])
            return {"passed": len(urls) > 0, "urls_found": len(urls), "scan_id": scan_id}

    @staticmethod
    async def validate_module8_passive_scan(user_id: int) -> Dict[str, Any]:
        api_port = 8090 + user_id
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"http://localhost:{api_port}/JSON/alert/view/alerts/",
                params={"apikey": "crucible"},
            )
            if resp.status_code != 200:
                return {"passed": False, "message": "Could not fetch ZAP alerts"}

            alerts = resp.json().get("alerts", [])
            return {
                "passed": len(alerts) >= 5,
                "alert_count": len(alerts),
                "message": f"Found {len(alerts)} alerts (need ≥5)",
            }

    @staticmethod
    async def validate_module8_active_scan(user_id: int) -> Dict[str, Any]:
        api_port = 8090 + user_id
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"http://localhost:{api_port}/JSON/alert/view/alerts/",
                params={"riskLevel": "High", "apikey": "crucible"},
            )
            if resp.status_code != 200:
                return {"passed": False, "message": "Could not fetch ZAP HIGH alerts"}

            alerts = resp.json().get("alerts", [])
            return {
                "passed": len(alerts) >= 1,
                "high_alert_count": len(alerts),
                "alerts": [{"name": a["name"], "risk": a["risk"]} for a in alerts[:5]],
                "message": f"Found {len(alerts)} HIGH severity alerts",
            }

    # ─── Module 9: Security as Code (OPA/Conftest/Checkov in pipeline) ───────

    @staticmethod
    async def validate_module9_conftest(container_name: str, policy_path: str, test_cases: list) -> Dict[str, Any]:
        """
        Validate OPA/Conftest policy:
        - Must DENY bad config
        - Must PASS good config
        Both assertions required.
        """
        results = {}
        for case in test_cases:
            exit_code, output = await OrchestratorService.exec_in_container(
                container_name,
                f"conftest test --policy {policy_path} {case['file']}",
            )
            expected_fail = case.get("should_fail", False)
            actually_failed = exit_code != 0
            results[case["label"]] = {
                "should_fail": expected_fail,
                "did_fail": actually_failed,
                "correct": expected_fail == actually_failed,
                "output": output[:300],
            }

        all_correct = all(r["correct"] for r in results.values())
        return {"passed": all_correct, "test_results": results}

    # ─── Module 10: Compliance as Code (InSpec) ───────────────────────────────

    @staticmethod
    async def start_inspec_target(user_id: int) -> Dict[str, Any]:
        """Spin up Ubuntu target container with intentional misconfigs."""
        name = OrchestratorService._container_name("inspec_target", user_id, 10)

        def _run():
            client = _docker_client()
            try:
                c = client.containers.get(name)
                return {"container_name": name, "container_id": c.id, "status": "already_running"}
            except NotFound:
                pass

            c = client.containers.run(
                settings.INSPEC_TARGET_IMAGE,
                name=name,
                detach=True,
                command="tail -f /dev/null",  # keep alive
                network=settings.CONTAINER_NETWORK,
                labels={"managed_by": "crucible", "user_id": str(user_id)},
            )
            return {"container_name": name, "container_id": c.id, "status": "started"}

        return await asyncio.to_thread(_run)

    @staticmethod
    async def run_inspec_profile(
        container_name: str, profile_path: str, target_container_id: str
    ) -> Dict[str, Any]:
        """Run inspec exec against target container and return parsed results."""
        exit_code, output = await OrchestratorService.exec_in_container(
            container_name,
            f"inspec exec {profile_path} --target docker://{target_container_id} --reporter json",
        )
        import json
        try:
            # InSpec output may have non-JSON lines at start; find the JSON object
            json_start = output.find("{")
            report = json.loads(output[json_start:])
            controls = report.get("profiles", [{}])[0].get("controls", [])
            results = {
                c["id"]: {
                    "status": c["results"][0]["status"] if c.get("results") else "unknown",
                    "description": c.get("title", ""),
                }
                for c in controls
            }
            passed_count = sum(1 for r in results.values() if r["status"] == "passed")
            failed_count = sum(1 for r in results.values() if r["status"] == "failed")
            return {
                "passed": failed_count == 0,
                "control_results": results,
                "passed_count": passed_count,
                "failed_count": failed_count,
            }
        except Exception:
            return {"passed": False, "message": "Could not parse InSpec output", "output": output[:500]}
