# EAH Jena Virtual Avatar Assistant — Documentation

**Project:** AI-powered 3D avatar assistant for Ernst-Abbe-Hochschule Jena (EAH Jena)
**Type:** Web-based interactive campus assistant
**Status:** Functional prototype

---

## 1. Overview

This project is a browser-based virtual assistant represented by a realistic 3D avatar. Visitors can type or speak questions about EAH Jena, and the avatar responds with synthesized speech, natural idle motion, lip-sync, and blinking — presented against a branded teal background matching the university's visual identity.

The avatar answers using a two-tier system: a locally-generated AI backend for open-ended questions, with a small hand-written FAQ as an offline fallback if the backend is unreachable.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| 3D rendering | [Three.js](https://threejs.org/) (WebGL) |
| Build tool | Vite |
| Avatar model | glTF Binary (`.glb`), realistic full-body rig with ARKit-style facial blendshapes |
| Avatar source | [MetaPerson Creator](https://metaperson.avatarsdk.com/) (Avatar SDK) — free realistic avatar generator |
| Frontend language | Vanilla JavaScript (ES modules) |
| Styling | Plain CSS with custom properties (design tokens) |
| Backend | Node.js + Express |
| AI / chat | Google Gemini API (`gemini-3.6-flash`) |
| Text-to-speech | Browser `SpeechSynthesis` API (active); ElevenLabs neural TTS (built, currently disabled — see §7) |
| Speech input | Web Speech API (`SpeechRecognition`) — Chrome/Edge only |

---

## 3. Project Structure

```
ai-avatar/
├── public/
│   └── models/
│       └── avatar_3.glb          # the avatar model
├── src/
│   ├── assets/
│   │   └── EAH_Logo.png          # official university logo
│   ├── main.js                   # all frontend logic (see §4)
│   └── style.css                 # all styling / design tokens
└── server/
    ├── server.js                 # Express backend (chat + TTS endpoints)
    └── .env                      # API keys — NEVER commit or share this file
```

---

## 4. Frontend (`main.js`) — Feature Breakdown

### 4.1 Scene setup
Standard Three.js scene: perspective camera, `OrbitControls` for mouse/touch rotation, directional + ambient lighting, and a soft translucent ground disc so the avatar reads as standing on something rather than floating.

The background is a vertical teal gradient painted onto a canvas texture — matches the brand color sampled directly from the EAH Jena logo (`#009898`) rather than a flat/generic color.

### 4.2 Avatar loading
Loaded via plain `GLTFLoader` (not a VRM plugin — the model is a standard glTF humanoid, not a VRM file). On load, the code:
- Adds the model to the scene
- Locates the head, eyelash, and lower-teeth meshes by name (needed for facial animation)
- Applies a hand-tuned resting pose (see §4.3) — glTF models load in a raw T-pose bind position with no default "relaxed" stance

### 4.3 Idle pose & sway
The resting pose was found through iterative live-tuning directly against this specific model's skeleton (bone names like `LeftArm`, `RightForeArm`, `LeftHandIndex1` — standard Mixamo/Ready-Player-Me-style naming). The avatar rests with **hands clasped together in front of the body** (a Japanese-style reception stance), not arms hanging at the sides.

A subtle, slow sine-wave sway is layered on top of the resting pose (arms + fingers) so the avatar doesn't look frozen — deliberately small in amplitude, and left/right arms move **in phase** with each other (not alternating) so the clasped hands don't visibly drift apart.

### 4.4 Greeting gesture — the bow
On load, after a brief pause, the avatar performs a polite bow: the spine bends forward (~20°) using an eased rise → hold → fall motion, then returns to the resting pose. The hands stay clasped throughout — only the torso moves. The greeting line is spoken at the same time.

### 4.5 Facial animation
The model carries real ARKit-style blendshapes (`eyeBlinkLeft/Right`, `jawOpen`, `mouthSmileLeft/Right`, etc.) across the head, eyelash, and lower-teeth meshes.
- **Blinking**: randomized every 2–6 seconds, applied to both the head and eyelash meshes together
- **Lip-sync**: while speaking, `jawOpen` is driven either by real-time audio frequency analysis (when using ElevenLabs neural TTS) or by a smoothed synthetic sine-wave pattern (when using browser TTS) — capped at a modest maximum so the mouth movement doesn't look exaggerated

### 4.6 Speech
`speak(text)` currently uses the browser's built-in `SpeechSynthesis` API, preferring an English female voice if one is available on the user's system. A commented-out alternate implementation exists for ElevenLabs neural TTS with real audio-driven lip-sync (see §7).

### 4.7 Chat interface
A floating glass-style input bar at the bottom of the screen with:
- Text input + Send button
- Microphone button (Web Speech API voice input, Chrome/Edge only — gracefully disables itself with an explanatory tooltip on unsupported browsers)
- A fading subtitle bubble showing what the avatar is currently saying

### 4.8 Answer pipeline
1. User's question is sent to the backend (`POST /api/chat`) along with the last few turns of conversation history
2. If the backend responds successfully, that answer is spoken
3. If the backend is unreachable (not running, network issue, etc.), the frontend silently falls back to a small local keyword-matched FAQ (`KNOWLEDGE_BASE`) covering common questions about programs, admissions, location, and history — so the demo never fully breaks, even offline

---

## 5. Backend (`server.js`)

A minimal Express server with two endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /` | Health check — confirms the server is running |
| `POST /api/chat` | Takes `{ question, history }`, sends it to Gemini with a system prompt grounding it in EAH Jena facts, returns `{ answer }` |
| `POST /api/tts` | Takes `{ text }`, requests neural speech audio from ElevenLabs, returns an MP3 stream (currently unused by the frontend — see §7) |

**Why a backend at all?** API keys can never be exposed in frontend code — anyone could open browser dev tools and steal them. The backend holds both the Gemini and ElevenLabs keys server-side and proxies requests on the frontend's behalf.

### System prompt
The Gemini system prompt grounds the assistant in a short set of verified EAH Jena facts (founding year, student count, campus location, program count, admission/application deadlines) and explicitly instructs it to admit uncertainty rather than invent specifics — important for a university-facing assistant where made-up facts would be a real problem.

---

## 6. Environment Variables

Required in `server/.env` (never committed to version control, never shared, never uploaded anywhere):

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key — [aistudio.google.com/apikey](https://aistudio.google.com/apikey), free tier available |
| `ELEVENLABS_API_KEY` | ElevenLabs API key — needed only if/when neural TTS is re-enabled |
| `PORT` | Backend port (defaults to `3001`) |

> ⚠️ **Security note:** if these keys are ever accidentally exposed (committed to a public repo, pasted into a chat, etc.), revoke and regenerate them immediately from their respective dashboards. Add `.env` to `.gitignore` before this project touches any Git repository.

---

## 7. Known Limitations & Open Items

- **Neural TTS is built but disabled.** The ElevenLabs integration (`/api/tts` + real audio-driven lip-sync via Web Audio API frequency analysis) is fully implemented in both `server.js` and as a commented-out block in `main.js`, but the active `speak()` function currently uses browser TTS instead. Re-enabling it means swapping which `speak()` function is active — the code for both already exists.
- **Voice input is Chrome/Edge only.** Firefox and Safari don't support the Web Speech API's `SpeechRecognition`; the mic button disables itself gracefully on those browsers.
- **The FAQ fallback is intentionally small.** It only covers the handful of questions most likely to be asked; everything else should route through the Gemini backend when it's running.
- **The avatar model is a free community/generated asset**, not an official EAH Jena-branded character — worth keeping in mind if this moves from prototype to an official public-facing deployment (licensing, and whether a custom/branded avatar is wanted instead).
- **Backend runs on `localhost` only.** Before any public deployment, the backend needs to be hosted somewhere (a small VPS, Render, Railway, etc.) and the frontend's `CHAT_ENDPOINT`/`TTS_ENDPOINT` URLs updated accordingly, plus CORS configured for the real domain instead of open access.

---

## 8. Credits

- **Avatar model**: generated with [MetaPerson Creator](https://metaperson.avatarsdk.com/) by Avatar SDK
- **University branding**: official EAH Jena logo and color identity (`#009898`)
- **AI**: Google Gemini API
- **Speech**: Browser Web Speech API / ElevenLabs (planned)
