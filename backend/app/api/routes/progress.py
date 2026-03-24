from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.progress_service import ProgressService
from app.schemas.progress import (
    ProgressResponse, ChallengeAttemptResponse, DashboardResponse
)

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ProgressService.get_dashboard(db, current_user.id, current_user.username)


@router.get("/modules", response_model=List[ProgressResponse])
async def list_module_progress(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ProgressService.get_user_progress(db, current_user.id)


@router.get("/modules/{module_id}", response_model=ProgressResponse)
async def get_module_progress(
    module_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if module_id < 1 or module_id > 10:
        raise HTTPException(status_code=400, detail="Module ID must be 1-10")
    progress = await ProgressService.get_module_progress(db, current_user.id, module_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Progress not found")
    return progress


@router.get("/modules/{module_id}/challenges", response_model=List[ChallengeAttemptResponse])
async def get_challenge_attempts(
    module_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ProgressService.get_module_challenges(db, current_user.id, module_id)
