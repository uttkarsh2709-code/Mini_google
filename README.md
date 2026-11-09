# Mini Google

A mini search engine that crawls the web, indexes pages locally and in MongoDB, exposes a search and AI chat API, and ships with a clean Google-inspired frontend.

## Project Layout

```
Mini google/
├── crawler/
│   └── crawler.py               # Web crawler
├── data/
│   ├── index/                   # Local index data
│   └── raw/pages.jsonl          # Raw crawled pages
├── frontend/
│   ├── app.js                   # Client logic (search, AI chat, auth, history, ratings)
│   ├── index.html               # Main user interface
│   ├── styles.css               # Search engine styling
│   └── avatar.css               # Profile avatar styling
├── indexer/
│   └── build_index.py           # Indexer (MongoDB, SQLite, Astra DB)
├── search_api/                  # Primary Backend (FastAPI + Python)
│   ├── database.py              # Unified database layer (MongoDB + SQLite fallback)
│   ├── mongodb.py               # MongoDB collections, indexes & CRUD
│   └── main.py                  # API endpoints & AI integration (Gemini / Groq)
├── backend_node/                # Alternative Backend (Node.js + Express + Mongoose)
│   ├── models/                  # Mongoose schemas (User, History, Rating, Page)
│   ├── server.js                # Express REST API server
│   └── package.json
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment variables template
└── README.md
```

---

## 🍃 MongoDB Database Setup

Mini Google uses **MongoDB** to store:
- **`users`**: User authentication accounts (`email`, `password_hash`, `created_at`).
- **`user_history`**: Recent searches and AI chat interactions.
- **`ratings`**: Star ratings and user feedback.
- **`pages`**: Crawled web pages with full-text search indexing (`$text` on `title` and `content`).

### Configure Connection

Add your MongoDB connection string in `.env`:

```env
# For local MongoDB:
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=minigoogle

# Or for MongoDB Atlas Cloud:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
# MONGODB_DB_NAME=minigoogle
```

> **Note**: If MongoDB is not running or the URI is omitted, the backend automatically falls back to local SQLite (`minigoogle.db`), so the application never crashes!

---

## 🚀 Running the Backend

You can run either the **Python FastAPI** backend or the **Node.js Express** backend. Both are 100% compatible with the frontend on port `8000`.

### Option A: Python FastAPI Backend (Recommended)

1. **Activate your environment & install dependencies**:
   ```cmd
   pip install -r requirements.txt
   ```

2. **Start the API server**:
   ```cmd
   uvicorn search_api.main:app --reload --port 8000
   ```

3. The API is live at `http://127.0.0.1:8000`. Test the health check:
   - Visit `http://127.0.0.1:8000/` to verify MongoDB status.

---

### Option B: Node.js Express Backend

If you prefer Node.js with Mongoose:

1. **Install dependencies**:
   ```cmd
   cd backend_node
   npm install
   ```

2. **Run server**:
   ```cmd
   npm start
   ```
   The Node.js server will run on `http://127.0.0.1:8000`.

---

## 🌐 Launch the Frontend

Serve the static files using any HTTP server:

```cmd
python -m http.server 8080 --directory frontend
```

Open your browser to:
👉 `http://127.0.0.1:8080`

The frontend automatically connects to the backend running at `http://127.0.0.1:8000`.

---

## 🕷️ Crawling & Indexing Pages into MongoDB

1. **Crawl pages**:
   ```cmd
   python crawler\crawler.py --seed https://example.com --limit 40 --out data/raw/pages.jsonl
   ```

2. **Index pages into MongoDB & SQLite**:
   ```cmd
   python indexer\build_index.py --raw data/raw/pages.jsonl
   ```
   This automatically inserts documents into the MongoDB `pages` collection and creates a text search index!
