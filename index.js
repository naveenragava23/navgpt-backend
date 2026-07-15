import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();

// For production, restrict this to your Firebase Hosting origin, e.g.:
// app.use(cors({ origin: "https://naveen-gpt.web.app" }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------- Firebase Admin (used only to verify who's calling us) ----------
// On Render, paste the FULL contents of your service account JSON
// (Firebase Console > Project Settings > Service Accounts > Generate new private key)
// into an env var called FIREBASE_SERVICE_ACCOUNT.
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});

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

  try {
    const nvidiaRes = await fetch(NVIDIA_API_URL, {
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
        max_tokens: 2048,
        stream: false,
      }),
    });

    if (!nvidiaRes.ok) {
      const errText = await nvidiaRes.text();
      console.error("NVIDIA API error:", nvidiaRes.status, errText);
      return res.status(502).json({ error: "Upstream model request failed" });
    }

    const data = await nvidiaRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "(no response)";
    res.json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NavGPT backend listening on port ${PORT}`));
