"""FastAPI search service that uses DuckDuckGo for real web searches and Groq/Gemini AI for chat."""
from __future__ import annotations

import requests
import os
import base64
import re
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List
from urllib.parse import quote_plus
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .database import astra_documents, astra_enabled, get_db_connection, init_db

# Load environment variables from .env file
load_dotenv()

# Try to import Groq
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    print("Groq not installed. Install with: pip install groq")

# Try to import Gemini
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Gemini not installed. Install with: pip install google-generativeai")

app = FastAPI(title="Mini Google Search API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()

# Initialize Groq client if available
groq_client = None
GROQ_ENABLED = False
GROQ_CHAT_MODELS: list[str] = []
if GROQ_AVAILABLE:
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            groq_client = Groq(api_key=groq_key)
            GROQ_ENABLED = True
            try:
                available_models = groq_client.models.list().data
                GROQ_CHAT_MODELS = [
                    model.id for model in available_models
                    if not any(term in model.id.casefold() for term in ("guard", "whisper", "speech", "tts"))
                ]
                preferred_groq_models = [
                    "openai/gpt-oss-120b",
                    "openai/gpt-oss-20b",
                    "qwen/qwen3.8-27b",
                    "qwen/qwen3.6-27b",
                ]
                GROQ_CHAT_MODELS = [
                    model for model in preferred_groq_models if model in GROQ_CHAT_MODELS
                ] + [
                    model for model in GROQ_CHAT_MODELS if model not in preferred_groq_models
                ]
                if GROQ_CHAT_MODELS:
                    print(f"✓ Groq chat models available: {', '.join(GROQ_CHAT_MODELS)}")
                else:
                    print("⚠ Groq key has no accessible chat models; Gemini fallback enabled")
            except Exception as e:
                print(f"⚠ Groq model discovery failed: {e}")
            print("✓ Groq AI initialized successfully")
        except Exception as e:
            print(f"✗ Groq initialization failed: {e}")
    else:
        print("✗ GROQ_API_KEY not set in .env file")

# Initialize Gemini client if available
gemini_model = None
GEMINI_ENABLED = False
GEMINI_CHAT_MODELS: list[str] = []
if GEMINI_AVAILABLE:
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            genai.configure(api_key=gemini_key)
            available_models = genai.list_models()
            GEMINI_CHAT_MODELS = [
                model.name.removeprefix("models/")
                for model in available_models
                if "generateContent" in model.supported_generation_methods
            ]
            preferred_model = "gemini-3.6-flash"
            GEMINI_CHAT_MODELS = [preferred_model] + [
                model for model in GEMINI_CHAT_MODELS if model != preferred_model
            ]
            gemini_model = genai.GenerativeModel(GEMINI_CHAT_MODELS[0])
            GEMINI_ENABLED = True
            print("✓ Gemini AI initialized successfully (with vision support!)")
        except Exception as e:
            print(f"✗ Gemini initialization failed: {e}")
    else:
        print("✗ GEMINI_API_KEY not set in .env file")
        print("  Get your free API key from: https://makersuite.google.com/app/apikey")

AI_ENABLED = GROQ_ENABLED or GEMINI_ENABLED
if AI_ENABLED:
    print(f"✓ AI providers available: {'Gemini' if GEMINI_ENABLED else ''} {'Groq' if GROQ_ENABLED else ''}")
else:
    print("✗ No AI providers available. Please set API keys in .env file")


# AI Chat Models
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    provider: str = "gemini"
    model: str = "gemini-3.6-flash"
    temperature: float = 0.7
    max_tokens: int = 2000
    image: str | None = None  # Base64 encoded image for vision models


@app.get("/providers", tags=["health"])
def providers() -> dict[str, object]:
    return {
        "gemini": {"enabled": GEMINI_ENABLED, "models": GEMINI_CHAT_MODELS},
        "groq": {"enabled": bool(GROQ_CHAT_MODELS), "models": GROQ_CHAT_MODELS},
    }


class SearchHit(BaseModel):
    url: str
    title: str
    snippet: str
    image: str | None = None


class SearchResponse(BaseModel):
    query: str
    hits: List[SearchHit]
    featured_image: str | None = None


class UserAuth(BaseModel):
    email: str
    password: str

class UserRating(BaseModel):
    email: str
    stars: int
    feedback: str | None = None


class HistoryEvent(BaseModel):
    email: str
    event_type: str
    query: str
    title: str | None = None
    url: str | None = None
    response: str | None = None

@app.get("/", tags=["health"])
def root() -> dict[str, str | bool]:
    return {
        "status": "ok", 
        "message": "Mini Google Search API",
        "ai_enabled": AI_ENABLED
    }


def hash_password(password: str) -> str:
    """Simple hash for demo purposes. Use bcrypt/argon2 in production."""
    return hashlib.sha256(password.encode()).hexdigest()

def send_welcome_email(to_email: str):
    """Sends a welcome email using SMTP configuration from .env"""
    sender_email = os.getenv("EMAIL_SENDER")
    sender_password = os.getenv("EMAIL_PASSWORD")
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not sender_email or not sender_password:
        print(f"📧 [MOCK EMAIL] To: {to_email} | Subject: Welcome to Mini Google!")
        print(f"   (Real email not sent: EMAIL_SENDER/EMAIL_PASSWORD not set in .env)")
        return

    try:
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = to_email
        msg['Subject'] = "Welcome to Mini Google! 🚀"

        body = f"""
        <html>
          <body>
            <h2>Welcome to Mini Google!</h2>
            <p>Hi there,</p>
            <p>You have successfully logged in to Mini Google.</p>
            <p>Welcome and start your searching!</p>
            <br>
            <p>Best regards,</p>
            <p>The Mini Google Team</p>
          </body>
        </html>
        """
        msg.attach(MIMEText(body, 'html'))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        text = msg.as_string()
        server.sendmail(sender_email, to_email, text)
        server.quit()
        print(f"✅ Welcome email sent to {to_email}")
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")

@app.post("/auth/signup")
def signup(user: UserAuth):
    print(f"👤 Signup attempt for: {user.email}")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if user exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (user.email,))
        if cursor.fetchone():
            print("⚠️ User already exists")
            raise HTTPException(status_code=400, detail="User already exists")
            
        # Insert user
        pwd_hash = hash_password(user.password)
        cursor.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", (user.email, pwd_hash))
        conn.commit()
        print(f"✅ User created: {user.email}")
        
        # Send Welcome Email
        send_welcome_email(user.email)
        
        return {"message": "User created successfully", "email": user.email}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Signup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post("/auth/login")
def login(user: UserAuth):
    print(f"🔑 Login attempt for: {user.email}")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT password_hash FROM users WHERE email = ?", (user.email,))
        result = cursor.fetchone()
        
        if not result:
            print("⚠️ User not found")
            raise HTTPException(status_code=404, detail="User not found")
            
        stored_hash = result['password_hash']
        if hash_password(user.password) != stored_hash:
            print("❌ Invalid password")
            raise HTTPException(status_code=401, detail="Invalid password")
            
        print("✅ Login successful")
        return {"message": "Login successful", "email": user.email}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post("/history")
def save_history(event: HistoryEvent):
    if event.event_type not in {"search", "chat"}:
        raise HTTPException(status_code=400, detail="event_type must be 'search' or 'chat'")
    if not event.email.strip() or not event.query.strip():
        raise HTTPException(status_code=400, detail="email and query are required")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO user_history (email, event_type, query, title, url, response)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (event.email.strip().casefold(), event.event_type, event.query.strip(),
             event.title, event.url, event.response),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "message": "History saved"}
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Could not save history: {exc}") from exc
    finally:
        conn.close()


@app.get("/history")
def get_history(email: str = Query(..., min_length=3), limit: int = Query(100, ge=1, le=500)):
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """SELECT id, event_type, query, title, url, response, created_at
               FROM user_history WHERE email = ?
               ORDER BY created_at DESC, id DESC LIMIT ?""",
            (email.strip().casefold(), limit),
        ).fetchall()
        return {"items": [dict(row) for row in rows]}
    finally:
        conn.close()


@app.delete("/history")
def clear_history(email: str = Query(..., min_length=3)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_history WHERE email = ?", (email.strip().casefold(),))
        conn.commit()
        return {"deleted": cursor.rowcount}
    finally:
        conn.close()


@app.post("/rating")
def save_rating(rating: UserRating):
    print(f"⭐ Rating received: {rating.stars} stars from {rating.email}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO ratings (email, stars, feedback) VALUES (?, ?, ?)", 
            (rating.email, rating.stars, rating.feedback)
        )
        conn.commit()
        return {"message": "Rating saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post("/chat")
async def chat(request: ChatRequest):
    """AI chat endpoint using Gemini (with vision) or Groq API"""
    if not AI_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="AI features are disabled. Install: pip install google-generativeai groq"
        )
    
    # Handle vision requests with Gemini
    if request.image and GEMINI_ENABLED:
        print(f"🖼️ Image upload detected - Using Gemini Vision")
        print(f"📏 Image size: {len(request.image) // 1024} KB")
        
        try:
            # Extract base64 data (remove data:image/xxx;base64, prefix if present)
            image_data = request.image
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            # Decode base64 to bytes
            image_bytes = base64.b64decode(image_data)
            
            # Get the user's question
            user_message = request.messages[-1].content if request.messages else "Describe this image"
            
            # Create Gemini vision model (gemini-2.0-flash supports both text and vision)
            vision_model = genai.GenerativeModel('gemini-2.5-flash')
            
            # Send image + text to Gemini
            response = vision_model.generate_content([
                user_message,
                {"mime_type": "image/jpeg", "data": image_bytes}
            ])
            
            return {
                "response": response.text,
                "model": "gemini-2.5-flash-vision",
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0
                }
            }
        except Exception as e:
            print(f"❌ Gemini vision error: {str(e)}")
            return {
                "response": f"Sorry, I encountered an error processing the image: {str(e)}. Please try again or describe what you'd like to know about the image.",
                "model": "error",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            }
    
    # Handle image without Gemini
    if request.image and not GEMINI_ENABLED:
        return {
            "response": "I can see you've uploaded an image, but image analysis requires the Gemini API. Get your free API key from https://makersuite.google.com/app/apikey and add it to your .env file as GEMINI_API_KEY=your-key",
            "model": "text-only",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        }
    
    # Text-only request: honor the selected provider instead of silently routing
    # Gemini requests through Groq.
    try:
        provider = request.provider.casefold()
        selected_model = request.model
        
        if provider == "groq":
            if not GROQ_ENABLED:
                raise HTTPException(status_code=503, detail="Groq is not configured")
            if not GROQ_CHAT_MODELS:
                if not GEMINI_ENABLED:
                    raise HTTPException(status_code=503, detail="No accessible chat provider is configured")
                print("⚠ Groq has no chat model access; falling back to Gemini")
                provider = "gemini"
                selected_model = "gemini-3.6-flash"
            else:
                groq_model = request.model if request.model in GROQ_CHAT_MODELS else GROQ_CHAT_MODELS[0]
                print(f"📝 Text request - Using Groq {groq_model}")
                messages = [
                    {
                        "role": "system",
                        "content": """You are a helpful AI assistant. Provide clear, accurate, well-structured answers.
Use markdown formatting: ## for headings, ### for subheadings, **bold** for emphasis, bullet points for lists."""
                    }
                ]
                messages.extend([{"role": msg.role, "content": msg.content} for msg in request.messages])

                response = groq_client.chat.completions.create(
                    model=groq_model,
                    messages=messages,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                )

                return {
                    "response": response.choices[0].message.content,
                    "provider": "groq",
                    "model": groq_model,
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }
                }
        
        elif provider == "gemini":
            if not GEMINI_ENABLED:
                raise HTTPException(status_code=503, detail="Gemini is not configured")
            if selected_model not in GEMINI_CHAT_MODELS:
                selected_model = GEMINI_CHAT_MODELS[0]
                print(f"⚠ Invalid Gemini model requested; using {selected_model}")
            print(f"📝 Text request - Using Gemini {selected_model}")
            
            # Build conversation for Gemini
            conversation_text = "\\n\\n".join([
                f"{msg.role.upper()}: {msg.content}" 
                for msg in request.messages
            ])
            
            system_prompt = """You are a helpful AI assistant. Provide clear, accurate, well-structured answers.
Use markdown formatting: ## for headings, ### for subheadings, **bold** for emphasis, bullet points for lists.
Be friendly, polite, and professional."""
            
            full_prompt = f"{system_prompt}\\n\\n{conversation_text}"
            
            response = genai.GenerativeModel(selected_model).generate_content(full_prompt)
            
            return {
                "response": response.text,
                "provider": "gemini",
                "model": selected_model,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            }
        else:
            raise HTTPException(status_code=400, detail="provider must be 'groq' or 'gemini'")
            
    except HTTPException:
        raise
    except Exception as e:
        if provider == "groq" and "model_not_found" in str(e):
            raise HTTPException(
                status_code=503,
                detail="Groq is enabled, but this API key has no access to the requested chat model.",
            ) from e
        raise HTTPException(status_code=500, detail=f"AI request failed: {str(e)}")


@app.get("/search", response_model=SearchResponse)
def search(query: str = Query(..., min_length=2), limit: int = Query(10, ge=1, le=50)) -> SearchResponse:
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    hits: list[SearchHit] = []

    if astra_enabled():
        try:
            terms = query.casefold().split()
            for row in astra_documents(limit * 5):
                searchable = f"{row.get('title', '')} {row.get('content', '')}".casefold()
                if all(term in searchable for term in terms):
                    content = row.get("content", "")
                    hits.append(SearchHit(
                        url=row.get("url", ""),
                        title=row.get("title", "Untitled"),
                        snippet=content[:300] + ("..." if len(content) > 300 else ""),
                    ))
                    if len(hits) >= limit:
                        break
            print(f"✅ Astra search found {len(hits)} results for '{query}'")
        except requests.RequestException as exc:
            print(f"⚠️ Astra search failed, using local fallback: {exc}")
    
    # 1. Try Searching Local SQLite Database First
    if not hits:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
        
        # FTS5 Match Query
        # We select snippets or full content. Simple version: get content and truncate
            cursor.execute(
                "SELECT url, title, content FROM pages WHERE pages MATCH ? ORDER BY rank LIMIT ?",
                (query, limit)
            )
            rows = cursor.fetchall()
        
            for row in rows:
                hits.append(SearchHit(
                    url=row['url'],
                    title=row['title'],
                    snippet=row['content'][:300] + "..." if row['content'] else "No content",
                ))
        
            conn.close()
            print(f"✅ Local Search found {len(hits)} results for '{query}'")
        
        except Exception as e:
            print(f"⚠️ Local SQLite search failed: {e}")

    # 2. If no local results, Fallback to DuckDuckGo (or combine them)
    if not hits:
        print("🌍 Local index empty or no matches. Falling back to DuckDuckGo...")
        try:
            encoded_query = quote_plus(query)
            
            # DuckDuckGo HTML search
            search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            
            response = requests.get(search_url, headers=headers, timeout=10)
            if response.ok:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.text, 'html.parser')
                results = soup.find_all('div', class_='result', limit=limit)
                
                for result in results:
                    title_elem = result.find('a', class_='result__a')
                    snippet_elem = result.find('a', class_='result__snippet')
                    
                    if title_elem and title_elem.get('href'):
                        url = title_elem['href']
                        title = title_elem.get_text(strip=True) or url
                        snippet = snippet_elem.get_text(strip=True) if snippet_elem else "No description available."
                        
                        hits.append(SearchHit(url=url, title=title, snippet=snippet[:300]))

        except Exception as e:
            print(f"⚠️ DuckDuckGo search failed: {str(e)}")
            # If both fail, and we have no hits, we might raise an error or return empty
            if not hits:
                pass # Return empty

    return SearchResponse(query=query, hits=hits, featured_image=None)
