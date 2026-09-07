"""Build a SQLite index from crawler output."""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import os
from pathlib import Path

# Add parent directory to python path to can import search_api
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from search_api.database import DB_PATH, init_db, publish_to_astra

def load_documents(raw_path: Path) -> list[dict[str, str]]:
    documents: list[dict[str, str]] = []
    if not raw_path.exists():
        print(f"⚠️ Warning: {raw_path} not found. Run crawler first.")
        return []
        
    with raw_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            try:
                data = json.loads(line)
                documents.append(
                    {
                        "url": data.get("url", ""),
                        "title": data.get("title", "Untitled"),
                        "content": data.get("text", ""),
                        "outgoing_links": ",".join(data.get("outgoing_links", [])),
                    }
                )
            except json.JSONDecodeError:
                continue
    return documents


def build_index(raw_path: Path) -> None:
    # 1. Initialize Database
    init_db()
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 2. Load Documents
    documents = load_documents(raw_path)
    if not documents:
        print("No documents found to index.")
        return

    # 3. Insert into SQLite (FTS)
    print(f"Indexing {len(documents)} documents into SQLite...")
    
    # Clear old data (optional: remove this if you want to append)
    c.execute("DELETE FROM pages")
    
    for doc in documents:
        # FTS insert
        c.execute(
            "INSERT INTO pages (url, title, content, outgoing_links) VALUES (?, ?, ?, ?)",
            (doc["url"], doc["title"], doc["content"], doc["outgoing_links"])
        )
        
    conn.commit()
    conn.close()
    try:
        published = publish_to_astra(documents)
        if published:
            print(f"✅ Published {published} pages to Astra DB")
    except Exception as exc:
        print(f"⚠️ Astra publish failed after local indexing: {exc}")
    print(f"✅ Successfully indexed {len(documents)} pages into minigoogle.db")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build SQLite index from crawled data")
    parser.add_argument("--data", "--raw", dest="data", type=Path, default=Path("data/raw/pages.jsonl"), help="Path to raw pages.jsonl")
    args = parser.parse_args()
    
    # Ensure path is absolute or correct relative to execution
    # If script runs from 'indexer', ../data/raw/pages.jsonl is likely needed if default is used
    # But usually run from root: python indexer/build_index.py
    
    build_index(args.data)
