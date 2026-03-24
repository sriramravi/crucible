from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.db.session import get_db
from app.core.security import require_admin
from app.services.user_service import UserService
from app.services.progress_service import ProgressService
from app.schemas.user import UserResponse, UserUpdate, UserCreate
from app.models.user import UserRole
from app.models.module import UserProgress, ChallengeAttempt, LabSession

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await UserService.get_all(db, skip=skip, limit=limit)


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    role: UserRole = UserRole.learner,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if await UserService.get_by_username(db, data.username):
        raise HTTPException(status_code=409, detail="Username taken")
    user = await UserService.create(db, data, role=role)
    await db.commit()
    return user


@router.get("/stats")
async def platform_stats(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User
    from app.models.module import ModuleStatus

    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_completed = (await db.execute(
        select(func.count(UserProgress.id)).where(UserProgress.status == ModuleStatus.completed)
    )).scalar_one()
    total_attempts = (await db.execute(select(func.count(ChallengeAttempt.id)))).scalar_one()
    active_sessions = (await db.execute(
        select(func.count(LabSession.id)).where(LabSession.status == "running")
    )).scalar_one()

    # Per-module completion counts
    module_stats = []
    for m in range(1, 11):
        count = (await db.execute(
            select(func.count(UserProgress.id)).where(
                UserProgress.module_id == m,
                UserProgress.status == ModuleStatus.completed,
            )
        )).scalar_one()
        module_stats.append({"module_id": m, "completed_count": count})

    return {
        "total_users": total_users,
        "total_module_completions": total_completed,
        "total_challenge_attempts": total_attempts,
        "active_lab_sessions": active_sessions,
        "module_stats": module_stats,
    }


@router.get("/users/{user_id}/progress")
async def get_user_progress(
    user_id: int,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await ProgressService.get_dashboard(db, user_id, user.username)


@router.post("/users/{user_id}/reset-module/{module_id}")
async def reset_module_progress(
    user_id: int,
    module_id: int,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reset a user's progress for a specific module (admin tool)."""
    from sqlalchemy import delete
    from app.models.module import ModuleStatus

    await db.execute(
        delete(ChallengeAttempt).where(
            ChallengeAttempt.user_id == user_id,
            ChallengeAttempt.module_id == module_id,
        )
    )
    progress = await ProgressService.get_module_progress(db, user_id, module_id)
    if progress:
        progress.status = ModuleStatus.available
        progress.started_at = None
        progress.completed_at = None
    await db.commit()
    return {"message": f"Module {module_id} reset for user {user_id}"}
