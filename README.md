# Mini Google

A beginner-friendly mini search engine that crawls the web, indexes pages locally in SQLite, optionally publishes them to Astra DB, exposes a FastAPI search endpoint, and ships with a clean Google-inspired frontend.

## Project Layout

```
Mini google/
├── crawler/
│   └── crawler.py
├── data/
│   ├── index/              # Whoosh index (created after indexing)
│   └── raw/                # JSONL pages from the crawler
├── frontend/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── indexer/
│   └── build_index.py
├── search_api/
│   ├── __init__.py
│   └── main.py
├── requirements.txt
└── README.md
```

## 1. Environment Setup

```cmd
cd "c:\Users\uttkarsh raj\OneDrive\Desktop\Mini google"
python -m venv .venv
.\.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 2. Crawl Pages

Use any public site you are allowed to crawl. The crawler stays within the provided host by default.

```cmd
python crawler\crawler.py --seed https://example.com --limit 40 --out data/raw/pages.jsonl
```

Options:
- `--seed` (repeatable): starting URLs.
- `--limit`: max number of pages.
- `--delay`: polite delay between requests.
- `--same-domain` / `--no-same-domain`: stay within the seed domains or not.

## 3. Build the Search Index

Transform the JSONL output into the local SQLite FTS index and, when Astra is configured, publish the same pages to an Astra DB JSON API collection.

```cmd
python indexer\build_index.py --raw data/raw/pages.jsonl --index-dir data/index
```

You can re-run this command whenever new crawl data is available.

## 4. Configure Astra DB (optional but recommended)

Create an Astra DB collection named `pages`, then add these values to `.env`:

```text
ASTRA_DB_API_ENDPOINT=https://your-database-id-region.apps.astra.datastax.com
ASTRA_DB_APPLICATION_TOKEN=your-astra-application-token
ASTRA_DB_NAMESPACE=default_keyspace
ASTRA_DB_COLLECTION=pages
```

The indexer publishes documents to Astra when these values are present. Search reads Astra first and falls back to local SQLite and DuckDuckGo if Astra is unavailable.

## 5. Run the FastAPI Search Service

```cmd
uvicorn search_api.main:app --app-dir . --reload --port 8000
```

- Endpoint: `GET /search?query=your+terms&limit=10`
- Ranking: BM25 over title + body with snippet highlights.

## 6. Launch the Frontend

Serve the static files using any HTTP server (Live Server extension or Python's built-in server). Example:

```cmd
python -m http.server 8080 --directory frontend
```

Visit `http://127.0.0.1:8080` and issue queries—the page fetches results from `http://127.0.0.1:8000/search`.

## How It Works

1. **Crawler** collects URL, title, cleaned text, and outgoing links into `data/raw/pages.jsonl`.
2. **Indexer** stores the JSONL in SQLite FTS and optionally publishes it to Astra DB.
3. **FastAPI** queries Astra first, then local FTS and DuckDuckGo, and returns ranked documents with snippets.
4. **Frontend** mimics Google's minimalist UI and calls the API to render result cards with title, URL, and snippet.

## Tips

- Adjust the crawler delay if you see throttling; never crawl sites that disallow it via `robots.txt` (basic respect even though this sample ignores robots).
- Re-index after every crawl to keep search results fresh.
- To change the frontend API endpoint, modify `API_BASE` inside `frontend/app.js`.
