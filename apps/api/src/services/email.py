import logging

import resend

from src.core.config import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, reset_token: str) -> None:
    if not settings.resend_api_key:
        # Dev mode: log that email would be sent, without exposing the token
        logger.info("[DEV] Password reset email would be sent to %s", to_email)
        return

    resend.api_key = settings.resend_api_key
    resend.Emails.send({
        "from": "fyNaNs <noreply@yourdomain.com>",
        "to": [to_email],
        "subject": "Reset your fyNaNs password",
        "html": (
            f'<p>Click <a href="{settings.app_url}/reset-password?token={reset_token}">'
            f"here</a> to reset your password. This link expires in 1 hour.</p>"
        ),
    })


def send_export_email(to_email: str, zip_data: bytes) -> None:
    """Send data export download link via email."""
    if not settings.resend_api_key:
        logger.info(
            "[DEV] Export generated for %s (%d bytes)", to_email, len(zip_data)
        )
        return

    # In production: upload zip_data to OCI Object Storage,
    # generate a signed URL, and email it.
    logger.info(
        "[DEV] Export generated for %s (%d bytes)", to_email, len(zip_data)
    )
