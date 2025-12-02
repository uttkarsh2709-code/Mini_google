"""FastAPI search service that uses DuckDuckGo for real web searches and Groq/Gemini AI for chat."""
from __future__ import annotations

import requests
import os
import base64
import re
from typing import List
from urllib.parse import quote_plus
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

# Initialize Groq client if available
groq_client = None
GROQ_ENABLED = False
if GROQ_AVAILABLE:
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            groq_client = Groq(api_key=groq_key)
            GROQ_ENABLED = True
            print("✓ Groq AI initialized successfully")
        except Exception as e:
            print(f"✗ Groq initialization failed: {e}")
    else:
        print("✗ GROQ_API_KEY not set in .env file")

# Initialize Gemini client if available
gemini_model = None
GEMINI_ENABLED = False
if GEMINI_AVAILABLE:
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            genai.configure(api_key=gemini_key)
            gemini_model = genai.GenerativeModel('gemini-2.0-flash')
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
    model: str = "llama-3.3-70b-versatile"  # Groq's fast free model
    temperature: float = 0.7
    max_tokens: int = 2000
    image: str | None = None  # Base64 encoded image for vision models


class SearchHit(BaseModel):
    url: str
    title: str
    snippet: str
    image: str | None = None


class SearchResponse(BaseModel):
    query: str
    hits: List[SearchHit]
    featured_image: str | None = None


@app.get("/", tags=["health"])
def root() -> dict[str, str | bool]:
    return {
        "status": "ok", 
        "message": "Mini Google Search API",
        "ai_enabled": AI_ENABLED
    }


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
            vision_model = genai.GenerativeModel('gemini-2.0-flash')
            
            # Send image + text to Gemini
            response = vision_model.generate_content([
                user_message,
                {"mime_type": "image/jpeg", "data": image_bytes}
            ])
            
            return {
                "response": response.text,
                "model": "gemini-2.0-flash-vision",
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
    
    # Text-only request - prefer Gemini, fallback to Groq
    try:
        model = request.model
        
        # Use Gemini for text if available (free tier is generous)
        if GEMINI_ENABLED:
            print(f"📝 Text request - Using Gemini")
            
            # Build conversation for Gemini
            conversation_text = "\\n\\n".join([
                f"{msg.role.upper()}: {msg.content}" 
                for msg in request.messages
            ])
            
            system_prompt = """You are a helpful AI assistant. Provide clear, accurate, well-structured answers.
Use markdown formatting: ## for headings, ### for subheadings, **bold** for emphasis, bullet points for lists.
Be friendly, polite, and professional."""
            
            full_prompt = f"{system_prompt}\\n\\n{conversation_text}"
            
            response = gemini_model.generate_content(full_prompt)
            
            return {
                "response": response.text,
                "model": "gemini-1.5-flash",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            }
        
        # Fallback to Groq if Gemini not available
        elif GROQ_ENABLED:
            print(f"📝 Text request - Using Groq {model}")
            
            messages = [
                {
                    "role": "system",
                    "content": """You are a helpful AI assistant. Provide clear, accurate, well-structured answers.
Use markdown formatting: ## for headings, ### for subheadings, **bold** for emphasis, bullet points for lists."""
                }
            ]
            messages.extend([{"role": msg.role, "content": msg.content} for msg in request.messages])
            
            response = groq_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            )
            
            return {
                "response": response.choices[0].message.content,
                "model": request.model,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }
            }
        else:
            raise HTTPException(status_code=503, detail="No AI provider available")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI request failed: {str(e)}")


@app.get("/search", response_model=SearchResponse)
def search(query: str = Query(..., min_length=2), limit: int = Query(10, ge=1, le=50)) -> SearchResponse:
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # Use DuckDuckGo Instant Answer API (free, no API key needed)
    try:
        encoded_query = quote_plus(query)
        
        # Fetch featured image from DuckDuckGo
        featured_image = None
        try:
            img_url = f"https://api.duckduckgo.com/?q={encoded_query}&format=json&pretty=1"
            img_response = requests.get(img_url, timeout=5)
            if img_response.ok:
                img_data = img_response.json()
                if img_data.get('Image'):
                    featured_image = img_data['Image']
        except:
            pass
        
        # DuckDuckGo HTML search
        search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        response = requests.get(search_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse HTML results
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        hits: list[SearchHit] = []
        results = soup.find_all('div', class_='result', limit=limit)
        
        for result in results:
            title_elem = result.find('a', class_='result__a')
            snippet_elem = result.find('a', class_='result__snippet')
            
            if title_elem and title_elem.get('href'):
                url = title_elem['href']
                title = title_elem.get_text(strip=True) or url
                snippet = snippet_elem.get_text(strip=True) if snippet_elem else "No description available."
                
                hits.append(SearchHit(url=url, title=title, snippet=snippet[:300]))
        
        return SearchResponse(query=query, hits=hits, featured_image=featured_image)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
