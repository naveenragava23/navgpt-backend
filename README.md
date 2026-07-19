NavGPT — Ask Naveen

A Claude-style personal study assistant with:


Google sign-in and per-user chat sessions (sidebar, like ChatGPT)
A choice of up to 3 OpenRouter models, selectable per message
A RAG pipeline that retrieves relevant study material before answering
(currently empty — see "Adding study material" below)
Streaming responses over Server-Sent Events


Hosted on Firebase Hosting (free Spark plan) + Firestore, with the model
calls proxied through a small backend on Render (Cloud Functions requires
the paid Blaze plan even at low volume, so this avoids that).

⚠️ Before anything else

Multiple API keys and a Firebase service account key have been pasted into
chat during development. Regenerate every one of them if you haven't
already:


NVIDIA keys: https://build.nvidia.com
OpenRouter keys: https://openrouter.ai/keys
Firebase service account: Firebase Console → Project Settings → Service
Accounts → Generate new private key (delete the old one first at
https://console.cloud.google.com/iam-admin/serviceaccounts)


Never paste API keys into frontend code, chat, or a file that gets
committed to git — only into Render's environment variables.

Architecture


Frontend (index.html) — sign-in, sidebar of chat sessions, model
picker, streaming chat UI. Deployed on Firebase Hosting.
Backend (render-backend/) — Express server on Render. Verifies the
caller is a signed-in Firebase user, retrieves relevant context from the
RAG knowledge base, calls the selected OpenRouter model, and streams the
reply back over SSE. Deployed on Render.
Firestore — users/{uid}/chats/{chatId} holds session metadata
(title, timestamps); users/{uid}/chats/{chatId}/messages/{id} holds the
exchanges, written directly from the frontend after each reply.
knowledge_base (backend-only, via Admin SDK) holds RAG chunks +
embeddings.


1. Deploy the backend on Render


Push render-backend/ to a GitHub repo.
Render → New → Web Service → connect the repo.

Build command: npm install
Start command: npm start
Instance type: Free



Add environment variables (see render-backend/.env.example):

FIREBASE_SERVICE_ACCOUNT
OPENROUTER_API_KEY_1 / OPENROUTER_MODEL_1 / OPENROUTER_LABEL_1
OPENROUTER_API_KEY_2 / OPENROUTER_MODEL_2 / OPENROUTER_LABEL_2
OPENROUTER_API_KEY_3 / OPENROUTER_MODEL_3 / OPENROUTER_LABEL_3
Only slots with both a key and a model set will appear in the
frontend's dropdown — leave any pair blank to only offer fewer models.
OPENROUTER_EMBEDDING_API_KEY / OPENROUTER_EMBEDDING_MODEL (optional
— defaults to slot 1's key and openai/text-embedding-3-small)



Deploy, copy the live URL.


Render's free tier spins down after ~15 minutes idle — the next request
takes 30–50 seconds to wake it. That's the main source of "slow" responses;
a paid Render instance removes it, or you can ping the URL periodically
from an external uptime service to keep it warm.

2. Point the frontend at your backend

In index.html, set BACKEND_URL to your Render URL.

3. Deploy Hosting + Firestore rules

bashfirebase deploy --only hosting,firestore:rules

Adding study material (RAG)

The knowledge base starts empty, so retrieval is a no-op until you add
content. To ingest text:

bashcurl -X POST https://YOUR-RENDER-URL.onrender.com/api/ingest \
  -H "Authorization: Bearer <a valid Firebase ID token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "...your study material...", "source": "Chapter 3 notes"}'

It gets chunked (~800 chars, 100 char overlap), embedded, and stored in
Firestore's knowledge_base collection — shared across all users for now.
The next chat request will automatically pull in the most relevant chunks
for the question being asked. A simple in-app upload UI (paste text or a
PDF) is a natural next step if you want this reachable without curl — say
the word and I'll build it.

Next steps


Add a frontend UI for /api/ingest (paste text or upload a file) instead
of curl.
Split the knowledge base per-user or per-course if a shared pool isn't
what you want.
Restrict CORS on the Render backend to your exact Hosting origin.
Consider a paid Render instance (or a keep-alive ping) if cold-start
latency becomes annoying.