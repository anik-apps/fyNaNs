import resend

from src.core.config import settings


def send_password_reset_email(to_email: str, reset_token: str) -> None:
    if not settings.resend_api_key:
        # Dev mode: log instead of sending
        print(
            f"[DEV] Password reset link: {settings.app_url}/reset-password?token={reset_token}"
        )
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
