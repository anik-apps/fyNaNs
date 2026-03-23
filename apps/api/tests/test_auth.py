from unittest.mock import MagicMock

from src.schemas.auth import UserResponse


def test_user_response_is_dev_true():
    user = MagicMock()
    user.id = "00000000-0000-0000-0000-000000000001"
    user.email = "dev@example.com"
    user.name = "Dev"
    user.avatar_url = None
    user.mfa_secret = None
    resp = UserResponse.from_user(user, is_dev=True)
    assert resp.is_dev is True


def test_user_response_is_dev_false_by_default():
    user = MagicMock()
    user.id = "00000000-0000-0000-0000-000000000001"
    user.email = "normal@example.com"
    user.name = "Normal"
    user.avatar_url = None
    user.mfa_secret = None
    resp = UserResponse.from_user(user)
    assert resp.is_dev is False
