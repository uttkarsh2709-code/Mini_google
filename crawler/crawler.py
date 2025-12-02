"""Simple web crawler for the Mini Google project.

Usage example:
    python crawler.py --seed https://example.com --limit 30 --out ../data/raw/pages.jsonl
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
from collections import deque
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Set

import requests
from bs4 import BeautifulSoup


@dataclass
class PageDocument:
    """Structured representation of a crawled HTML page."""

    url: str
    title: str
    text: str
    outgoing_links: list[str]


class MiniCrawler:
    """Small breadth-first crawler with polite delay and domain filtering."""

    def __init__(
        self,
        seeds: Iterable[str],
        limit: int = 50,
        delay: float = 1.0,
        same_domain_only: bool = True,
    ) -> None:
        self.queue = deque(_normalize_url(url) for url in seeds)
        self.visited: Set[str] = set()
        self.limit = limit
        self.delay = delay
        self.same_domain_only = same_domain_only
        self.allowed_domains = {urllib.parse.urlparse(url).netloc for url in self.queue}

    def crawl(self) -> Iterable[PageDocument]:
        """Yield PageDocument objects until the limit is reached."""

        while self.queue and len(self.visited) < self.limit:
            url = self.queue.popleft()
            if url in self.visited:
                continue

            try:
                response = requests.get(url, timeout=10)
                response.raise_for_status()
            except requests.RequestException:
                continue

            soup = BeautifulSoup(response.text, "html.parser")
            title = soup.title.string.strip() if soup.title and soup.title.string else url
            text = _extract_visible_text(soup)
            links = self._extract_links(soup, url)

            doc = PageDocument(url=url, title=title, text=text, outgoing_links=links)
            self.visited.add(url)
            yield doc

            for link in links:
                if link not in self.visited:
                    self.queue.append(link)

            time.sleep(self.delay)

    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        links: list[str] = []
        for tag in soup.find_all("a", href=True):
            href = _normalize_url(urllib.parse.urljoin(base_url, tag["href"]))
            if not href.startswith("http"):
                continue
            if self.same_domain_only and urllib.parse.urlparse(href).netloc not in self.allowed_domains:
                continue
            links.append(href)
        return links


def _normalize_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    normalized = parsed._replace(fragment="")
    return normalized.geturl()


def _extract_visible_text(soup: BeautifulSoup) -> str:
    for unwanted in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        unwanted.decompose()
    text = soup.get_text(separator=" ")
    return " ".join(text.split())


def save_documents(docs: Iterable[PageDocument], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        for doc in docs:
            fh.write(json.dumps(asdict(doc), ensure_ascii=False) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mini Google web crawler")
    parser.add_argument("--seed", action="append", required=True, help="Seed URL (repeatable)")
    parser.add_argument("--limit", type=int, default=30, help="Maximum number of pages to crawl")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between requests in seconds")
    parser.add_argument(
        "--same-domain", action=argparse.BooleanOptionalAction, default=True, help="Stay within seed domains"
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("../data/raw/pages.jsonl"),
        help="Where to write JSONL output",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    crawler = MiniCrawler(args.seed, limit=args.limit, delay=args.delay, same_domain_only=args.same_domain)
    docs = list(crawler.crawl())
    save_documents(docs, args.out)
    print(f"Crawled {len(docs)} pages -> {args.out}")


if __name__ == "__main__":
    main()
