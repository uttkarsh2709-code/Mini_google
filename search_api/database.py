import sqlite3
import os
from typing import Any

import requests
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from .mongodb import (
    init_mongodb,
    is_mongodb_available,
    mongo_clear_history,
    mongo_create_user,
    mongo_get_history,
    mongo_get_user,
    mongo_publish_pages,
    mongo_save_history,
    mongo_save_rating,
    mongo_search_pages,
)

# This will create minigoogle.db in the root folder (one level up from search_api)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "minigoogle.db")


def get_db_connection():
    """Returns a connection to the local SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Access columns by name
    return conn


def init_db():
    """Initialize both MongoDB (if configured) and SQLite fallback tables."""
    # 1. Try initializing MongoDB
    mongo_ready = init_mongodb()
    if mongo_ready:
        print("🍃 Primary Database: MongoDB active")
    else:
        print("🗄️ Primary Database: SQLite (minigoogle.db)")

    # 2. Initialize local SQLite tables for fallback & offline usage
    conn = get_db_connection()
    c = conn.cursor()
    
    # Full Text Search (FTS) table for pages
    c.execute('''
        CREATE VIRTUAL TABLE IF NOT EXISTS pages USING fts5(
            url,
            title,
            content,
            outgoing_links
        );
    ''')
    
    # Users table for authentication
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')

    # Ratings table
    c.execute('''
        CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
            feedback TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')

    # User history table
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            event_type TEXT NOT NULL CHECK (event_type IN ('search', 'chat')),
            query TEXT NOT NULL,
            title TEXT,
            url TEXT,
            response TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    c.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_history_email_created "
        "ON user_history (email, created_at DESC)"
    )
    
    conn.commit()
    conn.close()
    print(f"✅ Local SQLite initialized at: {DB_PATH}")


def get_active_db_info() -> dict[str, Any]:
    """Return status of database providers."""
    mongo_active = is_mongodb_available()
    return {
        "active_database": "mongodb" if mongo_active else "sqlite",
        "mongodb_connected": mongo_active,
        "sqlite_path": DB_PATH,
        "astra_enabled": astra_enabled(),
    }


# ==========================================
# Unified CRUD Functions (MongoDB with SQLite fallback)
# ==========================================

def get_user_by_email(email: str) -> dict[str, Any] | None:
    normalized_email = email.strip().casefold()
    if is_mongodb_available():
        user = mongo_get_user(normalized_email)
        if user:
            return {
                "id": str(user.get("_id", "")),
                "email": user["email"],
                "password_hash": user["password_hash"],
            }
        return None

    # SQLite fallback
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (normalized_email,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_user(email: str, password_hash: str) -> dict[str, Any]:
    normalized_email = email.strip().casefold()
    if is_mongodb_available():
        user = mongo_create_user(normalized_email, password_hash)
        return {"id": user.get("id") or user.get("_id"), "email": normalized_email}

    # SQLite fallback
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", (normalized_email, password_hash))
        conn.commit()
        return {"id": cursor.lastrowid, "email": normalized_email}
    finally:
        conn.close()


def save_user_history(
    email: str,
    event_type: str,
    query: str,
    title: str | None = None,
    url: str | None = None,
    response: str | None = None,
) -> dict[str, Any]:
    normalized_email = email.strip().casefold()
    if is_mongodb_available():
        return mongo_save_history(normalized_email, event_type, query, title, url, response)

    # SQLite fallback
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO user_history (email, event_type, query, title, url, response)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (normalized_email, event_type, query.strip(), title, url, response),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "message": "History saved"}
    finally:
        conn.close()


def get_user_history(email: str, limit: int = 100) -> list[dict[str, Any]]:
    normalized_email = email.strip().casefold()
    if is_mongodb_available():
        return mongo_get_history(normalized_email, limit)

    # SQLite fallback
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """SELECT id, event_type, query, title, url, response, created_at
               FROM user_history WHERE email = ?
               ORDER BY created_at DESC, id DESC LIMIT ?""",
            (normalized_email, limit),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def clear_user_history(email: str) -> int:
    normalized_email = email.strip().casefold()
    if is_mongodb_available():
        return mongo_clear_history(normalized_email)

    # SQLite fallback
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_history WHERE email = ?", (normalized_email,))
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()


def save_user_rating(email: str, stars: int, feedback: str | None = None) -> dict[str, Any]:
    if is_mongodb_available():
        return mongo_save_rating(email, stars, feedback)

    # SQLite fallback
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO ratings (email, stars, feedback) VALUES (?, ?, ?)",
            (email, stars, feedback),
        )
        conn.commit()
        return {"message": "Rating saved successfully"}
    finally:
        conn.close()


def search_indexed_pages(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search pages in MongoDB or SQLite FTS."""
    if is_mongodb_available():
        hits = mongo_search_pages(query, limit)
        if hits:
            return hits

    # SQLite FTS search
    hits: list[dict[str, Any]] = []
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT url, title, content FROM pages WHERE pages MATCH ? ORDER BY rank LIMIT ?",
            (query, limit),
        )
        rows = cursor.fetchall()
        for row in rows:
            hits.append({
                "url": row["url"],
                "title": row["title"],
                "content": row["content"],
            })
        conn.close()
    except Exception as exc:
        print(f"⚠️ SQLite search exception: {exc}")

    return hits


# ==========================================
# Astra DB Integration (Optional)
# ==========================================

def _astra_config() -> tuple[str, str, str, str] | None:
    endpoint = os.getenv("ASTRA_DB_API_ENDPOINT") or os.getenv("ASTRA_API_ENDPOINT")
    token = os.getenv("ASTRA_DB_APPLICATION_TOKEN") or os.getenv("ASTRA_API_KEY")
    namespace = os.getenv("ASTRA_DB_NAMESPACE", "default_keyspace")
    collection = os.getenv("ASTRA_DB_COLLECTION", "pages")
    if not endpoint or not token:
        return None
    return endpoint.rstrip("/"), token, namespace, collection


def astra_enabled() -> bool:
    return _astra_config() is not None


def astra_documents(limit: int) -> list[dict[str, Any]]:
    """Read indexed pages from an Astra DB JSON API collection."""
    config = _astra_config()
    if not config:
        return []

    endpoint, token, namespace, collection = config
    url = f"{endpoint}/api/json/v1/{namespace}/{collection}"
    response = requests.post(
        url,
        headers={"Token": token, "Content-Type": "application/json"},
        json={"find": {"filter": {}, "options": {"limit": limit}}},
        timeout=8,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("data", {}).get("documents", [])


def publish_to_astra(documents: list[dict[str, Any]]) -> int:
    """Publish crawled pages to Astra; return the number accepted by Astra."""
    config = _astra_config()
    if not config:
        return 0

    endpoint, token, namespace, collection = config
    url = f"{endpoint}/api/json/v1/{namespace}/{collection}"
    accepted = 0
    for document in documents:
        response = requests.post(
            url,
            headers={"Token": token, "Content-Type": "application/json"},
            json=document,
            timeout=8,
        )
        if response.status_code in (200, 201):
            accepted += 1
        elif response.status_code != 409:
            response.raise_for_status()
    return accepted


if __name__ == "__main__":
    init_db()
