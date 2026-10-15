# EAH Virtual Campus Assistant
## Project Documentation & Technical Catalogue
*Prepared from the supplied frontend (main.js) and backend (server.js) source files • 15 October 2026*

> Scope note: This document is based on the supplied `main.js` and `server.js` files. Other repository files and exact dependency versions were not supplied, so unknown details are identified rather than assumed.

## 1. Project Overview

### Purpose

The EAH Virtual Campus Assistant is a browser-based 3D avatar assistant for Ernst-Abbe-Hochschule Jena (EAH Jena). Users choose a language and an avatar, then ask questions by text or voice. The assistant generates a response through a language-model backend, speaks the response using text-to-speech, and animates the avatar's mouth to approximate speech.

### Current scope

This documentation is grounded in the two supplied source files: main.js (frontend) and server.js (backend). It documents behaviour visible in those files. Project assets, style.css, package.json, deployment configuration, and any other repository files were not supplied, so their exact contents and versions cannot be confirmed.

### Project status

The code supports a prototype with two configured avatar entries, German and English interface modes, a local FAQ fallback, configurable OpenAI-compatible LLM providers, and ElevenLabs speech synthesis with browser speech fallback.

## 2. Feature Catalogue

### 3D avatar display

Three.js renders the scene, camera, lighting, gradient background, ground disc, and avatar. GLB and VRM avatar formats have separate loading and animation paths.

### Avatar selection

The start screen offers Elena (GLB) and Mika (VRM). Each entry defines an ID, display name, model path, thumbnail path, avatar type, and TTS voice key.

### Language selection

Users must choose English or German before selecting an avatar. The selection drives interface labels, browser speech-recognition language, browser TTS language, FAQ language, and the language sent to the backend.

### Text chat

Users enter a question in the chat input and submit with the Send button or Enter key. The frontend sends the question, recent conversation history, and selected language to the backend.

### Voice input

The frontend uses the browser SpeechRecognition API or webkitSpeechRecognition when available. If neither is available, the microphone button is disabled and an explanatory title is shown.

### LLM responses

The backend sends a system prompt, conversation history, and the latest question to either an OpenAI-compatible endpoint or Mistral. The selected provider is configured through environment variables.

### Text-to-speech

The backend proxies ElevenLabs text-to-speech requests so the API key remains server-side. Voice IDs are configured separately for the EAH and anime avatar voice keys.

### Lip-sync

When ElevenLabs returns character alignment, the frontend uses character timing to drive jaw movement. When ElevenLabs fails, browser speech synthesis is used and mouth movement falls back to a simple animated waveform.

### Idle animation and gestures

The code includes idle arm sway, automatic blinking, a short bow gesture after loading, and subtle vertical avatar movement. VRM models also receive per-frame updates for spring-bone physics and related runtime features.

### Offline FAQ fallback

If the chat backend request fails, the frontend searches a small keyword-based FAQ in the selected language. This is a fallback, not a full offline language model.

## 3. System Architecture

### Frontend

main.js is a browser-side JavaScript module using Vite-style asset imports, Three.js, OrbitControls, GLTFLoader, and @pixiv/three-vrm. It creates the 3D scene and user interface dynamically and calls the backend using fetch.

### Backend

server.js is a Node.js Express server. It loads environment variables with dotenv, enables CORS, parses JSON request bodies, handles chat completion requests, and proxies ElevenLabs TTS.

### Request flow

1) User chooses language and avatar. 2) The selected model is loaded. 3) User submits a text or voice question. 4) Frontend POSTs to /api/chat. 5) Backend calls the configured LLM provider. 6) The response is returned to the browser. 7) Frontend sends the answer to /api/tts. 8) Backend requests speech audio plus timestamps from ElevenLabs. 9) Browser plays audio and uses timing data for mouth animation.

### Default addresses

The backend defaults to http://localhost:3001. The frontend defaults to http://localhost:3001 for API calls unless VITE_API_BASE_URL is set. The Vite development server address depends on the local Vite configuration, which was not supplied.

## 4. Technology Catalogue

### Three.js

3D scene, camera, lights, renderer, meshes, animation loop.

### GLTFLoader

Loads GLB/GLTF avatar models.

### @pixiv/three-vrm

Adds VRM avatar support, humanoid bone access, facial expressions, VRM0 rotation handling, and runtime updates.

### OrbitControls

Camera orbit controls.

### Vite-style frontend

The source uses import.meta.env and imports CSS/assets as modules, indicating a Vite-based frontend setup.

### Node.js + Express

Backend HTTP server and API routes.

### cors + dotenv

Cross-origin request configuration and environment-variable loading.

### Mistral SDK

Default LLM integration when LLM_BASE_URL is not configured.

### OpenAI-compatible LLM API

Alternative provider path, configurable for providers such as Groq or Gemini, using a base URL, API key, and model name.

### ElevenLabs API

Speech generation using the eleven_flash_v2_5 model and character-level timing output.

### Browser Web Speech APIs

SpeechRecognition for voice input when supported, and speechSynthesis as the TTS fallback.

## 5. Repository and Asset Catalogue

### main.js

Frontend entry module. Contains language strings, avatar registry, offline FAQ entries, API calls, Three.js scene creation, model loading, animation, lip-sync, speech handling, and chat UI.

### server.js

Backend entry module. Contains LLM provider selection, system prompts, Express setup, /api/chat and /api/tts endpoints, and server startup.

### style.css

Imported by main.js, but its contents were not supplied. It likely contains visual styling; selectors and actual appearance cannot be documented precisely from the supplied files.

### EAH_Logo.png

Imported as the EAH logo and used in the interface badge. The source file itself was not supplied.

### Avatar_1.glb

Configured model path: /models/Avatar_1.glb. Display name Elena; type GLB; TTS voice key eah.

### Avatar_4.vrm

Configured model path: /models/Avatar_4.vrm. Display name Mika; type VRM; TTS voice key anime.

### Avatar thumbnails

Configured paths: /thumbnails/Avatar_1.png and /thumbnails/Avatar_4.png. If a thumbnail fails to load, the image is hidden.

### Important

The listed asset paths are references found in the source code, not confirmation that the files exist in the repository.

## 6. Environment Configuration

### Frontend .env

Set VITE_API_BASE_URL when the backend is not available at the default http://localhost:3001. For example, VITE_API_BASE_URL=http://localhost:3001. Vite variables prefixed with VITE_ are exposed to frontend code, so never put private API keys in frontend environment variables.

### Backend .env — OpenAI-compatible provider

Set all three variables to use an OpenAI-compatible provider. Example for Groq: LLM_BASE_URL=https://api.groq.com/openai/v1 ; LLM_API_KEY=your_groq_api_key ; LLM_MODEL=llama-3.3-70b-versatile. The chosen model must still be available to the account/provider.

### Backend .env — Mistral fallback

If LLM_BASE_URL is omitted, the backend uses MISTRAL_API_KEY and the fixed model mistral-small-latest. The Mistral SDK must be installed.

### Backend .env — ElevenLabs

ELEVENLABS_API_KEY is required for the configured TTS provider. ELEVENLABS_VOICE_ID_EAH configures the EAH avatar voice; ELEVENLABS_VOICE_ID_ANIME configures the anime avatar voice.

### Backend .env — CORS

FRONTEND_URL can restrict CORS to the exact frontend origin in production, without a trailing slash. If it is unset, the source allows all origins ('*'), which is convenient for local development but should be reviewed before deployment.

### Backend .env — port

PORT is optional and defaults to 3001.

### Example backend .env

LLM_BASE_URL=https://api.groq.com/openai/v1\nLLM_API_KEY=replace_with_real_key\nLLM_MODEL=llama-3.3-70b-versatile\nELEVENLABS_API_KEY=replace_with_real_key\nELEVENLABS_VOICE_ID_EAH=replace_with_voice_id\nELEVENLABS_VOICE_ID_ANIME=replace_with_voice_id\nFRONTEND_URL=http://localhost:5173\nPORT=3001

## 7. API Reference

### GET /

Purpose: health/status message. Success response is plain text: EAH Jena assistant backend is running.

### POST /api/chat

Request JSON fields: question (required string), history (optional array, defaults to []), language (optional; only 'en' selects English, all other values default to German). History turns are normalized to assistant or user roles. Success response: { "answer": "..." }. Missing or invalid question returns HTTP 400 with { "error": "Missing question" }. Provider/runtime failure returns HTTP 500 with a generic error message.

### POST /api/tts

Request JSON fields: text (required string), voice (optional key such as 'eah' or 'anime'), language (optional; 'en' selects English, otherwise German). The backend chooses the requested configured voice, falling back to the EAH voice ID for an unknown voice key. It calls ElevenLabs /with-timestamps using eleven_flash_v2_5 and returns the provider JSON, expected by the frontend to include audio_base64 and alignment. Missing text returns HTTP 400; missing voice configuration returns HTTP 500; an ElevenLabs provider failure returns HTTP 502; other errors return HTTP 500.

## 8. Language and Assistant Behaviour

### German mode

The backend system prompt tells the assistant to always answer in German, keep responses short (2–4 sentences), use a friendly campus-guide tone, and admit when it does not know a detail, recommending eah-jena.de rather than guessing.

### English mode

The backend system prompt tells the assistant to always answer in English, keep responses short (2–4 sentences), use a friendly campus-guide tone, and recommend eah-jena.de for unknown details.

### Seed facts

The prompts contain facts about EAH Jena: founded in 1991; named Ernst-Abbe-Hochschule in 2014; around 4,200 students; campus at Carl-Zeiss-Promenade in Jena; about 50 bachelor's and master's programmes across technology, business, social work, and health; usual application deadlines of 15 July for winter semester and 15 February for summer semester. These are hard-coded prompt facts and should be verified before being used as official current information.

### FAQ matching

The local fallback checks whether the lowercased question contains any keyword in a FAQ entry. The first matching entry is returned. This approach is simple and may match unrelated questions or fail to recognize paraphrases.

## 9. Setup and Runbook

### Prerequisites

Install a supported Node.js version and npm. Install Git if cloning the repository. Use a modern browser with WebGL. Voice input depends on browser support and may require microphone permission. Exact version requirements cannot be confirmed without package.json.

### Clone in VS Code

Open the target project folder or use the VS Code terminal. To clone into the current empty folder, run: git clone <repository-url> . — the final dot means the current directory. Alternatively use Ctrl+Shift+P → Git: Clone and choose a destination folder.

### Install dependencies

Run npm install in the frontend project directory and, if the backend has a separate package.json, run npm install in the backend directory too. The exact directory layout is not known from the two supplied files.

### Configure environment

Create the backend .env file with the LLM provider and ElevenLabs settings. Configure VITE_API_BASE_URL in the frontend environment if the backend address differs from the default. Keep .env out of source control.

### Start backend

From the backend directory, run the project's configured start script if present. If there is no script, the exact command depends on Node.js module configuration and package.json. The source uses ES module import syntax.

### Start frontend

From the frontend directory, run the configured Vite development script if present (commonly npm run dev). The exact script must be confirmed in package.json.

### Verify

Open the frontend URL; choose English or German and an avatar; confirm the model loads; send a simple question; check the backend console for provider errors; confirm speech playback; test voice input only after granting microphone access.

## 10. Configuration and Extension Guide

### Add an avatar

Add an object to AVATAR_CHARACTERS with a unique id, display name, type ('glb' or 'vrm'), model path, thumbnail path, and voice key. Place the model and thumbnail at those paths. The voice key must map to a configured backend voice ID in ELEVENLABS_VOICE_IDS, or the EAH voice is used as fallback.

### Add a language

Add the language's UI strings to I18N in main.js, including speechLang, heading, langLabel, loading, badgeSub, greeting, placeholder, send, thinking, micTitle, micUnsupported, and fallback. Add a language option to the start-screen dropdown. Add a matching language branch and system prompt in server.js. Update FAQ entries and language normalization as needed. The current backend supports only English and German; any other value falls back to German.

### Change LLM provider

Set LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL in the backend environment. The backend appends /chat/completions to the configured base URL. The provider must implement the expected OpenAI-compatible chat-completions API shape.

### Change speech voice

Set the correct ElevenLabs voice IDs in the backend environment. Voice selection is mapped by the frontend's character.voice property to the backend's ELEVENLABS_VOICE_IDS keys.

### Improve FAQ coverage

Add keyword and answer entries to KNOWLEDGE_BASE and KNOWLEDGE_BASE_EN. Keep answers aligned with approved university information and review keyword collisions.

## 11. Troubleshooting

### Avatar does not load

Check the model path, file name capitalization, browser Network tab, and console errors. Confirm the file is served from the frontend public path. For VRM, confirm the file contains VRM metadata and that the VRM loader plugin is active.

### Avatar stays in T-pose or has awkward arms

Check the model rig and humanoid bones. The GLB animation code expects specific bone names; the VRM path uses normalized humanoid bones. Arm rotation values are model-specific and may need tuning.

### Chat returns an error

Check backend availability, API key, model identifier, base URL, provider quota, and backend logs. For OpenAI-compatible providers, ensure the base URL does not already include /chat/completions because the backend appends that path.

### Chat silently uses FAQ fallback

If /api/chat fails, the frontend logs a warning and returns a local FAQ answer. Inspect the browser console and backend logs to identify the original error.

### No speech output

Check ELEVENLABS_API_KEY and both voice IDs. Inspect backend logs for provider errors and browser console for TTS errors. Browser speech synthesis is the fallback if the ElevenLabs request fails.

### Mouth does not match speech

The ElevenLabs path depends on returned alignment fields. The code expects characters and character_start_times_seconds. The fallback uses a simple vowel-based/sine-wave approximation, not phoneme-accurate lip-sync.

### Microphone is unavailable

Use a browser supporting SpeechRecognition or webkitSpeechRecognition, allow microphone access, and test in a secure context where required by the browser.

### CORS errors

Set FRONTEND_URL to the frontend's exact origin, including scheme and port, with no trailing slash. Ensure the frontend calls the intended backend URL.

## 12. Security, Privacy, and Reliability Notes

### Secrets

LLM and ElevenLabs keys belong only in the backend environment. Do not commit .env files or embed private keys in frontend code.

### CORS

The backend permits all origins when FRONTEND_URL is unset. Restrict this in production.

### Input validation

The API validates that question/text are non-empty strings, but there are no visible length limits, rate limits, authentication, or schema validation for history turns in the supplied code.

### Conversation history

The frontend keeps a maximum of ten history entries, counting user and assistant turns together. History is held in the page's memory and sent with each chat request. The supplied code does not persist it to a database.

### External services

Questions are sent to the configured LLM provider. Text submitted for speech is sent to ElevenLabs through the backend. Consider privacy notices and institutional approval before public deployment.

### Error details

LLM provider errors are logged server-side and returned to the browser as a generic 500 response. ElevenLabs provider errors are logged server-side and returned as a generic 502 response.

### Production readiness

Before public release, review CORS, HTTPS, secret management, usage limits, rate limiting, monitoring, accessibility, browser compatibility, and whether the hard-coded university facts are current and officially approved.

## 13. Known Limitations and Items to Confirm

### Missing project files

This catalogue is not a complete repository audit because only main.js and server.js were supplied. Confirm package.json files, lockfiles, style.css, asset directories, README, deployment scripts, and any licensing documents.

### Hard-coded facts

The system prompt and offline FAQ contain static facts and application deadlines. They are not retrieved from a live university data source.

### Language behaviour

The frontend UI and FAQ support German and English, and backend language normalization supports only those two options. The source prompts say to always answer in the selected language, despite comments/labels that may imply language-specific behaviour.

### Avatar registry

Only two avatars are configured in the supplied code. The existence and licenses of the models and thumbnails were not provided.

### TTS response shape

The frontend expects ElevenLabs to return audio_base64 and alignment. Confirm this shape against the account/API response used by the deployed version.

### Dependencies and versions

Exact package versions and Node.js version are not stated in the supplied source files.

## 14. Suggested Future Improvements

### Knowledge management

Move approved university content into a versioned knowledge base or retrieval system, with source links and an update owner.

### Fallback visibility

Show a clear UI message when the backend fails and the local FAQ fallback is used, instead of returning a fallback answer without an obvious status indicator.

### Conversation controls

Add a clear-chat control and optionally make history length configurable.

### Accessibility

Add keyboard navigation checks, visible focus states, captions/subtitles controls, reduced-motion support, and screen-reader labels for controls.

### Reliability

Add request timeouts, rate limiting, structured logging, health checks, and automated tests for chat/TTS endpoints.

### Testing

Test each avatar, language, LLM provider, voice ID, missing-key case, offline mode, and browser fallback.

### Documentation maintenance

Keep this document and a concise README aligned with actual environment variable names and package scripts.

## Appendix A. Example Environment Files

### Backend .env example

LLM_BASE_URL=https://api.groq.com/openai/v1\nLLM_API_KEY=your_groq_api_key\nLLM_MODEL=llama-3.3-70b-versatile\nELEVENLABS_API_KEY=your_elevenlabs_api_key\nELEVENLABS_VOICE_ID_EAH=your_eah_voice_id\nELEVENLABS_VOICE_ID_ANIME=your_anime_voice_id\nFRONTEND_URL=http://localhost:5173\nPORT=3001

### Frontend .env example

VITE_API_BASE_URL=http://localhost:3001

### Git safety

Add .env files to .gitignore. Commit a .env.example containing placeholders only.

## Appendix B. Quick Reference

### Chat request

POST /api/chat — { question, history?, language? } → { answer }

### Speech request

POST /api/tts — { text, voice?, language? } → ElevenLabs response including audio and alignment data expected by the frontend

### Backend port

3001 by default

### Frontend API variable

VITE_API_BASE_URL

### LLM variables

LLM_BASE_URL, LLM_API_KEY, LLM_MODEL; or MISTRAL_API_KEY if no LLM_BASE_URL

### Speech variables

ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID_EAH, ELEVENLABS_VOICE_ID_ANIME

### CORS variable

FRONTEND_URL

### Languages

German (de) and English (en)

### Configured avatars

Elena (GLB, voice key eah); Mika (VRM, voice key anime)
