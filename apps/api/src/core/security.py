import base64
import os
import uuid
from datetime import UTC, datetime, timedelta

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from jose import JWTError, jwt
from passlib.context import CryptContext

from src.core.config import settings

# --- Password Hashing ---

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# --- JWT Tokens ---


def create_access_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_mfa_pending_token(user_id: uuid.UUID) -> str:
    """Short-lived token (5 min) issued after password auth, before MFA verification."""
    expire = datetime.now(UTC) + timedelta(minutes=5)
    payload = {"sub": str(user_id), "exp": expire, "type": "mfa_pending"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_mfa_pending_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "mfa_pending":
            raise JWTError("Invalid token type — expected mfa_pending")
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid MFA token: {e}") from e


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "access":
            raise JWTError("Invalid token type")
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}") from e


def create_password_reset_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(UTC) + timedelta(hours=1)
    payload = {"sub": str(user_id), "exp": expire, "type": "password_reset"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_password_reset_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "password_reset":
            raise JWTError("Invalid token type")
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}") from e


# --- AES Encryption (for mfa_secret, Plaid tokens) ---

_ENCRYPTION_KEY: bytes | None = None


def _get_encryption_key() -> bytes:
    global _ENCRYPTION_KEY  # noqa: PLW0603
    if _ENCRYPTION_KEY is None:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            # Static salt is OK — key derivation, not password hashing
            salt=b"fynans-encryption-salt",
            iterations=100_000,
        )
        _ENCRYPTION_KEY = kdf.derive(settings.encryption_master_secret.encode())
    return _ENCRYPTION_KEY


def encrypt_value(plaintext: str) -> str:
    """Encrypt a string using AES-256-GCM. Returns base64-encoded nonce+ciphertext."""
    key = _get_encryption_key()
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ciphertext).decode()


def decrypt_value(encrypted: str) -> str:
    """Decrypt a base64-encoded AES-256-GCM string."""
    key = _get_encryption_key()
    raw = base64.b64decode(encrypted)
    nonce, ciphertext = raw[:12], raw[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None).decode()
