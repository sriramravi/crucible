from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, JSON, Enum, func
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class ModuleStatus(str, enum.Enum):
    locked = "locked"
    available = "available"
    in_progress = "in_progress"
    completed = "completed"


class ChallengeStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    passed = "passed"
    failed = "failed"


class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(Integer, nullable=False)  # 1-10
    status = Column(Enum(ModuleStatus), default=ModuleStatus.locked, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="progress")


class ChallengeAttempt(Base):
    __tablename__ = "challenge_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(Integer, nullable=False)
    challenge_id = Column(Integer, nullable=False)  # challenge index within module
    status = Column(Enum(ChallengeStatus), default=ChallengeStatus.not_started, nullable=False)
    attempt_count = Column(Integer, default=0)
    validation_output = Column(JSON, nullable=True)
    passed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="challenge_attempts")


class LabSession(Base):
    __tablename__ = "lab_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(Integer, nullable=False)
    container_id = Column(String(128), nullable=True)
    container_name = Column(String(256), nullable=True)
    container_port = Column(Integer, nullable=True)
    container_host = Column(String(256), nullable=True)
    status = Column(String(32), default="pending")  # pending, running, stopped, error
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    stopped_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")


class QuizResult(Base):
    __tablename__ = "quiz_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(Integer, nullable=False)
    score = Column(Integer, nullable=False)
    max_score = Column(Integer, nullable=False)
    answers = Column(JSON, nullable=True)
    passed = Column(Boolean, default=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
