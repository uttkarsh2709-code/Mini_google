"""Build a Whoosh index from crawler output."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from whoosh import index
from whoosh.fields import ID, KEYWORD, TEXT, Schema
from whoosh.analysis import StemmingAnalyzer


SCHEMA = Schema(
    url=ID(stored=True, unique=True),
    title=TEXT(stored=True, analyzer=StemmingAnalyzer()),
    content=TEXT(stored=True, analyzer=StemmingAnalyzer()),
    outgoing_links=KEYWORD(stored=True, commas=True),
)


def load_documents(raw_path: Path) -> list[dict[str, str]]:
    documents: list[dict[str, str]] = []
    with raw_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            data = json.loads(line)
            documents.append(
                {
                    "url": data.get("url", ""),
                    "title": data.get("title", "Untitled"),
                    "content": data.get("text", ""),
                    "outgoing_links": ",".join(data.get("outgoing_links", [])),
                }
            )
    return documents


def build_index(raw_path: Path, index_dir: Path) -> None:
    index_dir.mkdir(parents=True, exist_ok=True)

    if index.exists_in(index_dir):
        idx = index.open_dir(index_dir)
    else:
        idx = index.create_in(index_dir, SCHEMA)

    documents = load_documents(raw_path)
    writer = idx.writer()
    for doc in documents:
        writer.update_document(**doc)
    writer.commit()
    print(f"Indexed {len(documents)} documents into {index_dir}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Whoosh search index")
    parser.add_argument(
        "--raw",
        type=Path,
        default=Path("../data/raw/pages.jsonl"),
        help="Path to crawler JSONL output",
    )
    parser.add_argument(
        "--index-dir",
        type=Path,
        default=Path("../data/index"),
        help="Index directory",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_index(args.raw, args.index_dir)


if __name__ == "__main__":
    main()
