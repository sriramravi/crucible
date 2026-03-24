# Crucible — Setup Guide

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Node.js 20+ (local frontend dev only)
- Python 3.12+ (local backend dev only)

## First-time Setup

### 1. Clone and configure

```bash
cd dso-lab
cp .env.example .env
# Edit .env — at minimum set a strong SECRET_KEY
```

### 2. Start core services

```bash
docker compose up -d postgres gitea nexus jenkins juice-shop
```

Wait ~60 seconds for all services to initialise.

### 3. Configure Gitea admin account

Open http://localhost:3000 and complete the install wizard:
- Admin username: `gitea_admin`
- Admin password: choose a password
- Email: admin@localhost

Then generate an API token:
- Go to Settings → Applications → Generate Token
- Name: `crucible-admin`
- Copy the token into your `.env` as `GITEA_ADMIN_TOKEN`

Also register an Act Runner:
- Go to Site Administration → Runners → Create Runner
- Copy the registration token into `.env` as `ACT_RUNNER_TOKEN`

### 4. Start remaining services

```bash
docker compose up -d backend frontend act-runner
```

### 5. Create admin user

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@lab.local","password":"adminpass1"}'
```

Then use the admin token to promote:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpass1"}' | jq -r '.access_token')

curl -X PATCH http://localhost:8000/api/v1/admin/users/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

### 6. Build InSpec target image (Module 10)

```bash
docker build -t crucible/inspec-target:latest ./infrastructure/inspec-target/
```

### 7. Access the platform

| Service | URL |
|---------|-----|
| **Learning Platform** | http://localhost:3001 |
| **Backend API docs** | http://localhost:8000/docs |
| **Gitea** | http://localhost:3000 |
| **Jenkins** | http://localhost:8080 |
| **Nexus** | http://localhost:8081 |
| **Juice Shop** | http://localhost:3002 |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (Next.js :3001)                                │
│  ├── Auth (login/register)                               │
│  ├── Dashboard (progress overview)                       │
│  ├── Module pages (tutorial + lab + challenges)          │
│  └── Admin panel (user management + stats)               │
└──────────────────┬───────────────────────────────────────┘
                   │ REST API
┌──────────────────▼───────────────────────────────────────┐
│  Backend (FastAPI :8000)                                 │
│  ├── /api/v1/auth  — JWT register/login                  │
│  ├── /api/v1/progress — module & challenge tracking      │
│  ├── /api/v1/labs  — container lifecycle + validation    │
│  └── /api/v1/admin — user management + stats             │
│                                                          │
│  OrchestratorService                                     │
│  ├── Gitea API calls (M1, M2, M3, M6, M7)               │
│  ├── Jenkins API calls (M2, M8, M9)                      │
│  ├── Docker SDK — spin up/tear down containers           │
│  │   ├── LocalStack per user (M4)                        │
│  │   ├── Threat Dragon per user (M6)                     │
│  │   ├── ZAP per user (M8)                               │
│  │   └── InSpec target per user (M10)                    │
│  └── Client-side quiz validation (M5)                    │
└──────────────────┬───────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────┐
│  PostgreSQL :5432                                        │
│  Tables: users, user_progress, challenge_attempts,       │
│          lab_sessions, quiz_results                      │
└──────────────────────────────────────────────────────────┘
```

## Module Completion Flow

Each module follows this lifecycle:
1. **Locked** → previous module must be completed
2. **Available** → user can start the module
3. **In Progress** → module started, challenges active
4. **Completed** → all challenges passed → next module unlocked

## Development

### Backend only
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend only
```bash
cd frontend
npm install
npm run dev   # runs on :3001
```
