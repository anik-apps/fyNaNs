from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    mfa_secret: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pending_mfa_secret: Mapped[str | None] = mapped_column(String(500), nullable=True)

    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete")
    settings = relationship(
        "UserSettings", back_populates="user", uselist=False, cascade="all, delete"
    )
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete")
