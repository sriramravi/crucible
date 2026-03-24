from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime
from app.models.module import ModuleStatus, ChallengeStatus


class ProgressResponse(BaseModel):
    user_id: int
    module_id: int
    status: ModuleStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ChallengeAttemptResponse(BaseModel):
    id: int
    user_id: int
    module_id: int
    challenge_id: int
    status: ChallengeStatus
    attempt_count: int
    validation_output: Optional[Dict[str, Any]] = None
    passed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ValidationRequest(BaseModel):
    module_id: int
    challenge_id: int
    payload: Optional[Dict[str, Any]] = None


class ValidationResponse(BaseModel):
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None


class LabSessionResponse(BaseModel):
    id: int
    module_id: int
    container_id: Optional[str] = None
    container_name: Optional[str] = None
    container_port: Optional[int] = None
    container_host: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class QuizSubmission(BaseModel):
    module_id: int
    answers: Dict[int, Any]  # question_index -> answer


class QuizResultResponse(BaseModel):
    score: int
    max_score: int
    passed: bool
    correct_answers: Dict[int, Any]


class DashboardResponse(BaseModel):
    user_id: int
    username: str
    total_modules: int = 10
    completed_modules: int
    in_progress_modules: int
    overall_percentage: float
    module_progress: List[ProgressResponse]
    recent_activity: List[ChallengeAttemptResponse]
