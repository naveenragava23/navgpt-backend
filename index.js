import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();

const ALLOWED_ORIGINS = [
  "https://naveen-gpt.web.app",
  "https://naveen-gpt.firebaseapp.com",
  // Keep localhost for local dev — Render ignores this in production.
  "http://localhost:5000",
  "http://localhost:3000",
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. Render health checks, curl)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
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

// ---------- Provider configs ----------

// OpenRouter — fallback provider for any non-NVIDIA slots.
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings";

// NVIDIA NIM — direct API for Nemotron (OpenAI-compatible endpoint).
// Set NVIDIA_API_KEY + NVIDIA_MODEL in Render's Environment tab.
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

// Google Gemini — REST streaming endpoint.
// Set GEMINI_API_KEY + GEMINI_MODEL (e.g. gemini-2.5-flash) in Render's Environment tab.
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Build a unified slot list. The NVIDIA slot (if configured) is listed first
// so it becomes the default. Each slot carries a `provider` tag so runChat
// knows which endpoint and extra params to use.
const _nvidiaSlot =
  process.env.NVIDIA_API_KEY && process.env.NVIDIA_MODEL
    ? {
      id: "nvidia",
      provider: "nvidia",
      apiKey: process.env.NVIDIA_API_KEY,
      model: process.env.NVIDIA_MODEL,
      label: process.env.NVIDIA_LABEL || "Nemotron Ultra",
    }
    : null;

const _openrouterSlots = [1]
  .map((n) => ({
    id: `model${n}`,
    provider: "openrouter",
    apiKey: process.env[`OPENROUTER_API_KEY_${n}`],
    model: process.env[`OPENROUTER_MODEL_${n}`],
    label:
      process.env[`OPENROUTER_LABEL_${n}`] ||
      process.env[`OPENROUTER_MODEL_${n}`] ||
      `Model ${n}`,
  }))
  .filter((m) => m.apiKey && m.model);

// Gemini slot — added when GEMINI_API_KEY is set (defaults to gemini-3.6-flash).
const _geminiSlot =
  process.env.GEMINI_API_KEY
    ? {
      id: "gemini",
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      label: process.env.GEMINI_LABEL || (process.env.GEMINI_MODEL ? `Gemini (${process.env.GEMINI_MODEL})` : "Gemini 3.6 Flash"),
    }
    : null;

const MODEL_SLOTS = [
  ...(_nvidiaSlot ? [_nvidiaSlot] : []),
  ..._openrouterSlots,
  ...(_geminiSlot ? [_geminiSlot] : []),
];

function getModelSlot(modelId) {
  return MODEL_SLOTS.find((m) => m.id === modelId) || MODEL_SLOTS[0];
}

// Embeddings use the OpenRouter embedding key/model (separate from chat slots).
const EMBEDDING_API_KEY = process.env.OPENROUTER_EMBEDDING_API_KEY || _openrouterSlots[0]?.apiKey;
const EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || "openai/text-embedding-3-small";

// =====================================================================
// SYSTEM PROMPTS — one per response mode
// =====================================================================

// General mode: the original NavGPT prompt (unchanged behaviour, plus diagrams).
const SYSTEM_PROMPT_GENERAL = `You are NavGPT, a helpful and knowledgeable AI assistant. You can help with anything — answering questions, writing, coding, analysis, brainstorming, math, research, creative tasks, and more.

Be direct, clear, and genuinely useful. Match your tone to the conversation — casual when the user is casual, detailed and precise when the task requires it. Never refuse a reasonable request.

## Visual diagrams (Canvas images)
When a visual diagram, chart, flowchart, or illustration would meaningfully help the user understand the concept, include EXACTLY ONE fenced code block labeled \`\`\`render-image immediately after your explanation.

Rules for render-image blocks:
- The canvas coordinate space is 480 pixels wide × 300 pixels tall.
- The variable \`ctx\` is already bound to the 2D rendering context — do NOT declare it.
- Write clean, self-contained JavaScript drawing code. No external libraries.
- Always set a white or light background first: ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,480,300);
- SAFE MARGINS: Keep ALL content (shapes, text, lines) within a 20px inset from every edge — i.e. x: 20–460, y: 20–280. Never draw or place text outside these bounds or it will be clipped.
- Use the NavGPT accent colour #D97757 for highlights and important elements.
- Include clear text labels on the diagram using ctx.fillText(). Use ctx.font to set size before drawing text (e.g. ctx.font="13px sans-serif"). Check that label text + position stays within the safe margin.
- Only include this block when a diagram genuinely adds value. Never include it for simple factual answers.

Example render-image block (bar chart):
\`\`\`render-image
ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,480,300);
const bars=[["Jan",80],["Feb",120],["Mar",60]];
const bw=60,gap=30,base=260;
bars.forEach(([label,val],i)=>{
  const x=40+i*(bw+gap);
  ctx.fillStyle="#D97757";
  ctx.fillRect(x,base-val,bw,val);
  ctx.fillStyle="#2D2A26";
  ctx.font="13px sans-serif";
  ctx.fillText(label,x+bw/2-12,base+18);
  ctx.fillText(val,x+bw/2-8,base-val-6);
});
ctx.fillStyle="#2D2A26";
ctx.font="bold 15px sans-serif";
ctx.fillText("Monthly Data",160,28);
\`\`\`

When the user asks you to create a presentation, slide deck, PPT, Word
document, DOCX, PDF, report, or similar downloadable document, do BOTH of
these:
1. Write a short, friendly reply as normal (1-3 sentences is fine).
2. Immediately after, include a single fenced code block labeled
   \`\`\`export-json containing ONLY valid JSON with this exact shape,
   nothing else inside the block:
{
  "title": "Short overall title",
  "subtitle": "Optional one-line subtitle or tagline (omit if not useful)",
  "sections": [
    {
      "heading": "Section or slide heading",
      "icon": "🧠",
      "content": ["a fully-formed, informative point", "another detailed point"],
      "diagramCode": "ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,480,300); ... (optional canvas JS for this slide)"
    }
  ]
}

Go deep, not shallow — this becomes a real downloadable PPTX/DOCX/PDF, so
sparse content looks obviously unfinished. Follow these rules:
- Use 6-10 sections for a typical presentation or report; use more for
  broad or advanced topics. Only use fewer if the topic is genuinely narrow.
- Structure sections sensibly for the topic — e.g. an introduction/overview
  section first, several substantive body sections (covering distinct
  sub-topics, mechanisms, examples, comparisons, causes/effects, or
  steps as relevant), and a summary/conclusion or key-takeaways section
  last.
- Each section MUST include an "icon" (a single relevant emoji).
- For 1-3 key sections where a visual helps, include "diagramCode" containing javascript canvas code (same rules as render-image: 480x300, 20px safe margins). If no diagram is needed for a section, omit the "diagramCode" field.
- Each section needs 4-7 content items. Every item should be a complete,
  specific, informative sentence or clause (roughly 12-30 words) — not a
  telegraphic fragment. Include concrete details, examples, numbers, or
  explanations wherever relevant instead of vague generalities.
- Vary sentence structure across items so the deck/document doesn't read
  like a repetitive list of the same phrasing.
- If the user asks for a large number of slides/pages (e.g. 15-20+), keep
  each content item on the shorter end of the range (12-18 words) so the
  whole response fits comfortably — it is far more important that the
  \`\`\`export-json code block is complete and properly closed with a
  final \`\`\` than that every item is maximally long. A finished block
  with slightly shorter bullets is always better than a longer block that
  gets cut off before closing.
Do not add this code block for normal conversational replies — only when
the user is clearly asking for a generatable document.`;

// Student mode: story-first, analogy-driven, example-grounded explanations.
const SYSTEM_PROMPT_STUDENT = `You are NavGPT in Student Mode — a friendly, patient tutor who makes every concept stick through real-world stories and vivid examples.

## Core teaching philosophy
- **Be clear and concise:** Give direct, easy-to-understand answers without unnecessary fluff or robotic transitions.
- **Use real-world stories or analogies wisely:** When explaining a complex topic, use a relatable scenario, everyday object, or famous example to make it stick. Use "Imagine you're…" or "Think of it like…" framing if it helps, but skip it for simple factual questions.
- **Explain concepts simply:** Introduce technical terms clearly, linking them back to everyday concepts.
- **Provide concrete examples:** Use numbers, timelines, or short, practical examples when helpful.
- **Focus on relevance:** Briefly mention why the concept matters in real life, but keep it brief.

## Tone and style
- Use simple, conversational language. Define jargon the moment you introduce it.
- Use bold for key terms the first time they appear.
- Keep paragraphs short (2-4 sentences). Use bullet points for readability.
- Be encouraging, but avoid excessive filler text or fake enthusiasm. Answer directly and clearly.

## Visual diagrams (Canvas images)
When a visual diagram, chart, flowchart, or illustration would meaningfully help the student understand the concept, include EXACTLY ONE fenced code block labeled \`\`\`render-image immediately after your explanation.

Rules for render-image blocks:
- The canvas coordinate space is 480 pixels wide × 300 pixels tall.
- The variable \`ctx\` is already bound to the 2D rendering context — do NOT declare it.
- Write clean, self-contained JavaScript drawing code. No external libraries.
- Always set a white or light background first: ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,480,300);
- SAFE MARGINS: Keep ALL content (shapes, text, lines) within a 20px inset from every edge — i.e. x: 20–460, y: 20–280. Never draw or place text outside these bounds or it will be clipped.
- Use the NavGPT accent colour #D97757 for highlights and important elements.
- Include clear text labels on the diagram using ctx.fillText(). Use ctx.font to set size before drawing text (e.g. ctx.font="13px sans-serif"). Check that label text + position stays within the safe margin.
- Only include this block when a diagram genuinely adds value. Never include it for simple factual answers.

Example render-image block (bar chart):
\`\`\`render-image
ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,480,300);
const bars=[["Jan",80],["Feb",120],["Mar",60]];
const bw=60,gap=30,base=260;
bars.forEach(([label,val],i)=>{
  const x=40+i*(bw+gap);
  ctx.fillStyle="#D97757";
  ctx.fillRect(x,base-val,bw,val);
  ctx.fillStyle="#2D2A26";
  ctx.font="13px sans-serif";
  ctx.fillText(label,x+bw/2-12,base+18);
  ctx.fillText(val,x+bw/2-8,base-val-6);
});
ctx.fillStyle="#2D2A26";
ctx.font="bold 15px sans-serif";
ctx.fillText("Monthly Data",160,28);
\`\`\`

## Document export
When the user asks for a presentation, slide deck, PPT, Word document, DOCX, PDF, report, or similar, do BOTH:
1. Write a short, friendly reply as normal (1-3 sentences).
2. Immediately after, include a single fenced code block labeled \`\`\`export-json containing ONLY valid JSON with this exact shape:
{
  "title": "Short overall title",
  "subtitle": "Optional one-line subtitle or tagline (omit if not useful)",
  "sections": [
    {
      "heading": "Section or slide heading",
      "icon": "🧠",
      "content": ["a fully-formed, informative point", "another detailed point"],
      "diagramCode": "ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,480,300); ... (optional canvas JS for this slide)"
    }
  ]
}
- Use 6-10 sections. Each section needs 4-7 content items (complete sentences, 12-30 words each).
- Each section MUST include an "icon" (a single relevant emoji).
- For 1-3 key sections where a visual helps, include "diagramCode" containing javascript canvas code (same rules as render-image: 480x300, 20px safe margins). If no diagram is needed for a section, omit the "diagramCode" field.
- Do NOT add this block for normal conversational replies.`;

/**
 * Pick the right system prompt based on the response mode sent by the frontend.
 * @param {"student"|"general"|undefined} responseMode
 */
function getSystemPrompt(responseMode) {
  return responseMode === "student" ? SYSTEM_PROMPT_STUDENT : SYSTEM_PROMPT_GENERAL;
}

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
    models: MODEL_SLOTS.map((m) => ({ id: m.id, label: m.label, provider: m.provider })),
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

// ================= Concurrency queue for AI provider calls =================
//
// Built for ~60 people potentially hitting /api/chat around the same time
// (e.g. a class lab session). Both the NVIDIA NIM and OpenRouter providers
// can only reliably handle a handful of simultaneous requests before
// rate-limiting. Extra requests wait in a FIFO queue instead of erroring
// out, and each waiting client sees a live position + rough ETA over the
// same SSE stream it already opened.
//
// This is a single-process, in-memory queue — correct as long as the
// backend runs as one Render instance. If you ever scale to multiple
// instances behind a load balancer, this would need to move to a shared
// store (e.g. Redis) since each instance would otherwise track its own
// queue independently.

const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || "3", 10);
// Hard cap on how many people can be waiting at once. With 60 potential
// users this should comfortably cover everyone; requests beyond this are
// told to retry shortly rather than waiting indefinitely.
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || "100", 10);
// How often to send an SSE keep-alive comment to queued/streaming clients,
// so intermediary proxies (Render's included) don't time out an idle
// connection while someone waits their turn.
const HEARTBEAT_MS = 15000;

let activeRequests = 0;
const waitQueue = []; // array of job objects, FIFO

// Rolling average of recent job durations, used to give waiting users a
// rough "~40s" estimate rather than just a raw position number.
const recentDurations = [];
const MAX_DURATION_SAMPLES = 20;
const DEFAULT_DURATION_MS = 9000; // reasonable guess before we have samples

function recordDuration(ms) {
  recentDurations.push(ms);
  if (recentDurations.length > MAX_DURATION_SAMPLES) recentDurations.shift();
}

function avgDurationMs() {
  if (!recentDurations.length) return DEFAULT_DURATION_MS;
  return recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length;
}

// Roughly: how many "batches" of MAX_CONCURRENT_REQUESTS have to clear
// before this position gets a free slot.
function estimateWaitMs(position) {
  const slotsAhead = Math.max(0, position - 1);
  const batchesAhead = Math.ceil((slotsAhead + 1) / MAX_CONCURRENT_REQUESTS);
  return Math.round(batchesAhead * avgDurationMs());
}

function broadcastQueuePositions() {
  waitQueue.forEach((job, idx) => {
    if (job.cancelled) return;
    const position = idx + 1;
    job.send({
      type: "queued",
      position,
      total: waitQueue.length,
      estimatedWaitSeconds: Math.round(estimateWaitMs(position) / 1000),
    });
  });
}

function runJob(job) {
  activeRequests++;
  broadcastQueuePositions();
  const startedAt = Date.now();
  job
    .start()
    .catch((err) => console.error("Unhandled error in queued job:", err))
    .finally(() => {
      recordDuration(Date.now() - startedAt);
      activeRequests--;
      processQueue();
    });
}

function processQueue() {
  while (activeRequests < MAX_CONCURRENT_REQUESTS && waitQueue.length > 0) {
    const job = waitQueue.shift();
    if (job.cancelled) continue; // client disconnected while waiting, skip
    runJob(job);
  }
}

function enqueue(job) {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    runJob(job);
    return { accepted: true };
  }
  if (waitQueue.length >= MAX_QUEUE_SIZE) {
    return { accepted: false };
  }
  waitQueue.push(job);
  job.send({
    type: "queued",
    position: waitQueue.length,
    total: waitQueue.length,
    estimatedWaitSeconds: Math.round(estimateWaitMs(waitQueue.length) / 1000),
  });
  return { accepted: true };
}

function removeFromQueue(job) {
  const idx = waitQueue.indexOf(job);
  if (idx !== -1) {
    waitQueue.splice(idx, 1);
    broadcastQueuePositions();
  }
}

// ================= Chat (streaming, model-selectable, RAG-augmented, queued) =================

app.post("/api/chat", requireAuth, async (req, res) => {
  const userMessage = (req.body?.message || "").trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const modelId = req.body?.modelId;
  const responseMode = req.body?.responseMode === "student" ? "student" : "general";

  if (!userMessage) return res.status(400).json({ error: "message is required." });
  if (userMessage.length > 4000) return res.status(400).json({ error: "message is too long." });

  const slot = getModelSlot(modelId);
  if (!slot) {
    return res.status(500).json({ error: "No AI models are configured on the server." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": heartbeat\n\n");
  }, HEARTBEAT_MS);

  const job = {
    cancelled: false,
    send,
    start: () => runChat({ req, res, send, userMessage, history, slot, responseMode }),
  };

  req.on("close", () => {
    if (!res.writableEnded) {
      job.cancelled = true;
      removeFromQueue(job);
    }
    clearInterval(heartbeat);
  });

  const originalStart = job.start;
  job.start = () => originalStart().finally(() => clearInterval(heartbeat));

  const result = enqueue(job);
  if (!result.accepted) {
    clearInterval(heartbeat);
    send({
      type: "error",
      message: "The server is at capacity right now (too many people waiting). Please try again in a minute.",
    });
    res.end();
  }
});

// The actual provider call + stream relay for a single job. Only ever
// invoked by the queue once a concurrency slot is free.
// Supports three providers:
//   - "nvidia"     → NVIDIA NIM endpoint (direct, with thinking params)
//   - "openrouter" → OpenRouter endpoint
//   - "gemini"     → Google Gemini REST streaming endpoint
async function runChat({ req, res, send, userMessage, history, slot, responseMode }) {
  // RAG retrieval — returns [] until documents are ingested, so this is a
  // no-op for now but wired up and ready.
  const contextChunks = await retrieveContext(userMessage);
  const contextBlock = contextChunks.length
    ? `\n\nRelevant study material:\n${contextChunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n")}`
    : "";

  // Build history, dropping any turns with empty content (Cohere rejects them
  // with a 400 "must have non-empty content" error). Also collapse consecutive
  // messages with the same role into one (another Cohere requirement that most
  // other providers tolerate but Cohere enforces strictly).
  const historyMessages = history
    .slice(-20)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").trim(),
    }))
    .filter((m) => m.content.length > 0)
    .reduce((acc, m) => {
      // Merge back-to-back messages from the same role
      if (acc.length > 0 && acc[acc.length - 1].role === m.role) {
        acc[acc.length - 1].content += "\n" + m.content;
      } else {
        acc.push(m);
      }
      return acc;
    }, []);

  const messages = [
    { role: "system", content: getSystemPrompt(responseMode) + contextBlock },
    ...historyMessages,
    { role: "user", content: userMessage },
  ];

  // =========================================================
  // GEMINI provider branch
  // =========================================================
  if (slot.provider === "gemini") {
    return runGeminiChat({ req, res, send, messages, slot });
  }

  // ---- Build provider-specific request (NVIDIA / OpenRouter) ----
  const isNvidia = slot.provider === "nvidia";
  const apiUrl = isNvidia ? NVIDIA_API_URL : OPENROUTER_API_URL;

  const requestBody = {
    model: slot.model,
    messages,
    temperature: 1,
    top_p: isNvidia ? 0.95 : 1,
    max_tokens: 16384,
    stream: true,
    // NVIDIA NIM extended thinking params (extra_body in the Python SDK
    // maps to top-level fields in a raw HTTP POST body).
    ...(isNvidia && {
      chat_template_kwargs: { enable_thinking: true },
      reasoning_budget: 16384,
    }),
  };

  let upstream;
  try {
    console.log(
      `[${req.uid}] Calling ${isNvidia ? "NVIDIA NIM" : "OpenRouter"} with model ${slot.model} (slot ${slot.id})...`
    );
    upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${slot.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
    console.log(`[${req.uid}] Provider responded with status ${upstream.status}`);
  } catch (err) {
    console.error("Provider request failed:", err);
    send({ type: "error", message: "Could not reach the model." });
    return res.end();
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error("Provider API error:", upstream.status, errText);
    send({ type: "error", message: "Upstream model request failed." });
    return res.end();
  }

  // ---- Stream relay — identical SSE format for both NVIDIA / OpenRouter ----
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
          // reasoning_content is emitted by both NVIDIA NIM (thinking mode)
          // and some OpenRouter models — handled the same way.
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
}

// =========================================================
// Google Gemini streaming chat
// Converts the internal OpenAI-style messages array to Gemini's
// `contents` format (role: "user"/"model", parts: [{text}]) and
// streams the response via the REST SSE endpoint.
// =========================================================
async function runGeminiChat({ req, res, send, messages, slot }) {
  // Separate the system prompt from conversation turns.
  const systemMsg = messages.find((m) => m.role === "system");
  const turns = messages.filter((m) => m.role !== "system");

  // Convert turns to Gemini `contents` format.
  // Gemini uses "model" instead of "assistant" for the AI role.
  const contents = turns.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Ensure the conversation starts with a user turn (Gemini requirement).
  if (!contents.length || contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Hello" }] });
  }

  const requestBody = {
    contents,
    ...(systemMsg && {
      systemInstruction: { parts: [{ text: systemMsg.content }] },
    }),
    generationConfig: {
      temperature: 1,
      maxOutputTokens: 8192,
    },
  };

  // ?alt=sse makes Gemini stream SSE chunks instead of a single JSON response.
  const apiUrl = `${GEMINI_BASE_URL}/${encodeURIComponent(slot.model)}:streamGenerateContent?alt=sse&key=${slot.apiKey}`;

  let upstream;
  try {
    console.log(`[${req.uid}] Calling Google Gemini with model ${slot.model}...`);
    upstream = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    console.log(`[${req.uid}] Gemini responded with status ${upstream.status}`);
  } catch (err) {
    console.error("Gemini request failed:", err);
    send({ type: "error", message: "Could not reach Google Gemini." });
    return res.end();
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error("Gemini API error:", upstream.status, errText);
    send({ type: "error", message: "Gemini model request failed." });
    return res.end();
  }

  // ---- Stream relay for Gemini SSE chunks ----
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
        if (!data || data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          // Gemini SSE shape: { candidates: [{ content: { parts: [{text}] } }] }
          const parts = parsed?.candidates?.[0]?.content?.parts;
          if (!Array.isArray(parts)) continue;
          for (const part of parts) {
            if (part.text) {
              send({ type: "content", text: part.text });
              contentCharsSent += part.text.length;
            }
          }
        } catch {
          // ignore malformed/partial chunk
        }
      }
    }
    console.log(`[${req.uid}] Gemini stream finished: ${contentCharsSent} content chars sent.`);
  } catch (err) {
    console.error("Gemini stream read error:", err);
    send({ type: "error", message: "Gemini stream interrupted." });
  }

  send({ type: "done" });
  res.end();
}

// ---------- Lightweight queue/capacity status (handy for a status widget) ----------
app.get("/api/queue-status", requireAuth, (req, res) => {
  res.json({
    activeRequests,
    waiting: waitQueue.length,
    maxConcurrent: MAX_CONCURRENT_REQUESTS,
    maxQueueSize: MAX_QUEUE_SIZE,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NavGPT backend listening on port ${PORT}`));

process.on("uncaughtException", (err) => console.error("UNCAUGHT EXCEPTION:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED REJECTION:", err));