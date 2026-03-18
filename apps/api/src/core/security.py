from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# --- AES Encryption (for mfa_secret, Plaid tokens) ---
import base64
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from src.core.config import settings

_ENCRYPTION_KEY: bytes | None = None


def _get_encryption_key() -> bytes:
    global _ENCRYPTION_KEY  # noqa: PLW0603
    if _ENCRYPTION_KEY is None:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"fynans-encryption-salt",  # Static salt is OK — key derivation, not password hashing
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
