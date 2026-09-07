import sqlite3
import os
from typing import Any

import requests

# This will create minigoogle.db in the root folder (one level up from search_api)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "minigoogle.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Access columns by name
    return conn

def init_db():
    """Create the tables if they don't exist."""
    conn = get_db_connection()
    c = conn.cursor()
    
    # 1. Create Full Text Search (FTS) table for pages
    # This replaces Whoosh for searching
    c.execute('''
        CREATE VIRTUAL TABLE IF NOT EXISTS pages USING fts5(
            url,
            title,
            content,
            outgoing_links
        );
    ''')
    
    # 2. Create Users table for authentication
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
            feedback TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')

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
    print(f"✅ Database initialized at: {DB_PATH}")


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
