from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.user import UserCreate, UserLogin, TokenResponse, UserResponse
from app.services.user_service import UserService
from app.services.orchestrator import OrchestratorService
from app.core.security import create_access_token, get_current_user
from app.models.user import UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    if await UserService.get_by_username(db, data.username):
        raise HTTPException(status_code=409, detail="Username already taken")
    if await UserService.get_by_email(db, data.email):
        raise HTTPException(status_code=409, detail="Email already registered")

    user = await UserService.create(db, data)

    # Provision Gitea account in background
    gitea_token = await OrchestratorService.setup_gitea_user(
        user.username, data.password, user.email
    )
    if gitea_token:
        await UserService.update_gitea_token(db, user.id, gitea_token)
        await db.commit()
        await db.refresh(user)

    # Also set up Jenkins folder (fire and forget errors)
    try:
        await OrchestratorService.setup_jenkins_user(user.username)
    except Exception:
        pass

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await UserService.authenticate(db, data.username, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def me(current_user=Depends(get_current_user)):
    return current_user
