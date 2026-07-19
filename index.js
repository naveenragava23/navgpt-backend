import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();

// For production, restrict this to your Firebase Hosting origin, e.g.:
// app.use(cors({ origin: "https://naveen-gpt.web.app" }));
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ---------- Firebase Admin ----------
let adminReady = false;
let db = null;
try {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
  db = admin.firestore();
  adminReady = true;
  console.log("Firebase Admin initialized successfully.");
} catch (err) {
  console.error("FIREBASE_SERVICE_ACCOUNT is missing or invalid JSON:", err.message);
}

// ---------- OpenRouter config: up to 3 selectable models, each with its own key ----------
// Set these in Render's Environment tab. A model slot is only offered to the
// frontend if both its API key and model id are set.
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings";

const MODEL_SLOTS = [1, 2, 3].map((n) => ({
  id: `model${n}`,
  apiKey: process.env[`OPENROUTER_API_KEY_${n}`],
  model: process.env[`OPENROUTER_MODEL_${n}`],
  label: process.env[`OPENROUTER_LABEL_${n}`] || process.env[`OPENROUTER_MODEL_${n}`] || `Model ${n}`,
})).filter((m) => m.apiKey && m.model);

function getModelSlot(modelId) {
  return MODEL_SLOTS.find((m) => m.id === modelId) || MODEL_SLOTS[0];
}

// Embeddings use whichever key is in slot 1 by default (OpenRouter routes
// embedding models the same way as chat models). Override with a dedicated
// key/model if you want retrieval to use a different provider.
const EMBEDDING_API_KEY = process.env.OPENROUTER_EMBEDDING_API_KEY || MODEL_SLOTS[0]?.apiKey;
const EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || "openai/text-embedding-3-small";

const SYSTEM_PROMPT = `You are a helpful, empathetic assistant designed to mimic Claude's conversational style.
Your role is to act as a personal chatbot for teachers and students that:
- Responds with nuance, empathy, and structured reasoning.
- Explains concepts step by step in a beginner-friendly way.
- Avoids harmful, biased, or unsafe content.
- Provides clear, concise answers but expands when asked for detail.
Always respond in a way that feels supportive, thoughtful, and human-like.`;

// ---------- Auth middleware ----------
async function requireAuth(req, res, next) {
  if (!adminReady) {
    console.error("Rejecting request: Firebase Admin is not initialized.");
    return res.status(500).json({ error: "Server misconfigured (auth unavailable)." });
  }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.get("/", (req, res) => res.send("NavGPT backend is running."));

// ---------- Model list for the frontend dropdown ----------
app.get("/api/models", requireAuth, (req, res) => {
  res.json({
    models: MODEL_SLOTS.map((m) => ({ id: m.id, label: m.label })),
  });
});

// ================= RAG: retrieval helpers =================

let knowledgeCache = null;
let knowledgeCacheAt = 0;
const KNOWLEDGE_CACHE_MS = 5 * 60 * 1000; // 5 min

async function embedText(text) {
  const res = await fetch(OPENROUTER_EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Embedding request failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return data?.data?.[0]?.embedding || null;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function loadKnowledgeBase() {
  if (!db) return [];
  const now = Date.now();
  if (knowledgeCache && now - knowledgeCacheAt < KNOWLEDGE_CACHE_MS) {
    return knowledgeCache;
  }
  const snap = await db.collection("knowledge_base").get();
  knowledgeCache = snap.docs.map((d) => d.data());
  knowledgeCacheAt = now;
  return knowledgeCache;
}

// Returns top-k most relevant chunks for a query, or [] if the knowledge
// base is empty (which it is until you ingest something via /api/ingest).
async function retrieveContext(query, k = 4) {
  try {
    const chunks = await loadKnowledgeBase();
    if (!chunks.length) return [];

    const queryEmbedding = await embedText(query);
    if (!queryEmbedding) return [];

    const scored = chunks
      .filter((c) => Array.isArray(c.embedding))
      .map((c) => ({ ...c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return scored;
  } catch (err) {
    console.error("Retrieval error (continuing without context):", err.message);
    return [];
  }
}

function chunkText(text, chunkSize = 800, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

// ---------- Ingest study material into the RAG knowledge base ----------
// POST { text: "...", source: "optional label" }
// Chunks the text, embeds each chunk, stores in Firestore. Shared across
// all users for now (a single class/teacher knowledge base) — split this
// per-user or per-course later if you need isolation.
app.post("/api/ingest", requireAuth, async (req, res) => {
  const text = (req.body?.text || "").trim();
  const source = (req.body?.source || "untitled").trim();
  if (!text) return res.status(400).json({ error: "text is required." });

  try {
    const chunks = chunkText(text);
    const batch = db.batch();
    let stored = 0;

    for (const chunk of chunks) {
      const embedding = await embedText(chunk);
      if (!embedding) continue;
      const ref = db.collection("knowledge_base").doc();
      batch.set(ref, {
        content: chunk,
        embedding,
        source,
        addedBy: req.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      stored++;
    }

    await batch.commit();
    knowledgeCache = null; // invalidate cache so new content shows up immediately
    res.json({ ok: true, chunksStored: stored });
  } catch (err) {
    console.error("Ingest error:", err);
    res.status(500).json({ error: "Failed to ingest document." });
  }
});

// ================= Chat (streaming, model-selectable, RAG-augmented) =================

app.post("/api/chat", requireAuth, async (req, res) => {
  const userMessage = (req.body?.message || "").trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const modelId = req.body?.modelId;

  if (!userMessage) return res.status(400).json({ error: "message is required." });
  if (userMessage.length > 4000) return res.status(400).json({ error: "message is too long." });

  const slot = getModelSlot(modelId);
  if (!slot) {
    return res.status(500).json({ error: "No OpenRouter models are configured on the server." });
  }

  // RAG retrieval — returns [] until documents are ingested, so this is a
  // no-op for now but wired up and ready.
  const contextChunks = await retrieveContext(userMessage);
  const contextBlock = contextChunks.length
    ? `\n\nRelevant study material:\n${contextChunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n")}`
    : "";

  const messages = [
    { role: "system", content: SYSTEM_PROMPT + contextBlock },
    ...history.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? ""),
    })),
    { role: "user", content: userMessage },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  let upstream;
  try {
    console.log(`[${req.uid}] Calling OpenRouter with model ${slot.model} (slot ${slot.id})...`);
    upstream = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${slot.apiKey}`,
      },
      body: JSON.stringify({
        model: slot.model,
        messages,
        temperature: 1,
        top_p: 1,
        max_tokens: 4096,
        stream: true,
      }),
    });
    console.log(`[${req.uid}] OpenRouter responded with status ${upstream.status}`);
  } catch (err) {
    console.error("OpenRouter request failed:", err);
    send({ type: "error", message: "Could not reach the model." });
    return res.end();
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error("OpenRouter API error:", upstream.status, errText);
    send({ type: "error", message: "Upstream model request failed." });
    return res.end();
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let contentCharsSent = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]" || !data) continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.reasoning_content) send({ type: "reasoning", text: delta.reasoning_content });
          if (delta.content) {
            send({ type: "content", text: delta.content });
            contentCharsSent += delta.content.length;
          }
        } catch {
          // ignore malformed/partial chunk
        }
      }
    }
    console.log(`[${req.uid}] Stream finished: ${contentCharsSent} content chars sent.`);
  } catch (err) {
    console.error("Stream read error:", err);
    send({ type: "error", message: "Stream interrupted." });
  }

  send({ type: "done" });
  res.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NavGPT backend listening on port ${PORT}`));

process.on("uncaughtException", (err) => console.error("UNCAUGHT EXCEPTION:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED REJECTION:", err));