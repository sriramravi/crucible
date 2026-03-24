from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Crucible"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-secret-key-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://crucible:crucible@localhost:5432/crucible"
    SYNC_DATABASE_URL: str = "postgresql://crucible:crucible@localhost:5432/crucible"

    # Gitea
    GITEA_URL: str = "http://localhost:3000"
    GITEA_ADMIN_TOKEN: str = "gitea-admin-token"
    GITEA_ADMIN_USER: str = "gitea_admin"

    # Jenkins
    JENKINS_URL: str = "http://localhost:8080"
    JENKINS_ADMIN_USER: str = "admin"
    JENKINS_ADMIN_PASSWORD: str = "admin"

    # Nexus
    NEXUS_URL: str = "http://localhost:8081"
    NEXUS_ADMIN_USER: str = "admin"
    NEXUS_ADMIN_PASSWORD: str = "admin123"

    # Docker
    DOCKER_SOCKET: str = "unix:///var/run/docker.sock"
    CONTAINER_NETWORK: str = "crucible_network"
    CONTAINER_PREFIX: str = "crucible_"

    # LocalStack
    LOCALSTACK_IMAGE: str = "localstack/localstack:latest"
    LOCALSTACK_PORT_START: int = 14566  # offset per user

    # ZAP
    ZAP_IMAGE: str = "ghcr.io/zaproxy/zaproxy:stable"
    JUICE_SHOP_URL: str = "http://juice-shop:3000"

    # Threat Dragon
    THREAT_DRAGON_IMAGE: str = "owasp/threat-dragon:latest"

    # InSpec target
    INSPEC_TARGET_IMAGE: str = "crucible/inspec-target:latest"

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3001", "http://localhost:3000"]

    class Config:
        env_file = ".env"


settings = Settings()
