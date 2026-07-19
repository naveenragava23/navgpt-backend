import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();

// Log every incoming request immediately, before any other logic runs.
// This lets us confirm requests are actually reaching Render/this app.
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// For production, restrict this to your Firebase Hosting origin, e.g.:
// app.use(cors({ origin: "https://naveen-gpt.web.app" }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------- Firebase Admin (used only to verify who's calling us) ----------
// On Render, paste the FULL contents of your service account JSON
// (Firebase Console > Project Settings > Service Accounts > Generate new private key)
// into an env var called FIREBASE_SERVICE_ACCOUNT.
let adminReady = false;
try {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
  adminReady = true;
  console.log("Firebase Admin initialized successfully.");
} catch (err) {
  console.error("FIREBASE_SERVICE_ACCOUNT is missing or invalid JSON:", err.message);
}

// ---------- NVIDIA API config ----------
// Set NVIDIA_API_KEY in Render's dashboard — never in this file.
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "z-ai/glm-5.2";

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
    console.log(`Authenticated request from uid: ${req.uid}`);
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.get("/", (req, res) => res.send("NavGPT backend is running."));

// ---------- Streaming chat endpoint ----------
// Sends Server-Sent Events to the browser as tokens arrive from NVIDIA.
// Event payloads: {type:"reasoning", text} | {type:"content", text} | {type:"done"} | {type:"error", message}
app.post("/api/chat", requireAuth, async (req, res) => {
  const userMessage = (req.body?.message || "").trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  if (!userMessage) {
    return res.status(400).json({ error: "message is required." });
  }
  if (userMessage.length > 4000) {
    return res.status(400).json({ error: "message is too long." });
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? ""),
    })),
    { role: "user", content: userMessage },
  ];

  // Set up SSE response to the browser
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  let upstream;
  try {
    upstream = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages,
        temperature: 1,
        top_p: 1,
        max_tokens: 16384,
        seed: 42,
        stream: true,
      }),
    });
  } catch (err) {
    console.error("NVIDIA request failed:", err);
    send({ type: "error", message: "Could not reach the model." });
    return res.end();
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error("NVIDIA API error:", upstream.status, errText);
    send({ type: "error", message: "Upstream model request failed." });
    return res.end();
  }

  // Parse the upstream OpenAI-style SSE stream and re-emit as our own events
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep last partial line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.reasoning_content) {
            send({ type: "reasoning", text: delta.reasoning_content });
          }
          if (delta.content) {
            send({ type: "content", text: delta.content });
          }
        } catch (parseErr) {
          // Ignore malformed/incomplete JSON chunks
        }
      }
    }
  } catch (err) {
    console.error("Stream read error:", err);
    send({ type: "error", message: "Stream interrupted." });
  }

  send({ type: "done" });
  res.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NavGPT backend listening on port ${PORT}`));

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});