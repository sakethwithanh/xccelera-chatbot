# Vercel Python serverless entry. The @vercel/python runtime detects the
# ASGI `app` object and serves it. Locally, run uvicorn app.main:app instead.
from app.main import app  # noqa: F401
