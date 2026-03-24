from sqlalchemy import Column, Integer, String, Enum, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    learner = "learner"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(256), unique=True, nullable=False, index=True)
    hashed_password = Column(String(256), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.learner, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    gitea_token = Column(String(256), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    progress = relationship("UserProgress", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("LabSession", back_populates="user", cascade="all, delete-orphan")
    challenge_attempts = relationship("ChallengeAttempt", back_populates="user", cascade="all, delete-orphan")
