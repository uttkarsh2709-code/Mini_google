# Mini Google - Node.js + MongoDB Backend

This is an optional Node.js Express backend using MongoDB and Mongoose. It exposes the exact same API endpoints as the Python FastAPI backend, perfectly compatible with `frontend/app.js`.

## Prerequisites
- Node.js (v18+)
- MongoDB (Running locally on `mongodb://localhost:27017` or a free MongoDB Atlas cloud cluster)

## Setup & Running

1. **Install dependencies**:
   ```bash
   cd backend_node
   npm install
   ```

2. **Configure MongoDB**:
   In the root `.env` file (or a `.env` in this folder), set:
   ```env
   MONGODB_URI=mongodb://localhost:27017/minigoogle
   # Or for Atlas:
   # MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/minigoogle?retryWrites=true&w=majority
   ```

3. **Start the server**:
   ```bash
   npm start
   ```
   The server will run on `http://127.0.0.1:8000`.

## Endpoints Provided
- `GET /` - Health check & MongoDB connection status
- `GET /providers` - AI model availability (Groq & Gemini)
- `POST /auth/signup` - User registration stored in MongoDB
- `POST /auth/login` - User login verified against MongoDB
- `POST /history` - Save search / chat event in MongoDB
- `GET /history?email=...` - Retrieve user search & chat history
- `DELETE /history?email=...` - Clear user history
- `POST /rating` - Save user feedback & ratings in MongoDB
- `GET /search?query=...` - Full-text search over indexed pages with DuckDuckGo fallback
- `POST /chat` - AI chat with Groq & Gemini

