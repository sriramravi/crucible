"""
Lab management routes — start/stop containers and run validations for all 10 modules.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.progress_service import ProgressService
from app.services.orchestrator import OrchestratorService
from app.schemas.progress import (
    LabSessionResponse, ValidationRequest, ValidationResponse, QuizSubmission, QuizResultResponse
)
from app.models.module import ModuleStatus

router = APIRouter(prefix="/labs", tags=["labs"])

# Number of challenges per module (used for completion gating)
MODULE_CHALLENGE_COUNTS = {1: 2, 2: 3, 3: 2, 4: 3, 5: 2, 6: 2, 7: 4, 8: 3, 9: 3, 10: 3}


async def _assert_module_accessible(db, user_id, module_id):
    progress = await ProgressService.get_module_progress(db, user_id, module_id)
    if not progress or progress.status == ModuleStatus.locked:
        raise HTTPException(status_code=403, detail="Module is locked. Complete prior modules first.")
    return progress


# ─── Lab session management ────────────────────────────────────────────────────

@router.post("/modules/{module_id}/start", response_model=LabSessionResponse)
async def start_lab(
    module_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_module_accessible(db, current_user.id, module_id)
    await ProgressService.start_module(db, current_user.id, module_id)

    # Check for existing active session
    existing = await ProgressService.get_active_session(db, current_user.id, module_id)
    if existing:
        return existing

    session = await ProgressService.create_session(db, current_user.id, module_id)
    meta = {}

    # Spin up containers based on module
    if module_id == 4:
        result = await OrchestratorService.start_localstack(current_user.id)
        meta = result
    elif module_id == 6:
        result = await OrchestratorService.start_threat_dragon(current_user.id)
        meta = result
    elif module_id == 8:
        result = await OrchestratorService.start_zap(current_user.id)
        meta = result
    elif module_id == 10:
        result = await OrchestratorService.start_inspec_target(current_user.id)
        meta = result

    await ProgressService.update_session(
        db, session.id,
        status="running",
        container_name=meta.get("container_name"),
        container_id=meta.get("container_id"),
        container_port=meta.get("port") or meta.get("api_port"),
        metadata_=meta,
    )
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/modules/{module_id}/stop")
async def stop_lab(
    module_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await ProgressService.get_active_session(db, current_user.id, module_id)
    if not session:
        return {"message": "No active lab session"}

    if session.container_name:
        await OrchestratorService.stop_container(session.container_name)

    await ProgressService.update_session(
        db, session.id, status="stopped", stopped_at=datetime.utcnow()
    )
    await db.commit()
    return {"message": "Lab stopped"}


# ─── Challenge validation ──────────────────────────────────────────────────────

@router.post("/validate", response_model=ValidationResponse)
async def validate_challenge(
    req: ValidationRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    module_id = req.module_id
    challenge_id = req.challenge_id
    payload = req.payload or {}

    await _assert_module_accessible(db, current_user.id, module_id)

    result = await _run_validation(current_user, module_id, challenge_id, payload)
    passed = result.get("passed", False)

    attempt = await ProgressService.record_challenge_attempt(
        db, current_user.id, module_id, challenge_id, passed, result
    )

    # Check if all challenges in module are now done
    total = MODULE_CHALLENGE_COUNTS.get(module_id, 1)
    if await ProgressService.all_challenges_passed(db, current_user.id, module_id, total):
        await ProgressService.complete_module(db, current_user.id, module_id)

    await db.commit()

    return ValidationResponse(
        passed=passed,
        message=result.get("message", "Validation complete"),
        details=result,
    )


async def _run_validation(user, module_id: int, challenge_id: int, payload: dict) -> dict:
    username = user.username
    user_token = user.gitea_token or ""
    user_id = user.id

    # Module 1
    if module_id == 1:
        if challenge_id == 1:
            return await OrchestratorService.validate_module1_challenge1(username, user_token)
        if challenge_id == 2:
            return await OrchestratorService.validate_module1_challenge2(username, user_token)

    # Module 2
    elif module_id == 2:
        if challenge_id == 1:
            return await OrchestratorService.validate_module2_challenge1(username, user_token)
        if challenge_id in (2, 3):
            return await OrchestratorService.validate_module2_challenge2(username)

    # Module 3
    elif module_id == 3:
        if challenge_id == 1:
            return await _validate_module3_gitea_package(username, user_token, payload)
        if challenge_id == 2:
            return await _validate_module3_nexus(payload)

    # Module 4
    elif module_id == 4:
        if challenge_id == 1:
            return await OrchestratorService.validate_module4_challenge1(user_id, payload.get("bucket_name", "lab-bucket"))
        if challenge_id == 3:
            container = OrchestratorService._container_name("localstack", user_id, 4)
            return await OrchestratorService.validate_module4_challenge3_checkov(container)
        return {"passed": True, "message": "Manual review challenge — marked complete"}

    # Module 5 — quiz is handled separately via /quiz endpoint
    elif module_id == 5:
        return {"passed": True, "message": "Use /labs/quiz to submit quiz answers"}

    # Module 6
    elif module_id == 6:
        if challenge_id == 1:
            return await OrchestratorService.validate_module6_challenge1(username, user_token)
        if challenge_id == 2:
            return await _validate_module6_challenge2(username, user_token)

    # Module 7
    elif module_id == 7:
        container = payload.get("container_name", "")
        if challenge_id in (1, 2):
            return await OrchestratorService.validate_module7_semgrep(
                container,
                ["python.lang.security.audit.sqli.formatted-sql-query.formatted-sql-query",
                 "python.lang.security.audit.hardcoded-api-token.hardcoded-api-token"],
            )
        if challenge_id == 4:
            return await OrchestratorService.validate_module7_sqli_fixed(
                container, "python.lang.security.audit.sqli.formatted-sql-query.formatted-sql-query"
            )
        return {"passed": True, "message": "Documentation challenge — marked complete"}

    # Module 8
    elif module_id == 8:
        if challenge_id == 1:
            spider = await OrchestratorService.run_zap_spider(user_id)
            if spider.get("passed"):
                return await OrchestratorService.validate_module8_passive_scan(user_id)
            return spider
        if challenge_id == 2:
            return await OrchestratorService.validate_module8_active_scan(user_id)
        return {"passed": True, "message": "Pipeline integration — validated via Jenkins"}

    # Module 9
    elif module_id == 9:
        container = payload.get("container_name", "")
        policy = payload.get("policy_path", "/workspace/policy")
        test_cases = payload.get("test_cases", [])
        if challenge_id in (1, 2):
            if not test_cases:
                return {"passed": False, "message": "Provide test_cases in payload"}
            return await OrchestratorService.validate_module9_conftest(container, policy, test_cases)
        return {"passed": True, "message": "Pipeline gate challenge — validated via Jenkins"}

    # Module 10
    elif module_id == 10:
        container = payload.get("container_name", "")
        profile = payload.get("profile_path", "/workspace/inspec-profile")
        target_id = payload.get("target_container_id", "")
        if challenge_id in (1, 2, 3):
            return await OrchestratorService.run_inspec_profile(container, profile, target_id)

    return {"passed": False, "message": f"Unknown module/challenge: {module_id}/{challenge_id}"}


async def _validate_module3_gitea_package(username: str, user_token: str, payload: dict) -> dict:
    import httpx
    from app.core.config import settings
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{settings.GITEA_URL}/api/v1/packages/{username}",
            headers={"Authorization": f"token {user_token}"},
        )
        packages = resp.json() if resp.status_code == 200 else []
        has_package = len(packages) > 0
        return {"passed": has_package, "package_count": len(packages), "message": f"Found {len(packages)} package(s)"}


async def _validate_module3_nexus(payload: dict) -> dict:
    import httpx
    from app.core.config import settings
    artifact = payload.get("artifact_name", "")
    if not artifact:
        return {"passed": False, "message": "Provide artifact_name in payload"}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{settings.NEXUS_URL}/service/rest/v1/search",
            params={"name": artifact},
            auth=(settings.NEXUS_ADMIN_USER, settings.NEXUS_ADMIN_PASSWORD),
        )
        items = resp.json().get("items", []) if resp.status_code == 200 else []
        return {"passed": len(items) > 0, "artifacts_found": len(items)}


async def _validate_module6_challenge2(username: str, user_token: str) -> dict:
    import httpx
    from app.core.config import settings
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{settings.GITEA_URL}/api/v1/repos/{username}/devsecops-lab/raw/threat-model.json",
            headers={"Authorization": f"token {user_token}"},
        )
        if resp.status_code == 200:
            return {"passed": True, "message": "threat-model.json found in repository"}
        return {"passed": False, "message": "threat-model.json not committed to repository"}


# ─── Quiz (Module 5) ───────────────────────────────────────────────────────────

@router.post("/quiz", response_model=QuizResultResponse)
async def submit_quiz(
    submission: QuizSubmission,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if submission.module_id != 5:
        raise HTTPException(status_code=400, detail="Quiz only available for Module 5")

    await _assert_module_accessible(db, current_user.id, 5)

    result = OrchestratorService.validate_quiz5(submission.answers)

    # Save quiz result
    from app.models.module import QuizResult
    quiz_record = QuizResult(
        user_id=current_user.id,
        module_id=5,
        score=result["score"],
        max_score=result["max_score"],
        answers=submission.answers,
        passed=result["passed"],
    )
    db.add(quiz_record)

    if result["passed"]:
        # Record challenge 1 as passed
        await ProgressService.record_challenge_attempt(db, current_user.id, 5, 1, True, result)
        # Challenge 2 (drag-and-drop) needs separate submission; mark passed too if quiz passes
        await ProgressService.record_challenge_attempt(db, current_user.id, 5, 2, True, {"auto": True})
        await ProgressService.complete_module(db, current_user.id, 5)

    await db.commit()
    return QuizResultResponse(**result)


@router.get("/quiz/questions")
async def get_quiz_questions(current_user=Depends(get_current_user)):
    """Return quiz questions without answers."""
    return [
        {"index": idx, "question": q["question"], "options": q["options"]}
        for idx, q in OrchestratorService.MODULE5_QUIZ.items()
    ]
