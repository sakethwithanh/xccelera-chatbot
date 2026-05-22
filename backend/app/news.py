"""AI news ingestion from public RSS feeds (no API key needed)."""

import asyncio
import html
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import feedparser

from . import db

FEEDS = [
    ("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("The Verge AI", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
    ("arXiv cs.AI", "http://export.arxiv.org/rss/cs.AI"),
    ("Google AI Blog", "https://blog.google/technology/ai/rss/"),
    ("MIT Tech Review AI", "https://www.technologyreview.com/topic/artificial-intelligence/feed"),
]
PER_FEED = 12
_TAG = re.compile(r"<[^>]+>")


def _clean(text: str | None) -> str:
    if not text:
        return ""
    # Strip HTML tags, then decode entities (&#8217; &amp; &nbsp; ...).
    return html.unescape(_TAG.sub("", text)).replace("\xa0", " ").strip()


def _published(entry) -> str:
    for key in ("published", "updated"):
        val = entry.get(key)
        if val:
            try:
                return parsedate_to_datetime(val).astimezone(
                    timezone.utc
                ).isoformat()
            except Exception:  # noqa: BLE001
                pass
    return datetime.now(timezone.utc).isoformat()


def _fetch_sync() -> list[dict]:
    rows: list[dict] = []
    for source, url in FEEDS:
        try:
            feed = feedparser.parse(url)
        except Exception:  # noqa: BLE001
            continue
        for e in feed.entries[:PER_FEED]:
            link = e.get("link")
            title = _clean(e.get("title"))
            if not link or not title:
                continue
            summary = _clean(e.get("summary") or e.get("description"))[:1200]
            rows.append(
                {
                    "title": title[:400],
                    "url": link,
                    "source": source,
                    "summary": summary,
                    "content": summary,
                    "published_at": _published(e),
                }
            )
    return rows


async def refresh() -> dict:
    rows = await asyncio.to_thread(_fetch_sync)
    inserted = await db.upsert_articles(rows)
    return {"fetched": len(rows), "inserted": inserted}
