import express from "express"
import cors from "cors"
import { Mistral } from "@mistralai/mistralai"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

// ======================
// Language model provider
// ======================
//
// Default: Mistral (needs MISTRAL_API_KEY).
// To use any OpenAI-compatible provider instead (Google Gemini, Groq, ...),
// set all three of these in .env — no code change needed:
//   LLM_BASE_URL  e.g. https://generativelanguage.googleapis.com/v1beta/openai
//   LLM_API_KEY   the provider's API key
//   LLM_MODEL     e.g. gemini-2.5-flash
// Remove LLM_BASE_URL to go back to Mistral.

const LLM_BASE_URL = process.env.LLM_BASE_URL
const LLM_API_KEY = process.env.LLM_API_KEY
const LLM_MODEL = process.env.LLM_MODEL

const mistralKey = process.env.MISTRAL_API_KEY
const mistral = mistralKey ? new Mistral({ apiKey: mistralKey }) : null

if (LLM_BASE_URL) {
    if (!LLM_API_KEY || !LLM_MODEL) {
        console.error("ERROR: LLM_BASE_URL is set, but LLM_API_KEY or LLM_MODEL is missing in .env")
    } else {
        console.log(`Using OpenAI-compatible provider: ${LLM_BASE_URL} (model: ${LLM_MODEL})`)
    }
} else if (!mistralKey) {
    console.error("ERROR: MISTRAL_API_KEY is missing from your .env file (or set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL)")
} else {
    console.log("Using Mistral (mistral-small-latest)")
}

async function getCompletion(messages) {
    if (LLM_BASE_URL) {
        const r = await fetch(`${LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${LLM_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ model: LLM_MODEL, messages })
        })

        if (!r.ok) {
            throw new Error(`LLM provider error ${r.status}: ${await r.text()}`)
        }

        const data = await r.json()
        return data.choices[0].message.content
    }

    if (!mistral) {
        throw new Error("No language model configured")
    }

    const response = await mistral.chat.complete({
        model: "mistral-small-latest",
        messages
    })
    return response.choices[0].message.content
}

// ======================
// Text-to-speech configuration
// ======================

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// One ElevenLabs voice per avatar character. The frontend sends which
// avatar is active as `voice` in the /api/tts request body; unknown or
// missing values fall back to the EAH voice.
const ELEVENLABS_VOICE_IDS = {
    eah: process.env.ELEVENLABS_VOICE_ID_EAH,
    anime: process.env.ELEVENLABS_VOICE_ID_ANIME
}

if (!ELEVENLABS_API_KEY) {
    console.warn("WARNING: ELEVENLABS_API_KEY is missing — /api/tts will fail until it's set")
}
if (!ELEVENLABS_VOICE_IDS.eah) {
    console.warn("WARNING: ELEVENLABS_VOICE_ID_EAH is missing — /api/tts will fail for the EAH avatar until it's set")
}
if (!ELEVENLABS_VOICE_IDS.anime) {
    console.warn("WARNING: ELEVENLABS_VOICE_ID_ANIME is missing — /api/tts will fail for the anime avatar until it's set")
}

const app = express()

// Set FRONTEND_URL in production to the exact frontend origin (no trailing
// slash) so only your own site can call this backend. Open when unset,
// which is fine for local development.
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }))
app.use(express.json())

// One system prompt per supported language. The frontend sends
// `language` ("de" or "en") with every chat and TTS request.
const SYSTEM_PROMPTS = {
    de: `Du bist der virtuelle Assistent-Avatar der Ernst-Abbe-Hochschule Jena (EAH Jena), einer Hochschule für angewandte Wissenschaften in Jena, Deutschland.

Antworte immer auf Deutsch, auch wenn die Frage auf Englisch gestellt wird.

Fakten, auf die du dich verlassen kannst:
- Gegründet 1991, seit 2014 unter dem Namen Ernst-Abbe-Hochschule, benannt nach Ernst Abbe.
- Rund 4.200 Studierende.
- Campus an der Carl-Zeiss-Promenade in Jena, Thüringen.
- Etwa 50 Bachelor- und Masterstudiengänge in vier Bereichen: Technik, Wirtschaft, Soziales und Gesundheit.
- Die meisten Studiengänge sind zulassungsfrei; viele sind auch gebührenfrei.
- Übliche Bewerbungsfristen: 15. Juli (Wintersemester), 15. Februar (Sommersemester).

Richtlinien:
- Halte Antworten kurz und gut vorlesbar (2-4 Sätze), da sie per Text-to-Speech vorgelesen werden.
- Sei freundlich und einladend, wie ein Campusführer.
- Wenn du ein bestimmtes Detail nicht kennst, sag das ehrlich und empfiehl, auf eah-jena.de nachzuschauen, statt zu raten.`,

    en: `You are the virtual assistant avatar of Ernst-Abbe-Hochschule Jena (EAH Jena), a university of applied sciences in Jena, Germany.

Always answer in English, even if the question is asked in German.

Facts you can rely on:
- Founded in 1991, named Ernst-Abbe-Hochschule since 2014 after Ernst Abbe.
- Around 4,200 students.
- Campus on Carl-Zeiss-Promenade in Jena, Thuringia.
- About 50 bachelor's and master's programs in four areas: technology, business, social work and health.
- Most programs have no admission restrictions; many are also free of tuition fees.
- Usual application deadlines: July 15 (winter semester), February 15 (summer semester).

Guidelines:
- Keep answers short and easy to read aloud (2-4 sentences), since they are spoken by text-to-speech.
- Be friendly and welcoming, like a campus guide.
- If you don't know a specific detail, say so honestly and recommend checking eah-jena.de instead of guessing.`
}

// Supported languages (code -> English name). The frontend sends the code
// with every chat and TTS request. To add a language, add one line here and
// the matching entry in the frontend (LANGUAGES and I18N in main.js).
// German and English have their own hand-written prompts above; all other
// languages use the English prompt plus an instruction to answer in that
// language.
const LANGUAGE_NAMES = {
    de: "German",
    en: "English",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    pt: "Portuguese",
    nl: "Dutch",
    pl: "Polish",
    tr: "Turkish",
    ru: "Russian",
    uk: "Ukrainian",
    ar: "Arabic",
    zh: "Chinese (Simplified)",
    ja: "Japanese"
}

// Anything unknown or missing falls back to German.
function normalizeLanguage(language) {
    return LANGUAGE_NAMES[language] ? language : "de"
}

function basePrompt(lang) {
    if (lang === "de" || lang === "en") return SYSTEM_PROMPTS[lang]
    return SYSTEM_PROMPTS.en.replace(
        "Always answer in English, even if the question is asked in German.",
        `Always answer in ${LANGUAGE_NAMES[lang]}, even if the question is asked in another language.`
    )
}

// ======================
// Extra knowledge (server/knowledge.md)
// ======================
//
// Facts the assistant may use beyond the short list in the system prompt.
// Edit server/knowledge.md and the change is picked up on the next
// question — no restart needed. Lines starting with // are comments and
// are not sent to the model. Keep it to verified facts, and never put
// personal data in it.

const KNOWLEDGE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "knowledge.md")
const KNOWLEDGE_MAX_CHARS = 20000

let knowledgeCache = { mtime: 0, text: "" }

function getKnowledge() {
    try {
        const stat = fs.statSync(KNOWLEDGE_FILE)
        if (stat.mtimeMs !== knowledgeCache.mtime) {
            let text = fs.readFileSync(KNOWLEDGE_FILE, "utf8")
                .split(/\r?\n/)
                .filter(line => !line.trim().startsWith("//"))
                .join("\n")
                .trim()

            if (text.length > KNOWLEDGE_MAX_CHARS) {
                console.warn(`WARNING: knowledge.md is longer than ${KNOWLEDGE_MAX_CHARS} characters and was shortened`)
                text = text.slice(0, KNOWLEDGE_MAX_CHARS)
            }
            knowledgeCache = { mtime: stat.mtimeMs, text }
            console.log(`Loaded knowledge.md (${text.length} characters)`)
        }
        return knowledgeCache.text
    } catch {
        return "" // no knowledge file is fine
    }
}

const KNOWLEDGE_INTRO = {
    de: "Zusätzliches, geprüftes Wissen (die Quelle ist deutsch; antworte in der Sprache der Unterhaltung). Was hier und oben nicht steht, darfst du nicht erfinden:",
    en: "Additional verified knowledge (the source is in German; answer in the language of the conversation). Do not invent anything that is not stated here or above:"
}

function buildSystemPrompt(lang) {
    const base = basePrompt(lang)
    const knowledge = getKnowledge()
    if (!knowledge) return base
    const intro = KNOWLEDGE_INTRO[lang] || KNOWLEDGE_INTRO.en
    return `${base}\n\n${intro}\n\n${knowledge}`
}

app.get("/", (req, res) => {
    res.send("EAH Jena assistant backend is running.")
})

app.post("/api/chat", async (req, res) => {
    try {
        const { question, history = [], language } = req.body

        if (!question || typeof question !== "string") {
            return res.status(400).json({ error: "Missing question" })
        }

        const lang = normalizeLanguage(language)

        const messages = [
            { role: "system", content: buildSystemPrompt(lang) },
            ...history.map(turn => ({
                role: turn.role === "assistant" ? "assistant" : "user",
                content: turn.content
            })),
            { role: "user", content: question }
        ]

        const answer = await getCompletion(messages)
        res.json({ answer })

    } catch (err) {
        console.error("Language model error:", err)
        res.status(500).json({ error: "Something went wrong talking to the language model." })
    }
})

// ======================
// Text-to-speech (ElevenLabs), with per-character timing for lip-sync
// ======================
//
// Proxied through the backend so the ElevenLabs key never reaches the
// browser. Returns { audio_base64, alignment } straight from ElevenLabs;
// the frontend uses `alignment` to drive the jaw morph target in real time.

app.post("/api/tts", async (req, res) => {
    try {
        const { text, voice, language } = req.body

        if (!text || typeof text !== "string") {
            return res.status(400).json({ error: "Missing text" })
        }

        const lang = normalizeLanguage(language)
        const voiceId = ELEVENLABS_VOICE_IDS[voice] || ELEVENLABS_VOICE_IDS.eah

        if (!voiceId) {
            return res.status(500).json({ error: "No ElevenLabs voice ID configured" })
        }

        const elevenRes = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
            {
                method: "POST",
                headers: {
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_flash_v2_5",
                    // Tells the multilingual model which language to speak,
                    // so English text isn't read with a German accent.
                    language_code: lang
                })
            }
        )

        if (!elevenRes.ok) {
            const errText = await elevenRes.text()
            console.error("ElevenLabs API error:", elevenRes.status, errText)
            return res.status(502).json({ error: "TTS provider error" })
        }

        const data = await elevenRes.json()
        res.json(data)

    } catch (err) {
        console.error("TTS route error:", err)
        res.status(500).json({ error: "Something went wrong generating speech." })
    }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})