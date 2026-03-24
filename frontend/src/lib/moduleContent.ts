export interface Challenge {
  id: number;
  title: string;
  description: string;
  hints?: string[];
  validationHint?: string;
}

export interface ModuleContent {
  id: number;
  name: string;
  description: string;
  tool: string;
  toolImage?: string;
  labType: "container" | "quiz" | "pipeline" | "none";
  tutorial: string; // markdown
  challenges: Challenge[];
  videoPlaceholder?: string;
}

export const MODULES: Record<number, ModuleContent> = {
  1: {
    id: 1,
    name: "Version Control",
    description: "Learn Git fundamentals in a real Gitea environment with PR-based workflows.",
    tool: "Gitea",
    labType: "pipeline",
    tutorial: `## Version Control with Gitea

Version control is the foundation of every DevSecOps pipeline. In this module you'll work with **Gitea** — a self-hosted Git service — to practise branching, commits, and Pull Requests.

### Key Concepts
- **Branching strategy** — feature branches keep work isolated from \`main\`
- **Pull Requests** — the review gate before merging code
- **Git hooks** — enforce commit message standards and run pre-push checks
- **.gitignore** — prevent secrets and build artefacts from ever entering the repo

### Why It Matters for Security
Secrets leaked into version control are one of the top attack vectors. A well-configured .gitignore combined with pre-commit hooks (e.g. \`gitleaks\`) catches credentials before they hit the remote.

### Your Gitea Instance
When you start the lab, a personal Gitea account and repository are pre-created for you at the shared Gitea instance. You'll interact with it via the \`git\` CLI or the Gitea API.

\`\`\`bash
# Clone your repository
git clone http://gitea:3000/<your-username>/devsecops-lab.git
cd devsecops-lab

# Create feature branch
git checkout -b feature/my-first-branch

# Make a change
echo "# My first commit" >> README.md
git add README.md
git commit -m "feat: add readme entry"

# Push branch
git push origin feature/my-first-branch
\`\`\`

Then open a Pull Request via the Gitea web UI.`,
    challenges: [
      {
        id: 1,
        title: "Create Branch & Open PR",
        description: "Clone your pre-created repository, create a branch named `feature/my-first-branch`, push at least one commit, and open a Pull Request targeting `main`.",
        hints: [
          "Use `git checkout -b feature/my-first-branch` to create and switch",
          "Push with `git push origin feature/my-first-branch`",
          "Open a PR via the Gitea web UI or API",
        ],
        validationHint: "Validation checks Gitea API for the branch AND an open PR.",
      },
      {
        id: 2,
        title: "Secure Your Repository with .gitignore",
        description: "Create a `.gitignore` file that excludes `.env` files and push it to your repository. This prevents secrets from being accidentally committed.",
        hints: [
          "Add `.env` on its own line in `.gitignore`",
          "Also consider: `*.key`, `*.pem`, `node_modules/`, `.DS_Store`",
          "Commit and push to the `main` branch",
        ],
        validationHint: "Validation reads `.gitignore` from your repo and checks for `.env`.",
      },
    ],
  },

  2: {
    id: 2,
    name: "CI/CD",
    description: "Build automated pipelines with Gitea Actions and Jenkins, including failure handling.",
    tool: "Gitea Actions + Jenkins",
    labType: "pipeline",
    tutorial: `## CI/CD Pipelines

Continuous Integration / Continuous Delivery automates the path from code commit to deployable artefact. In this module you'll configure both **Gitea Actions** (GitHub Actions-compatible) and **Jenkins** pipelines.

### Gitea Actions (.gitea/workflows/ci.yml)

\`\`\`yaml
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install deps
        run: npm ci
      - name: Run tests
        run: npm test
\`\`\`

### Jenkinsfile (Declarative Pipeline)

\`\`\`groovy
pipeline {
  agent { docker { image 'node:20-alpine' } }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Build')    { steps { sh 'npm ci' } }
    stage('Test')     { steps { sh 'npm test' } }
  }
}
\`\`\`

### Pipeline Security Considerations
- Never store secrets in the \`Jenkinsfile\` — use Jenkins Credentials
- Pin action versions with full SHA, not floating tags (\`@v3\` → \`@abc123\`)
- Docker agents should run as non-root with read-only filesystems where possible`,
    challenges: [
      {
        id: 1,
        title: "Write a Gitea Actions Workflow",
        description: "Create `.gitea/workflows/ci.yml` in your repo. It must trigger on push, install dependencies, and run a test command. Push it and ensure the workflow run shows as success.",
        hints: [
          "The workflow file must be in `.gitea/workflows/` directory",
          "Use `runs-on: ubuntu-latest`",
          "A simple `echo 'tests passed'` counts as a test command for this challenge",
        ],
        validationHint: "Validation polls the Gitea Actions API and checks the latest run conclusion.",
      },
      {
        id: 2,
        title: "Write a Jenkinsfile",
        description: "Add a `Jenkinsfile` to your repo with three stages: Checkout, Build, Test. All stages must pass. Configure the Jenkins job to point to your repo.",
        hints: [
          "Your Jenkins folder is pre-created at /users/<username>/",
          "Use `agent { docker { image 'node:20-alpine' } }` as the agent",
          "Create the pipeline job manually in Jenkins or via the API",
        ],
        validationHint: "Validation checks Jenkins API for lastBuild result: SUCCESS.",
      },
      {
        id: 3,
        title: "Handle Pipeline Failures",
        description: "Introduce an intentional failure in your Jenkinsfile (e.g., a failing shell command), observe the red build, then fix it and achieve a green build.",
        hints: [
          "A stage with `sh 'exit 1'` will always fail",
          "Jenkins shows failed stages in red on the stage view",
          "Fix the failing command and rebuild",
        ],
        validationHint: "Validation checks that your latest Jenkins build is SUCCESS after a prior failure.",
      },
    ],
  },

  3: {
    id: 3,
    name: "Artifact Management",
    description: "Publish packages to Gitea Package Registry and proxy dependencies through Nexus.",
    tool: "Gitea Packages + Nexus Repository OSS",
    labType: "pipeline",
    tutorial: `## Artifact Management

Artefact repositories are the distribution layer of your pipeline — they store build outputs and proxy external dependencies, reducing supply chain risk.

### Gitea Package Registry

Gitea ships with a built-in package registry supporting npm, Docker, Maven, PyPI, and more — zero extra infrastructure.

\`\`\`bash
# Configure npm to use Gitea registry
npm config set registry http://gitea:3000/api/packages/<username>/npm/

# Publish a package
npm publish --registry http://gitea:3000/api/packages/<username>/npm/
\`\`\`

### Nexus Repository OSS

Nexus acts as a proxy/cache for upstream registries (npmjs.org, Maven Central). This means:
- Builds don't fail when upstream is down
- You can audit every dependency that enters your environment
- Malicious package substitution attacks are contained

\`\`\`xml
<!-- Maven settings.xml pointing at Nexus -->
<mirror>
  <id>nexus</id>
  <mirrorOf>*</mirrorOf>
  <url>http://nexus:8081/repository/maven-public/</url>
</mirror>
\`\`\``,
    challenges: [
      {
        id: 1,
        title: "Publish to Gitea Package Registry",
        description: "From your pipeline (or manually), publish an npm package to your Gitea Package Registry.",
        hints: [
          "Create a minimal package.json with `name` and `version` fields",
          "Run `npm publish` with the `--registry` flag pointing at Gitea",
          "Authentication: use your Gitea token as the npm `_authToken`",
        ],
        validationHint: "Validation calls Gitea API GET /api/v1/packages/<user> and checks for at least one package.",
      },
      {
        id: 2,
        title: "Configure Nexus as a Proxy",
        description: "Configure Nexus as an npm proxy repository and pull a dependency through it (e.g., `npm install lodash --registry http://nexus:8081/repository/npm-proxy/`).",
        hints: [
          "Log into the Nexus UI at http://nexus:8081 (admin/admin123)",
          "Create a new npm proxy repository pointing at https://registry.npmjs.org",
          "Pass the artifact name as `artifact_name` in your validation payload",
        ],
        validationHint: "Validation searches Nexus REST API for the cached artifact.",
      },
    ],
  },

  4: {
    id: 4,
    name: "Infrastructure as Code",
    description: "Provision cloud infrastructure with OpenTofu, configure with Ansible, and scan for misconfigs with Checkov.",
    tool: "OpenTofu + Ansible + LocalStack",
    labType: "container",
    tutorial: `## Infrastructure as Code

IaC treats infrastructure configuration as software — versioned, reviewed, and tested. This module uses **OpenTofu** (the open-source Terraform fork) against **LocalStack** to simulate AWS at zero cost.

### OpenTofu / Terraform

\`\`\`hcl
# main.tf — create an S3 bucket on LocalStack
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  endpoints {
    s3 = "http://localhost:4566"
  }
}

resource "aws_s3_bucket" "lab_bucket" {
  bucket = "lab-bucket"
}
\`\`\`

### Checkov — IaC Security Scanner

Checkov scans Terraform, CloudFormation, Kubernetes, and ARM templates for known misconfigurations.

\`\`\`bash
checkov -d . --framework terraform
\`\`\`

Common checks:
- **CKV_AWS_20** — S3 bucket should not be publicly accessible
- **CKV_AWS_18** — S3 bucket access logging should be enabled
- **CKV_AWS_52** — S3 bucket MFA delete should be enabled`,
    challenges: [
      {
        id: 1,
        title: "Create an S3 Bucket with OpenTofu",
        description: "Write a `main.tf` that provisions an S3 bucket named `lab-bucket` on your LocalStack instance. Run `tofu init`, `tofu plan`, `tofu apply -auto-approve`.",
        hints: [
          "Set the AWS endpoint to your LocalStack container port",
          "Use dummy credentials: access_key = 'test', secret_key = 'test'",
          "After apply, verify with: `aws --endpoint-url=http://localhost:<port> s3 ls`",
        ],
        validationHint: "Validation runs `aws s3 ls` against your LocalStack and checks for `lab-bucket`.",
      },
      {
        id: 2,
        title: "Configure with Ansible",
        description: "Write an Ansible playbook `site.yml` that installs nginx on a target Docker container. The container should be reachable as host `ansible-target`.",
        hints: [
          "Use `hosts: ansible-target` in your playbook",
          "Task: `ansible.builtin.apt: name=nginx state=present`",
          "Run with: `ansible-playbook -i inventory.ini site.yml`",
        ],
        validationHint: "Manual review — mark complete once nginx is installed.",
      },
      {
        id: 3,
        title: "Detect & Fix IaC Misconfiguration with Checkov",
        description: "Modify your `main.tf` to make the S3 bucket publicly accessible (add an ACL or public access block removal). Run Checkov, observe the failing check, then fix the misconfiguration and re-run until clean.",
        hints: [
          "Add `acl = \"public-read\"` to your bucket resource to trigger CKV_AWS_20",
          "Run `checkov -d . --framework terraform -o json` to get structured output",
          "Remove the ACL or set `aws_s3_bucket_public_access_block` to fix it",
        ],
        validationHint: "Validation parses Checkov JSON output and checks for public access findings.",
      },
    ],
  },

  5: {
    id: 5,
    name: "Cloud Service Providers (Theory)",
    description: "IaaS/PaaS/SaaS concepts, shared responsibility model, Azure vs AWS service mapping.",
    tool: "Quiz + Interactive Diagram",
    labType: "quiz",
    tutorial: `## Cloud Service Providers

This module is theory-based — no containers required. You'll solidify your understanding of cloud fundamentals before applying them in later modules.

### Service Models

| Model | You manage | Provider manages |
|-------|-----------|-----------------|
| **IaaS** | OS, runtime, app, data | Hypervisor, network, hardware |
| **PaaS** | App, data | Everything below app |
| **SaaS** | Configuration | Everything |

### Shared Responsibility Model

The cloud provider is **always** responsible for security **of** the cloud (physical hardware, hypervisors, global network). You are **always** responsible for security **in** the cloud (your data, identities, app code).

### Azure ↔ AWS Service Mapping

| Category | AWS | Azure |
|----------|-----|-------|
| Compute | EC2 | Virtual Machines |
| Containers | ECS / EKS | AKS / Container Apps |
| Object storage | S3 | Blob Storage |
| Managed DB | RDS | Azure SQL / Cosmos DB |
| IAM | IAM | Azure AD / Entra ID |
| VM identity | EC2 Instance Profile | Managed Identity |
| Serverless | Lambda | Azure Functions |
| CDN | CloudFront | Azure Front Door |

### Regions & Availability Zones

Cloud regions are independent geographic areas. Each region contains 2–6 **Availability Zones** (AZs) — physically separate data centres with independent power, cooling, and networking. Deploying across AZs protects against data-centre-level failures.`,
    challenges: [
      {
        id: 1,
        title: "Knowledge Quiz",
        description: "Answer 7 multiple-choice questions about cloud fundamentals. You need at least 6/7 correct to pass.",
        hints: [],
        validationHint: "Quiz is evaluated client-side. Results stored in DB.",
      },
      {
        id: 2,
        title: "Service Mapping Exercise",
        description: "Match each AWS service to its Azure equivalent using the drag-and-drop interface.",
        hints: [],
        validationHint: "Submit your matches to complete the exercise.",
      },
    ],
  },

  6: {
    id: 6,
    name: "Threat Modelling",
    description: "Identify threats using STRIDE methodology with OWASP Threat Dragon.",
    tool: "OWASP Threat Dragon",
    labType: "container",
    tutorial: `## Threat Modelling

Threat modelling is the practice of proactively identifying threats to a system **before** building or during design. The industry-standard framework is **STRIDE**.

### STRIDE

| Category | What can go wrong |
|----------|------------------|
| **S**poofing | Attacker impersonates a user or service |
| **T**ampering | Data is modified in transit or at rest |
| **R**epudiation | Actions cannot be traced back to an actor |
| **I**nformation Disclosure | Data is exposed to unauthorised parties |
| **D**enial of Service | Service is made unavailable |
| **E**levation of Privilege | Actor gains more permissions than intended |

### OWASP Threat Dragon

Threat Dragon is a free, open-source threat modelling tool. You'll model a simple three-tier web application:

\`\`\`
[Browser] ──HTTP──> [API Gateway] ──TLS──> [App Server] ──> [PostgreSQL DB]
\`\`\`

For each data flow and component, ask: what STRIDE threats apply?

### Mitigation Examples
- Spoofing → Require mutual TLS or strong authentication
- Tampering → Sign data payloads; use HTTPS everywhere
- Repudiation → Implement audit logging with tamper-evident storage
- Information Disclosure → Encrypt data at rest; minimise data in responses
- DoS → Rate limiting, WAF, autoscaling
- EoP → Least-privilege IAM roles; input validation`,
    challenges: [
      {
        id: 1,
        title: "Model the Architecture & Identify Threats",
        description: "Using the pre-provided architecture diagram in Threat Dragon, identify at least 2 threats per STRIDE category (12 total). Add a mitigation for each threat.",
        hints: [
          "Your Threat Dragon instance is accessible via the URL shown when you start the lab",
          "Load the starter model file from your Gitea repo",
          "Every threat MUST have a non-empty Mitigation field",
        ],
        validationHint: "Validation parses the exported JSON: checks 12+ threats, STRIDE coverage, and non-empty mitigations.",
      },
      {
        id: 2,
        title: "Export & Commit Threat Model",
        description: "Export your completed threat model as `threat-model.json` and commit it to the root of your Gitea repository.",
        hints: [
          "In Threat Dragon: File → Export as JSON",
          "Commit to `main` branch as `threat-model.json`",
        ],
        validationHint: "Validation checks for `threat-model.json` in your Gitea repo root.",
      },
    ],
  },

  7: {
    id: 7,
    name: "SAST",
    description: "Static Application Security Testing using Semgrep and Bandit against a vulnerable Python app.",
    tool: "Semgrep OSS + Bandit",
    labType: "pipeline",
    tutorial: `## Static Application Security Testing (SAST)

SAST analyses source code without executing it, looking for patterns that indicate security vulnerabilities.

### Tools

**Semgrep** — language-agnostic, rule-based, fast. Supports 30+ languages and thousands of community rules.

\`\`\`bash
# Run with all auto-detected rules
semgrep --config=auto --json vulnerable_app/ > semgrep-results.json
\`\`\`

**Bandit** — Python-specific, focuses on common Python security pitfalls.

\`\`\`bash
bandit -r vulnerable_app/ -f json -o bandit-results.json
\`\`\`

### Target App — Intentional Vulnerabilities

Your Gitea repo contains \`vulnerable_app/app.py\` with four intentional issues:

1. **SQL Injection** — user input concatenated directly into SQL query
2. **Hardcoded Secret** — API key embedded in source code
3. **eval() with user input** — arbitrary code execution risk
4. **Insecure deserialization** — using \`pickle.loads()\` on untrusted data

### Writing Custom Semgrep Rules

\`\`\`yaml
rules:
  - id: detect-eval-with-input
    pattern: eval(request.$X)
    message: "eval() called with user-controlled input"
    languages: [python]
    severity: ERROR
\`\`\``,
    challenges: [
      {
        id: 1,
        title: "Run Semgrep & Identify Findings",
        description: "Run `semgrep --config=auto --json` against the vulnerable app in your repo. Identify and document at least 3 findings.",
        hints: [
          "Run from the repo root: `semgrep --config=auto --json vulnerable_app/`",
          "Look for check_ids related to sqli, hardcoded-token, and eval",
          "Document each finding with: rule ID, file, line, description",
        ],
        validationHint: "Validation parses Semgrep JSON and confirms expected rule IDs fired.",
      },
      {
        id: 2,
        title: "Compare Semgrep vs Bandit",
        description: "Run Bandit against the same app and note what each tool catches that the other misses.",
        hints: [
          "Run: `bandit -r vulnerable_app/ -f json`",
          "Bandit test IDs: B608 (SQL injection), B105 (hardcoded password), B307 (eval), B301 (pickle)",
          "Document your comparison in a file `sast-comparison.md` committed to your repo",
        ],
        validationHint: "Documentation challenge — marked complete after submission.",
      },
      {
        id: 3,
        title: "Write a Custom Semgrep Rule",
        description: "Write a custom Semgrep rule in `rules/custom-eval.yaml` that detects the eval() vulnerability pattern. It must fire on the bad code and not fire on a clean alternative.",
        hints: [
          "Use pattern: `eval(...)` or more specifically `eval(request.$X)`",
          "Test with: `semgrep --config rules/custom-eval.yaml vulnerable_app/`",
          "Commit the rule file to your repo",
        ],
        validationHint: "Validation runs your rule file and confirms it fires on bad code and not on clean code.",
      },
      {
        id: 4,
        title: "Fix SQL Injection",
        description: "Fix the SQL injection vulnerability in `vulnerable_app/app.py` using parameterised queries. Re-run Semgrep to confirm the finding no longer appears.",
        hints: [
          "Replace string concatenation: `'SELECT * FROM users WHERE id=' + user_id`",
          "Use parameterised query: `cursor.execute('SELECT * FROM users WHERE id=?', (user_id,))`",
          "Re-run Semgrep after fixing to verify the rule ID no longer fires",
        ],
        validationHint: "Validation re-runs Semgrep and confirms the SQL injection rule ID is absent.",
      },
    ],
  },

  8: {
    id: 8,
    name: "DAST",
    description: "Dynamic security scanning with OWASP ZAP against Juice Shop.",
    tool: "OWASP ZAP + OWASP Juice Shop",
    labType: "container",
    tutorial: `## Dynamic Application Security Testing (DAST)

DAST tests a **running application** by sending malicious inputs and observing responses. Unlike SAST, it can find issues that only appear at runtime.

### OWASP ZAP

ZAP is the world's most widely-used DAST tool. It works as a proxy or as an API-driven headless scanner.

**Spider** — crawls the application and discovers all URLs.
**Passive Scan** — analyses traffic already seen by the proxy for vulnerabilities.
**Active Scan** — actively attacks the discovered endpoints.

\`\`\`bash
# Run ZAP headless active scan
docker run ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \\
  -t http://juice-shop:3000 \\
  -J zap-report.json
\`\`\`

### OWASP Juice Shop

Juice Shop is an intentionally insecure web application covering the OWASP Top 10. It's your target for this module — do NOT attempt to fix it, it's the practice environment.

### Alert Risk Levels
- **High** — Exploitable, likely data exposure or RCE
- **Medium** — Needs remediation, may be exploitable under certain conditions
- **Low** — Best-practice violation or informational
- **Informational** — FYI only`,
    challenges: [
      {
        id: 1,
        title: "Spider & Passive Scan",
        description: "Configure ZAP to spider the Juice Shop URL. Let the passive scan complete and review the alerts report. You should find at least 5 alerts.",
        hints: [
          "Your ZAP instance URL is shown when you start the lab",
          "ZAP API endpoint: GET /JSON/spider/action/scan/?url=http://juice-shop:3000",
          "Poll the spider status until it reaches 100%",
        ],
        validationHint: "Validation triggers a spider run and checks passive scan alerts ≥ 5.",
      },
      {
        id: 2,
        title: "Active Scan & Document a HIGH Finding",
        description: "Run a ZAP active scan against Juice Shop. Identify at least one HIGH severity finding and document it with CVSS score and remediation recommendation.",
        hints: [
          "POST to /JSON/ascan/action/scan/ with the target URL",
          "Active scans take longer — poll /JSON/ascan/view/status/ until complete",
          "Document your finding in `dast-findings.md` committed to your repo",
        ],
        validationHint: "Validation checks for at least 1 HIGH severity alert from ZAP.",
      },
      {
        id: 3,
        title: "Integrate ZAP into Jenkins Pipeline",
        description: "Add a ZAP scan stage to your Jenkinsfile. Configure it to fail the build if any HIGH severity alerts are found.",
        hints: [
          "Add a stage that runs `zap-full-scan.py` against Juice Shop",
          "Parse the JSON report and check for `riskcode >= 3` (HIGH)",
          "Use `sh returnStatus: true` to capture exit code without failing immediately",
        ],
        validationHint: "Validation checks Jenkins build status reflects ZAP gate result.",
      },
    ],
  },

  9: {
    id: 9,
    name: "Security as Code",
    description: "Write and enforce OPA/Rego policies with Conftest and Checkov custom checks.",
    tool: "OPA + Conftest + Checkov",
    labType: "pipeline",
    tutorial: `## Security as Code

Policy as Code means expressing security rules in version-controlled, testable, machine-enforceable files — not in a wiki or a PDF.

### OPA / Rego

**Open Policy Agent** (OPA) is a general-purpose policy engine. Policies are written in **Rego**.

\`\`\`rego
# policy/deny_root.rego
package main

deny[msg] {
  input.spec.securityContext.runAsUser == 0
  msg := "Containers must not run as root (UID 0)"
}
\`\`\`

### Conftest

**Conftest** runs OPA policies against structured config files (YAML, JSON, HCL, Dockerfile).

\`\`\`bash
# Test a Kubernetes deployment against your policy
conftest test --policy policy/ deployment.yaml
\`\`\`

### Checkov Custom Check

\`\`\`python
from checkov.common.models.enums import CheckResult, CheckCategories
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck

class S3VersioningCheck(BaseResourceCheck):
    def __init__(self):
        super().__init__(
            name="Ensure S3 bucket has versioning enabled",
            id="CKV_CUSTOM_S3_001",
            categories=[CheckCategories.GENERAL_SECURITY],
            supported_resources=["aws_s3_bucket"],
        )

    def scan_resource_conf(self, conf):
        versioning = conf.get("versioning", [{}])
        enabled = versioning[0].get("enabled", [False])
        return CheckResult.PASSED if enabled[0] else CheckResult.FAILED
\`\`\``,
    challenges: [
      {
        id: 1,
        title: "Write OPA Policy: Block Root Containers",
        description: "Write a Rego policy that blocks Kubernetes deployments running as UID 0 (root). Test it with Conftest against both a bad deployment.yaml and a good deployment.yaml.",
        hints: [
          "Policy path: `policy/deny_root.rego`",
          "Bad YAML: securityContext.runAsUser: 0",
          "Good YAML: securityContext.runAsUser: 1000",
          "Both test cases must behave correctly",
        ],
        validationHint: "Validation runs Conftest with your policy against both configs. Both results must be correct.",
      },
      {
        id: 2,
        title: "Write a Checkov Custom Check",
        description: "Write a custom Checkov check class in `checks/s3_versioning.py` that fails when an S3 bucket has versioning disabled.",
        hints: [
          "Extend `BaseResourceCheck` and set `supported_resources = ['aws_s3_bucket']`",
          "Check for `versioning[0].enabled == True`",
          "Test with: `checkov -d . --external-checks-dir checks/`",
        ],
        validationHint: "Validation runs Checkov with your custom check and verifies it fires on a bucket without versioning.",
      },
      {
        id: 3,
        title: "Gate Pipeline with Conftest",
        description: "Add a Conftest policy gate to your Jenkinsfile. The pipeline must fail if any Kubernetes manifest in the repo violates your root-container policy.",
        hints: [
          "Add a stage: `sh 'conftest test --policy policy/ k8s/'`",
          "Conftest exits non-zero if any policy check fails",
          "Create a test manifest `k8s/deployment.yaml` with the bad config to verify the gate works",
        ],
        validationHint: "Pipeline stage challenge — validated via Jenkins build status.",
      },
    ],
  },

  10: {
    id: 10,
    name: "Compliance as Code",
    description: "Write InSpec profiles to detect misconfigurations in a Docker container, then remediate.",
    tool: "Chef InSpec",
    labType: "container",
    tutorial: `## Compliance as Code

Compliance as Code uses automated tests — called **controls** — to verify that a system meets security requirements. The controls are version-controlled, repeatable, and auditable.

### Chef InSpec

InSpec profiles are collections of controls. Each control makes assertions about system state.

\`\`\`ruby
# controls/ssh.rb
control 'ssh-root-login' do
  title 'Disable root SSH login'
  desc  'Root login over SSH should be disabled to reduce attack surface'
  impact 1.0

  describe sshd_config do
    its('PermitRootLogin') { should eq 'no' }
  end
end
\`\`\`

### Running Against Docker

\`\`\`bash
inspec exec my-profile/ \\
  --target docker://<container_id> \\
  --reporter json > results.json
\`\`\`

### Target Container Misconfigurations

Your lab container has four intentional issues:
1. SSH exposed on port 22
2. Root login enabled (\`PermitRootLogin yes\`)
3. World-writable files present
4. Outdated package versions

Write controls for each, run them to confirm they fail, remediate the container, re-run to confirm they pass.`,
    challenges: [
      {
        id: 1,
        title: "Write InSpec Controls",
        description: "Create an InSpec profile in `inspec-profile/` with controls that detect all 4 misconfigurations: SSH on port 22, root login enabled, world-writable files, and outdated packages.",
        hints: [
          "Control 1: `describe port(22) { it { should be_listening } }`",
          "Control 2: `describe sshd_config { its('PermitRootLogin') { should eq 'no' } }`",
          "Control 3: `describe command('find / -perm -002 -type f') { its(:stdout) { should be_empty } }`",
          "Control 4: `describe package('openssl') { its(:version) { should cmp >= '3.0' } }`",
        ],
        validationHint: "Validation runs your profile against the target container and checks controls fail.",
      },
      {
        id: 2,
        title: "Run Profile Against Target",
        description: "Execute your InSpec profile against the lab target container and review the failure output.",
        hints: [
          "Your target container ID is shown in the lab session details",
          "Run: `inspec exec inspec-profile/ --target docker://<id> --reporter json`",
          "Expect 4 failed controls before remediation",
        ],
        validationHint: "Validation parses InSpec JSON — expects controls to FAIL at this stage.",
      },
      {
        id: 3,
        title: "Remediate & Verify",
        description: "Fix all 4 misconfigurations in the target container, re-run your InSpec profile, and confirm all controls pass.",
        hints: [
          "Edit `/etc/ssh/sshd_config` inside the container: set `PermitRootLogin no`",
          "Restart sshd: `service ssh restart`",
          "Fix world-writable files: `chmod o-w <file>`",
          "Upgrade packages: `apt-get upgrade -y`",
        ],
        validationHint: "Validation re-runs your profile and requires ALL controls to PASS.",
      },
    ],
  },
};
