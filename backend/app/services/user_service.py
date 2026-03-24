from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.models.user import User, UserRole
from app.models.module import UserProgress, ModuleStatus
from app.core.security import hash_password, verify_password
from app.schemas.user import UserCreate


class UserService:
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_username(db: AsyncSession, username: str) -> Optional[User]:
        result = await db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[User]:
        result = await db.execute(select(User).offset(skip).limit(limit))
        return list(result.scalars().all())

    @staticmethod
    async def create(db: AsyncSession, data: UserCreate, role: UserRole = UserRole.learner) -> User:
        user = User(
            username=data.username,
            email=data.email,
            hashed_password=hash_password(data.password),
            role=role,
        )
        db.add(user)
        await db.flush()

        # Initialize progress for all 10 modules — module 1 starts as available
        for module_id in range(1, 11):
            status = ModuleStatus.available if module_id == 1 else ModuleStatus.locked
            progress = UserProgress(user_id=user.id, module_id=module_id, status=status)
            db.add(progress)

        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def authenticate(db: AsyncSession, username: str, password: str) -> Optional[User]:
        user = await UserService.get_by_username(db, username)
        if not user or not verify_password(password, user.hashed_password):
            return None
        return user

    @staticmethod
    async def update_gitea_token(db: AsyncSession, user_id: int, token: str) -> None:
        user = await UserService.get_by_id(db, user_id)
        if user:
            user.gitea_token = token
            await db.flush()
