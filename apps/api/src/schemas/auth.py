import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    mfa_required: bool = False
    refresh_token: str | None = None  # Included in body for mobile clients
    mfa_token: str | None = None
    user: "UserResponse | None" = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None
    has_mfa: bool = False
    is_dev: bool = False

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user, is_dev: bool = False) -> "UserResponse":
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            has_mfa=user.mfa_secret is not None,
            is_dev=is_dev,
        )


class OAuthRequest(BaseModel):
    id_token: str


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class MFASetupResponse(BaseModel):
    secret: str
    otpauth_uri: str


class MFAConfirmRequest(BaseModel):
    code: str


class MFAVerifyRequest(BaseModel):
    code: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class PasswordSetRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class SessionResponse(BaseModel):
    id: uuid.UUID
    device_info: str
    created_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}
