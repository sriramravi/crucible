from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime

from app.models.module import (
    UserProgress, ChallengeAttempt, LabSession, QuizResult,
    ModuleStatus, ChallengeStatus
)


class ProgressService:
    @staticmethod
    async def get_user_progress(db: AsyncSession, user_id: int) -> List[UserProgress]:
        result = await db.execute(
            select(UserProgress)
            .where(UserProgress.user_id == user_id)
            .order_by(UserProgress.module_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_module_progress(db: AsyncSession, user_id: int, module_id: int) -> Optional[UserProgress]:
        result = await db.execute(
            select(UserProgress)
            .where(UserProgress.user_id == user_id, UserProgress.module_id == module_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def start_module(db: AsyncSession, user_id: int, module_id: int) -> UserProgress:
        progress = await ProgressService.get_module_progress(db, user_id, module_id)
        if not progress:
            progress = UserProgress(user_id=user_id, module_id=module_id, status=ModuleStatus.available)
            db.add(progress)

        if progress.status == ModuleStatus.available:
            progress.status = ModuleStatus.in_progress
            progress.started_at = datetime.utcnow()
            await db.flush()

        return progress

    @staticmethod
    async def complete_module(db: AsyncSession, user_id: int, module_id: int) -> None:
        progress = await ProgressService.get_module_progress(db, user_id, module_id)
        if progress:
            progress.status = ModuleStatus.completed
            progress.completed_at = datetime.utcnow()

        # Unlock next module
        if module_id < 10:
            next_progress = await ProgressService.get_module_progress(db, user_id, module_id + 1)
            if next_progress and next_progress.status == ModuleStatus.locked:
                next_progress.status = ModuleStatus.available

        await db.flush()

    @staticmethod
    async def get_challenge_attempt(
        db: AsyncSession, user_id: int, module_id: int, challenge_id: int
    ) -> Optional[ChallengeAttempt]:
        result = await db.execute(
            select(ChallengeAttempt).where(
                ChallengeAttempt.user_id == user_id,
                ChallengeAttempt.module_id == module_id,
                ChallengeAttempt.challenge_id == challenge_id,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def record_challenge_attempt(
        db: AsyncSession,
        user_id: int,
        module_id: int,
        challenge_id: int,
        passed: bool,
        validation_output: dict,
    ) -> ChallengeAttempt:
        attempt = await ProgressService.get_challenge_attempt(db, user_id, module_id, challenge_id)

        if not attempt:
            attempt = ChallengeAttempt(
                user_id=user_id,
                module_id=module_id,
                challenge_id=challenge_id,
                status=ChallengeStatus.in_progress,
            )
            db.add(attempt)

        attempt.attempt_count += 1
        attempt.validation_output = validation_output

        if passed:
            attempt.status = ChallengeStatus.passed
            attempt.passed_at = datetime.utcnow()
        else:
            attempt.status = ChallengeStatus.failed

        await db.flush()
        await db.refresh(attempt)
        return attempt

    @staticmethod
    async def get_module_challenges(
        db: AsyncSession, user_id: int, module_id: int
    ) -> List[ChallengeAttempt]:
        result = await db.execute(
            select(ChallengeAttempt).where(
                ChallengeAttempt.user_id == user_id,
                ChallengeAttempt.module_id == module_id,
            ).order_by(ChallengeAttempt.challenge_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def all_challenges_passed(db: AsyncSession, user_id: int, module_id: int, total: int) -> bool:
        result = await db.execute(
            select(func.count(ChallengeAttempt.id)).where(
                ChallengeAttempt.user_id == user_id,
                ChallengeAttempt.module_id == module_id,
                ChallengeAttempt.status == ChallengeStatus.passed,
            )
        )
        passed_count = result.scalar_one()
        return passed_count >= total

    @staticmethod
    async def get_active_session(db: AsyncSession, user_id: int, module_id: int) -> Optional[LabSession]:
        result = await db.execute(
            select(LabSession).where(
                LabSession.user_id == user_id,
                LabSession.module_id == module_id,
                LabSession.status == "running",
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_session(
        db: AsyncSession, user_id: int, module_id: int, metadata: dict = None
    ) -> LabSession:
        session = LabSession(user_id=user_id, module_id=module_id, metadata_=metadata or {})
        db.add(session)
        await db.flush()
        await db.refresh(session)
        return session

    @staticmethod
    async def update_session(db: AsyncSession, session_id: int, **kwargs) -> None:
        result = await db.execute(select(LabSession).where(LabSession.id == session_id))
        session = result.scalar_one_or_none()
        if session:
            for key, value in kwargs.items():
                setattr(session, key, value)
            await db.flush()

    @staticmethod
    async def get_dashboard(db: AsyncSession, user_id: int, username: str) -> dict:
        all_progress = await ProgressService.get_user_progress(db, user_id)
        completed = sum(1 for p in all_progress if p.status == ModuleStatus.completed)
        in_progress = sum(1 for p in all_progress if p.status == ModuleStatus.in_progress)

        result = await db.execute(
            select(ChallengeAttempt)
            .where(ChallengeAttempt.user_id == user_id)
            .order_by(ChallengeAttempt.updated_at.desc())
            .limit(10)
        )
        recent = list(result.scalars().all())

        return {
            "user_id": user_id,
            "username": username,
            "completed_modules": completed,
            "in_progress_modules": in_progress,
            "overall_percentage": round((completed / 10) * 100, 1),
            "module_progress": all_progress,
            "recent_activity": recent,
        }
