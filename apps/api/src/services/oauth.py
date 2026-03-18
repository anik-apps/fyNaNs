import httpx

from src.core.config import settings


class OAuthError(Exception):
    def __init__(self, message: str):
        self.message = message


async def verify_google_token(id_token: str) -> dict:
    """Verify Google ID token and return user info."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        )
    if response.status_code != 200:
        raise OAuthError("Invalid Google token")

    data = response.json()
    if data.get("aud") != settings.google_client_id:
        raise OAuthError("Token not intended for this application")

    return {
        "provider": "google",
        "provider_id": data["sub"],
        "email": data["email"],
        "name": data.get("name", data["email"].split("@")[0]),
    }


async def verify_oauth_token(provider: str, id_token: str) -> dict:
    """Route to the appropriate provider verification."""
    if provider == "google":
        return await verify_google_token(id_token)
    # Apple OAuth would go here
    raise OAuthError(f"Unsupported provider: {provider}")
