from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class SessionOut(BaseModel):
    id: str
    title: str | None
    created_at: datetime


class MessageOut(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ChatRequest(BaseModel):
    session_id: str
    message: str = Field(min_length=1, max_length=8000)


class ChatResponse(BaseModel):
    session_id: str
    reply: str


class NewsOut(BaseModel):
    id: str
    title: str
    url: str
    source: str | None
    summary: str | None
    published_at: datetime | None


class SettingsIn(BaseModel):
    gemini_api_key: str | None = Field(default=None, max_length=200)


class SettingsOut(BaseModel):
    has_key: bool
    updated_at: datetime | None = None


class UsageOut(BaseModel):
    free_messages_used: int
    free_limit: int
    has_key: bool
