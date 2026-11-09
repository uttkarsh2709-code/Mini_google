/**
 * Node.js Express + MongoDB backend for Mini Google.
 * Fully compatible with frontend/app.js.
 */
require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const mongoose = require('mongoose');
const axios = require('axios');

const User = require('./models/User');
const History = require('./models/History');
const Rating = require('./models/Rating');
const Page = require('./models/Page');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// MongoDB Connection
let rawUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/minigoogle';

const hasPlaceholder = (uri) => /<[^>]+>/.test(uri);

if (hasPlaceholder(rawUri)) {
  console.warn("⚠️ Notice: MongoDB URI contains an unreplaced placeholder (e.g. '<db_password>').");
  console.warn("   Replace it with your actual Atlas database password in .env");
}

// Ensure database name is appended if omitted
const MONGO_URI = rawUri.includes('?') && !rawUri.includes('.net/minigoogle')
  ? rawUri.replace('.net/?', '.net/minigoogle?')
  : rawUri;

if (!hasPlaceholder(rawUri)) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('🍃 Connected to MongoDB:', MONGO_URI.split('@').pop()))
    .catch((err) => console.error('⚠️ MongoDB connection error:', err.message));
}

// Helper: SHA256 Password Hash (matches Python hashlib.sha256)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Health Check
app.get('/', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    status: 'ok',
    message: 'Mini Google Node.js + MongoDB API',
    database: isConnected ? 'mongodb (connected)' : 'mongodb (connecting/disconnected)',
    mongodb_connected: isConnected
  });
});

// AI Providers
app.get('/providers', (req, res) => {
  res.json({
    gemini: {
      enabled: Boolean(process.env.GEMINI_API_KEY),
      models: ['gemini-2.5-flash', 'gemini-1.5-pro']
    },
    groq: {
      enabled: Boolean(process.env.GROQ_API_KEY),
      models: ['llama-3.3-70b-versatile', 'llama3-8b-8192']
    }
  });
});

// Auth: Signup
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ detail: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ detail: 'User already exists' });
    }

    const user = new User({
      email: normalizedEmail,
      password_hash: hashPassword(password)
    });
    await user.save();

    console.log(`✅ User registered: ${normalizedEmail}`);
    res.json({ message: 'User created successfully', email: normalizedEmail });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ detail: err.message });
  }
});

// Auth: Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ detail: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    if (user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ detail: 'Invalid password' });
    }

    console.log(`✅ User logged in: ${normalizedEmail}`);
    res.json({ message: 'Login successful', email: normalizedEmail });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ detail: err.message });
  }
});

// User History: Save Event
app.post('/history', async (req, res) => {
  try {
    const { email, event_type, query, title, url, response } = req.body;
    if (!email || !query) {
      return res.status(400).json({ detail: 'email and query are required' });
    }

    const historyItem = new History({
      email: email.trim().toLowerCase(),
      event_type: event_type || 'search',
      query: query.trim(),
      title,
      url,
      response
    });
    const saved = await historyItem.save();

    res.json({ id: saved._id, message: 'History saved' });
  } catch (err) {
    console.error('History save error:', err);
    res.status(500).json({ detail: err.message });
  }
});

// User History: Fetch
app.get('/history', async (req, res) => {
  try {
    const email = req.query.email;
    const limit = parseInt(req.query.limit, 10) || 100;
    if (!email) {
      return res.status(400).json({ detail: 'Email query parameter required' });
    }

    const items = await History.find({ email: email.trim().toLowerCase() })
      .sort({ created_at: -1 })
      .limit(limit);

    res.json({
      items: items.map(item => ({
        id: item._id,
        event_type: item.event_type,
        query: item.query,
        title: item.title,
        url: item.url,
        response: item.response,
        created_at: item.created_at
      }))
    });
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ detail: err.message });
  }
});

// User History: Delete
app.delete('/history', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({ detail: 'Email query parameter required' });
    }

    const result = await History.deleteMany({ email: email.trim().toLowerCase() });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    console.error('History delete error:', err);
    res.status(500).json({ detail: err.message });
  }
});

// Rating: Save
app.post('/rating', async (req, res) => {
  try {
    const { email, stars, feedback } = req.body;
    const rating = new Rating({
      email: email || 'anonymous',
      stars: parseInt(stars, 10),
      feedback
    });
    await rating.save();
    console.log(`⭐ Rating received: ${stars} stars from ${email}`);
    res.json({ message: 'Rating saved successfully' });
  } catch (err) {
    console.error('Rating error:', err);
    res.status(500).json({ detail: err.message });
  }
});

// Search: MongoDB Text Search + DuckDuckGo Fallback
app.get('/search', async (req, res) => {
  const query = req.query.query;
  const limit = parseInt(req.query.limit, 10) || 10;

  if (!query || !query.trim()) {
    return res.status(400).json({ detail: 'Query cannot be empty' });
  }

  const hits = [];

  // 1. Try Searching MongoDB collection
  try {
    let mongoDocs = await Page.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit);

    // Fallback to regex if text index returned nothing
    if (mongoDocs.length === 0) {
      mongoDocs = await Page.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } }
        ]
      }).limit(limit);
    }

    for (const doc of mongoDocs) {
      hits.push({
        url: doc.url,
        title: doc.title,
        snippet: doc.content ? doc.content.slice(0, 300) + '...' : 'No content'
      });
    }

    if (hits.length > 0) {
      console.log(`🍃 MongoDB found ${hits.length} indexed results for '${query}'`);
    }
  } catch (err) {
    console.warn('MongoDB search warning:', err.message);
  }

  // 2. DuckDuckGo fallback
  if (hits.length === 0) {
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const ddgRes = await axios.get(ddgUrl, { timeout: 6000 });
      const data = ddgRes.data;

      if (data.AbstractText && data.AbstractURL) {
        hits.push({
          url: data.AbstractURL,
          title: data.Heading || query,
          snippet: data.AbstractText.slice(0, 300)
        });
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, limit - hits.length)) {
          if (topic.Text && topic.FirstURL) {
            hits.push({
              url: topic.FirstURL,
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 50),
              snippet: topic.Text.slice(0, 300)
            });
          }
        }
      }
    } catch (ddgErr) {
      console.warn('DuckDuckGo fallback warning:', ddgErr.message);
    }
  }

  res.json({
    query,
    hits,
    featured_image: null
  });
});

// AI Chat Endpoint
app.post('/chat', async (req, res) => {
  try {
    const { messages, provider = 'groq', model } = req.body;
    const userMessage = messages?.[messages.length - 1]?.content || 'Hello';

    // Check Groq
    if (provider === 'groq' && process.env.GROQ_API_KEY) {
      const groqModel = model || 'llama-3.3-70b-versatile';
      const groqRes = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: groqModel,
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant in Mini Google.' },
            ...messages
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const reply = groqRes.data.choices[0].message.content;
      return res.json({
        response: reply,
        provider: 'groq',
        model: groqModel,
        usage: groqRes.data.usage || {}
      });
    }

    // Check Gemini
    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      const geminiModel = model || 'gemini-2.5-flash';
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const geminiRes = await axios.post(
        geminiUrl,
        {
          contents: [{ parts: [{ text: userMessage }] }]
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const reply = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
      return res.json({
        response: reply,
        provider: 'gemini',
        model: geminiModel,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
    }

    // Fallback response if API keys are not provided
    res.json({
      response: `AI response received for: "${userMessage}". To enable live AI responses, add GROQ_API_KEY or GEMINI_API_KEY to your .env file!`,
      provider: 'mock',
      model: 'default',
      usage: {}
    });
  } catch (err) {
    console.error('Chat error:', err.response?.data || err.message);
    res.status(500).json({ detail: err.response?.data?.error?.message || err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Mini Google Node.js server running on http://127.0.0.1:${PORT}`);
  console.log(`📡 MongoDB URI: ${MONGO_URI}`);
});

