from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    gemini_api_key: str
    gemini_api_key_fallback: str | None = None
    gemini_model: str = "gemini-2.5-flash"

    @property
    def gemini_keys(self) -> list[str]:
        keys = [self.gemini_api_key]
        if self.gemini_api_key_fallback:
            keys.append(self.gemini_api_key_fallback)
        return keys

    supabase_url: str
    supabase_service_key: str
    supabase_db_url: str

    history_limit: int = 20
    cors_origins: str = "http://localhost:5173"
    cron_secret: str | None = None
    free_message_limit: int = 10

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
