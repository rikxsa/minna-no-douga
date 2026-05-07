#!/usr/bin/env python3
"""Fetch each friend's liked YouTube videos and merge into data/videos.json.

Reads:
  - data/users.json          : list of {id, name}
  - GOOGLE_CLIENT_ID         : env
  - GOOGLE_CLIENT_SECRET     : env
  - USER_<ID>_REFRESH_TOKEN  : env, one per user (id is upper-cased)

Writes:
  - data/videos.json         : merged & sorted
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
USERS_PATH = DATA_DIR / "users.json"
VIDEOS_PATH = DATA_DIR / "videos.json"

TOKEN_URL = "https://oauth2.googleapis.com/token"
LIKED_URL = "https://www.googleapis.com/youtube/v3/videos"

# 20 pages * 50 results = 1000 videos cap per user. Plenty for a friend group.
MAX_PAGES = int(os.environ.get("MAX_PAGES", "20"))
PAGE_SIZE = 50


def env_required(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        print(f"ERROR: missing env var {name}", file=sys.stderr)
        sys.exit(1)
    return val


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    resp = requests.post(
        TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    if not resp.ok:
        # Surface useful info without leaking the token itself.
        raise RuntimeError(
            f"token refresh failed ({resp.status_code}): {resp.text[:300]}"
        )
    return resp.json()["access_token"]


def fetch_user_likes(access_token: str) -> list[dict]:
    """Return liked videos (most-recent first), paginated up to MAX_PAGES."""
    items: list[dict] = []
    page_token: str | None = None
    headers = {"Authorization": f"Bearer {access_token}"}

    for _ in range(MAX_PAGES):
        params = {
            "part": "snippet,contentDetails,statistics",
            "myRating": "like",
            "maxResults": PAGE_SIZE,
        }
        if page_token:
            params["pageToken"] = page_token

        resp = requests.get(LIKED_URL, headers=headers, params=params, timeout=30)
        if not resp.ok:
            raise RuntimeError(
                f"videos.list failed ({resp.status_code}): {resp.text[:300]}"
            )
        data = resp.json()
        items.extend(data.get("items", []))

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return items


def best_thumbnail(thumbs: dict) -> str:
    for key in ("medium", "high", "standard", "maxres", "default"):
        if key in thumbs and thumbs[key].get("url"):
            return thumbs[key]["url"]
    return ""


def normalize_video(item: dict) -> dict:
    snippet = item.get("snippet", {}) or {}
    content = item.get("contentDetails", {}) or {}
    stats = item.get("statistics", {}) or {}
    video_id = item.get("id", "")
    view_count = stats.get("viewCount")
    try:
        view_count_int = int(view_count) if view_count is not None else None
    except (TypeError, ValueError):
        view_count_int = None
    return {
        "videoId": video_id,
        "title": snippet.get("title", ""),
        "channel": snippet.get("channelTitle", ""),
        "publishedAt": snippet.get("publishedAt", ""),
        "duration": content.get("duration", ""),     # ISO 8601 (e.g. PT4M13S)
        "viewCount": view_count_int,
        "thumbnail": best_thumbnail(snippet.get("thumbnails", {}) or {}),
        "url": f"https://www.youtube.com/watch?v={video_id}",
    }


def now_iso(offset_seconds: int = 0) -> str:
    t = datetime.now(timezone.utc) - timedelta(seconds=offset_seconds)
    return t.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_existing() -> dict[str, dict]:
    if not VIDEOS_PATH.exists():
        return {}
    try:
        data = json.loads(VIDEOS_PATH.read_text())
        return {v["videoId"]: v for v in data if v.get("videoId")}
    except Exception as e:
        print(f"warn: could not read existing videos.json: {e}", file=sys.stderr)
        return {}


def main() -> int:
    users = json.loads(USERS_PATH.read_text())
    if not users:
        print("ERROR: data/users.json is empty", file=sys.stderr)
        return 1

    client_id = env_required("GOOGLE_CLIENT_ID")
    client_secret = env_required("GOOGLE_CLIENT_SECRET")

    valid_user_ids = {u["id"] for u in users}
    merged: dict[str, dict] = {vid: dict(rec) for vid, rec in load_existing().items()}

    # 1) Fetch each user's current likes. Track who succeeded so we only
    #    apply removals for users whose data is fresh.
    user_likes: dict[str, list[dict]] = {}
    successful: set[str] = set()

    for user in users:
        uid = user["id"]
        token_var = f"USER_{uid.upper()}_REFRESH_TOKEN"
        refresh_token = os.environ.get(token_var)
        if not refresh_token:
            print(f"skip: {uid}: env {token_var} is not set", file=sys.stderr)
            continue

        try:
            access_token = refresh_access_token(
                client_id, client_secret, refresh_token
            )
            items = fetch_user_likes(access_token)
        except Exception as e:
            # Most common: refresh token expired (testing-mode 7-day expiry).
            print(f"error: {uid}: {e}", file=sys.stderr)
            continue

        user_likes[uid] = items
        successful.add(uid)
        print(f"ok: {uid}: {len(items)} liked videos fetched")

    # 2) Drop unknown users from any existing likedBy lists (in case
    #    someone left and was removed from users.json).
    for vid, rec in list(merged.items()):
        rec["likedBy"] = [u for u in rec.get("likedBy", []) if u in valid_user_ids]
        if not rec["likedBy"]:
            merged.pop(vid)

    # 3) For each successfully-fetched user, remove videos they no
    #    longer like (i.e., un-liked since last run).
    for uid in successful:
        current_ids = {item.get("id") for item in user_likes[uid] if item.get("id")}
        for vid, rec in list(merged.items()):
            if uid in rec.get("likedBy", []) and vid not in current_ids:
                rec["likedBy"] = [u for u in rec["likedBy"] if u != uid]
                if not rec["likedBy"]:
                    merged.pop(vid)

    # 4) Add new likes. The API returns most-recent-liked first, so we
    #    stagger timestamps by 1 second to preserve relative order on
    #    first discovery.
    for uid in successful:
        for idx, item in enumerate(user_likes[uid]):
            vid = item.get("id")
            if not vid:
                continue
            if vid in merged:
                rec = merged[vid]
                if uid not in rec.get("likedBy", []):
                    rec.setdefault("likedBy", []).append(uid)
                    rec["likedAt"] = now_iso(offset_seconds=idx)
            else:
                rec = normalize_video(item)
                rec["likedBy"] = [uid]
                rec["likedAt"] = now_iso(offset_seconds=idx)
                merged[vid] = rec

    # 5) Sort by most-recent like for stable, diff-friendly output.
    out = sorted(
        merged.values(),
        key=lambda v: v.get("likedAt", ""),
        reverse=True,
    )

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    VIDEOS_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"done: {len(out)} videos -> {VIDEOS_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
