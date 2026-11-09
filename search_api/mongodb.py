"""MongoDB database client and collections management for Mini Google."""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Fallback: manually parse .env if dotenv package is not installed
def _ensure_env_loaded():
    env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key and key not in os.environ:
                        os.environ[key] = val
        except Exception:
            pass

_ensure_env_loaded()

try:
    import pymongo
    from pymongo.errors import ConnectionFailure, DuplicateKeyError, ServerSelectionTimeoutError
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False
    pymongo = None  # type: ignore

_client: Any = None
_db: Any = None
_is_connected: bool | None = None


def get_mongo_uri() -> str | None:
    """Return MongoDB connection URI from environment."""
    return os.getenv("MONGO_URI") or os.getenv("MONGODB_URI")


def get_mongo_db_name() -> str:
    """Return MongoDB database name."""
    return os.getenv("MONGODB_DB_NAME", "minigoogle")


def _has_placeholder(uri: str) -> bool:
    return any(p in uri for p in ("<db_username>", "<password>", "<db_password>", "<username>"))


def is_mongodb_configured() -> bool:
    """Check if MongoDB URI is set and not using unreplaced placeholders."""
    uri = get_mongo_uri()
    if not uri:
        return False
    return not _has_placeholder(uri)


def get_mongo_client():
    """Get or create singleton PyMongo client."""
    global _client, _db, _is_connected
    if not PYMONGO_AVAILABLE:
        return None

    uri = get_mongo_uri()
    if not uri:
        return None

    if _has_placeholder(uri):
        print("⚠️ MongoDB notice: Atlas URI in .env still has placeholder (e.g. '<db_password>').")
        print("   Replace '<db_password>' with your actual database password in .env to connect.")
        return None

    if _client is None:
        try:
            # Set short serverSelectionTimeoutMS so we fail fast if MongoDB is down
            _client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=2500)
            # Ping database to confirm connection
            _client.admin.command("ping")
            _is_connected = True
            db_name = get_mongo_db_name()
            _db = _client[db_name]
            print(f"✅ Connected to MongoDB ({db_name}) at {uri.split('@')[-1] if '@' in uri else uri}")
        except Exception as exc:
            _is_connected = False
            _client = None
            _db = None
            print(f"⚠️ MongoDB connection failed: {exc}. Falling back to SQLite.")
            return None

    return _client


def get_mongo_db():
    """Return MongoDB database instance or None."""
    global _db
    if _db is not None:
        return _db
    client = get_mongo_client()
    if client is not None:
        return _db
    return None


def is_mongodb_available() -> bool:
    """Check if MongoDB client is available and active."""
    return get_mongo_db() is not None


def init_mongodb() -> bool:
    """Initialize MongoDB collections and indexes."""
    db = get_mongo_db()
    if db is None:
        return False

    try:
        # 1. Users collection
        db.users.create_index("email", unique=True)

        # 2. History collection
        db.user_history.create_index([("email", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)])

        # 3. Ratings collection
        db.ratings.create_index([("email", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)])

        # 4. Pages collection (for web search index)
        db.pages.create_index("url", unique=True)
        # Create full-text search index on title and content
        db.pages.create_index([("title", pymongo.TEXT), ("content", pymongo.TEXT)], name="text_search_index")

        print("✅ MongoDB collections & indexes initialized.")
        return True
    except Exception as exc:
        print(f"⚠️ MongoDB index initialization warning: {exc}")
        return False


# User Authentication
def mongo_get_user(email: str) -> dict[str, Any] | None:
    db = get_mongo_db()
    if db is None:
        return None
    return db.users.find_one({"email": email.strip().casefold()})


def mongo_create_user(email: str, password_hash: str) -> dict[str, Any]:
    db = get_mongo_db()
    if db is None:
        raise RuntimeError("MongoDB not available")

    doc = {
        "email": email.strip().casefold(),
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.users.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


# User Search & Chat History
def mongo_save_history(
    email: str,
    event_type: str,
    query: str,
    title: str | None = None,
    url: str | None = None,
    response: str | None = None,
) -> dict[str, Any]:
    db = get_mongo_db()
    if db is None:
        raise RuntimeError("MongoDB not available")

    doc = {
        "email": email.strip().casefold(),
        "event_type": event_type,
        "query": query.strip(),
        "title": title,
        "url": url,
        "response": response,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.user_history.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc


def mongo_get_history(email: str, limit: int = 100) -> list[dict[str, Any]]:
    db = get_mongo_db()
    if db is None:
        return []

    cursor = (
        db.user_history.find({"email": email.strip().casefold()})
        .sort("created_at", pymongo.DESCENDING)
        .limit(limit)
    )

    items: list[dict[str, Any]] = []
    for item in cursor:
        items.append({
            "id": str(item.get("_id", "")),
            "event_type": item.get("event_type", "search"),
            "query": item.get("query", ""),
            "title": item.get("title"),
            "url": item.get("url"),
            "response": item.get("response"),
            "created_at": item.get("created_at"),
        })
    return items


def mongo_clear_history(email: str) -> int:
    db = get_mongo_db()
    if db is None:
        return 0
    result = db.user_history.delete_many({"email": email.strip().casefold()})
    return result.deleted_count


# Ratings
def mongo_save_rating(email: str, stars: int, feedback: str | None = None) -> dict[str, Any]:
    db = get_mongo_db()
    if db is None:
        raise RuntimeError("MongoDB not available")

    doc = {
        "email": email.strip(),
        "stars": stars,
        "feedback": feedback,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.ratings.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


# Crawled Pages Search & Index
def mongo_search_pages(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search crawled pages using MongoDB text index or regex fallback."""
    db = get_mongo_db()
    if db is None:
        return []

    results: list[dict[str, Any]] = []

    # 1. Try text index search first
    try:
        cursor = (
            db.pages.find(
                {"$text": {"$search": query}},
                {"score": {"$meta": "textScore"}, "url": 1, "title": 1, "content": 1},
            )
            .sort([("score", {"$meta": "textScore"})])
            .limit(limit)
        )
        for doc in cursor:
            results.append({
                "url": doc.get("url", ""),
                "title": doc.get("title", "Untitled"),
                "content": doc.get("content", ""),
            })
    except Exception as exc:
        print(f"⚠️ MongoDB text search error, trying regex: {exc}")

    # 2. Regex fallback if text search returned nothing
    if not results:
        terms = [re.escape(t) for t in query.split() if t]
        if terms:
            regex_pattern = "|".join(terms)
            cursor = (
                db.pages.find({
                    "$or": [
                        {"title": {"$regex": regex_pattern, "$options": "i"}},
                        {"content": {"$regex": regex_pattern, "$options": "i"}},
                    ]
                })
                .limit(limit)
            )
            for doc in cursor:
                results.append({
                    "url": doc.get("url", ""),
                    "title": doc.get("title", "Untitled"),
                    "content": doc.get("content", ""),
                })

    return results


def mongo_publish_pages(documents: list[dict[str, Any]]) -> int:
    """Upsert crawled pages into MongoDB pages collection."""
    db = get_mongo_db()
    if db is None or not documents:
        return 0

    inserted_or_updated = 0
    for doc in documents:
        url = doc.get("url")
        if not url:
            continue
        db.pages.update_one(
            {"url": url},
            {
                "$set": {
                    "url": url,
                    "title": doc.get("title", "Untitled"),
                    "content": doc.get("content", ""),
                    "outgoing_links": doc.get("outgoing_links", ""),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True,
        )
        inserted_or_updated += 1

    return inserted_or_updated
