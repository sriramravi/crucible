from fastapi import APIRouter
from app.api.routes import auth, progress, labs, admin

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(progress.router)
api_router.include_router(labs.router)
api_router.include_router(admin.router)
