# NavGPT — Ask Naveen

A Claude-style personal study assistant, backed by GLM 5.2 (via NVIDIA
Build), hosted on Firebase Hosting (free Spark plan) with Google login and
saved conversation history per user. The model call runs on a small backend
on Render, since Firebase Cloud Functions requires the paid Blaze plan even
at low volume.

## ⚠️ Before anything else
An earlier version of this project had a live NVIDIA API key committed in
plain text. **Regenerate that key now** at https://build.nvidia.com if you
haven't already, and never paste API keys into frontend code, chat, or a
file that gets committed to git — only into Render's environment variables.

## Architecture
- **Frontend** (`index.html`) — Google sign-in, chat UI, loads past messages
  from Firestore on login. Deployed on **Firebase Hosting** (Spark/free).
- **Backend** (`render-backend/`) — a small Express server deployed on
  **Render**. Verifies the caller is a real signed-in Firebase user, then
  calls GLM 5.2 on NVIDIA Build with your secret key. The key never touches
  the browser.
- **Firestore** (Spark/free) — stores each exchange under
  `users/{uid}/conversations`, written directly from the frontend after a
  successful reply, governed by `firestore.rules` so users can only read/
  write their own data.

## 1. Deploy the backend on Render
1. Push the `render-backend/` folder to a GitHub repo (or point Render at a
   subfolder of an existing repo).
2. On Render: **New → Web Service** → connect the repo →
   Build command `npm install` → Start command `npm start`.
3. Add environment variables (see `render-backend/.env.example`):
   - `FIREBASE_SERVICE_ACCOUNT` — full JSON from Firebase Console → Project
     Settings → Service Accounts → Generate new private key, pasted as one
     line.
   - `NVIDIA_API_KEY` — your **new**, regenerated key.
   - `NVIDIA_MODEL` — optional, defaults to `z-ai/glm-5.2`.
4. Deploy and copy the live URL, e.g. `https://navgpt-backend.onrender.com`.

Note: Render's free tier spins down after inactivity — the first message
after a while can take 30–50 seconds while it wakes up.

## 2. Point the frontend at your backend
In `index.html`, replace the `BACKEND_URL` placeholder with your real
Render URL.

## 3. Enable Google Sign-In
Firebase Console → Authentication → Sign-in method → enable **Google**.

## 4. Deploy Hosting + Firestore rules
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting,firestore:rules
```

## 5. Test
Visit `https://naveen-gpt.web.app`, sign in with Google, and chat. Sign out
and back in (or on another device) — your history reloads from Firestore
automatically.

## Next steps
- Add basic content-safety checks in the Render backend before returning a
  reply.
- Add a "New conversation" button to segment history into sessions rather
  than one long thread.
- Restrict CORS on the Render backend to your exact Hosting origin instead
  of allowing all origins, once you're ready to lock things down.
