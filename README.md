# EAH Jena Virtual Campus Assistant

A browser-based virtual 3D avatar assistant for the **Ernst-Abbe-Hochschule Jena (EAH Jena)**. Visitors choose a language and an avatar, then ask questions about the university by typing or by voice. The avatar answers in the chosen language with synthesized speech, lip-sync, blinking and idle movements, standing in a room with a large screen on the wall behind it.

Live: <https://bw-srv2.bw.eah-jena.de> (inside the university network)

Project of the Fachbereich Betriebswirtschaft (Faculty of Business Administration), project "KI". Developed by Elyes Belaidi (student assistant), supervised by Prof. Dr. Jan-Frederik Engelhardt.

## Features

- **Start flow:** animated welcome, language selection, avatar selection (Elena or Mika)
- **14 languages:** English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Turkish, Russian, Ukrainian, Arabic (right-to-left), Chinese, Japanese
- **Two avatars:** Elena (GLB model) and Mika (VRM model) with idle sway, bow gesture, blinking and lip-sync
- **Chat by text or voice** with suggested questions, question bubbles and subtitles
- **One voice at a time:** a new question, the stop button or the Esc key stops her immediately
- **Room and wall screen:** closed room with a limited camera; the screen rotates slides (website QR code, Ernst App QR code, facts about EAH Jena)
- **Kiosk mode:** automatic reset to the welcome screen after 3 minutes without input
- **Knowledge file:** `server/knowledge.md` extends what the assistant knows, no restart needed
- **Offline fallback:** local FAQ (German and English) if the backend is unreachable

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vite, vanilla JavaScript (ES modules), Three.js, @pixiv/three-vrm, plain CSS |
| Backend | Node.js, Express |
| AI answers | Mistral (default) or any OpenAI-compatible provider such as Groq |
| Voice | ElevenLabs text-to-speech with timestamps (fallback: browser speech synthesis) |
| QR codes | qrcode-generator (generated in the browser) |
| Hosting | Debian 12 VM, Apache 2 (HTTPS, reverse proxy), PM2 |

## Project structure

```
.
├── index.html
├── package.json
├── public/
│   ├── models/          avatar models (Avatar_1.glb, Avatar_4.vrm)
│   └── thumbnails/      preview pictures for the avatar selection
├── src/
│   ├── main.js          the whole frontend
│   ├── style.css
│   └── assets/          university logo
├── server/
│   ├── server.js        Express backend (/api/chat, /api/tts)
│   └── knowledge.md     extra knowledge for the assistant
└── dist/                build output (generated, not committed)
```

## Getting started

Requirements: Node.js and npm.

```bash
# 1. install the packages (project root)
npm install

# 2. create the backend configuration
cp server/.env.example server/.env      # then fill in your own keys

# 3. start the backend (port 3001)
cd server && node server.js

# 4. in a second terminal, start the frontend
npm run dev                             # usually http://localhost:5173
```

Without a running backend the page still works with the offline FAQ (German and English) and the browser voice.

## Configuration

All secrets live in `server/.env`. **Never commit this file.**

| Variable | Purpose |
|---|---|
| `LLM_BASE_URL` | Optional. Base URL of an OpenAI-compatible provider (for example Groq). If set, this provider answers instead of Mistral |
| `LLM_API_KEY` | API key of that provider |
| `LLM_MODEL` | Model name at that provider |
| `MISTRAL_API_KEY` | Mistral API key (default provider when `LLM_BASE_URL` is not set) |
| `ELEVENLABS_API_KEY` | ElevenLabs secret key (starts with `sk_`) |
| `ELEVENLABS_VOICE_ID_EAH` | Voice ID for Elena |
| `ELEVENLABS_VOICE_ID_ANIME` | Voice ID for Mika |
| `FRONTEND_URL` | Exact origin of the site including `https://`, without a trailing slash |
| `PORT` | Backend port (default 3001) |

After changing `.env`, restart the backend. With PM2: `pm2 restart avatar-backend --update-env`.

Visual and behavior settings are named constants at the top of `src/main.js`:

| Constant | Controls |
|---|---|
| `LANGUAGES`, `I18N` | languages and all interface texts |
| `AVATAR_CHARACTERS` | avatars (name, type, model, thumbnail, voice) |
| `APP_QR`, `SITE_QR` | titles and links of the two QR codes (empty link hides it) |
| `ROOM`, `CAMERA_LIMITS` | room size and how far the camera may move |
| `SCREEN` | size and timing of the wall screen |
| `FX` | particles, parallax, camera intro, bubbles |
| `IDLE_TIMEOUT_MS`, `IDLE_WARNING_S` | kiosk reset |

To add a language: add it to `LANGUAGES`, add its texts to `I18N` (copy the English block), and add its English name to `LANGUAGE_NAMES` in `server/server.js`.

## Deployment

The built frontend is served by Apache; Apache forwards `/api` to the Node backend, which runs under PM2.

```bash
npm install
npm run build                              # make sure VITE_API_BASE_URL is empty (.env.production)
sudo cp -r dist/* /var/www/avatar/
pm2 restart avatar-backend --update-env
```

Apache needs `DocumentRoot /var/www/avatar` and `ProxyPass /api http://127.0.0.1:3001/api` in its HTTPS virtual host (modules: `proxy`, `proxy_http`, `headers`, `ssl`). Details are in the project documentation.

## Security

- Keys, passwords and account data are **not** part of this repository.
- `server/.env` is listed in `.gitignore`. If a key is ever committed by mistake, revoke it at the provider and create a new one.
- Visitor questions are sent to the configured AI provider, and the answer texts to ElevenLabs. Clarify data protection requirements with the university before public use.
