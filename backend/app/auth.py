"""Supabase JWT auth dependency.

The frontend authenticates directly with Supabase Auth (public anon key) and
sends the resulting access token as `Authorization: Bearer <jwt>`. We validate
it server-side via Supabase and resolve the user id.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import verify_token

_bearer = HTTPBearer(auto_error=True)


async def current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    user_id = await verify_token(creds.credentials)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return user_id
