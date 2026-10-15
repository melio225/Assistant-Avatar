import express from "express"
import cors from "cors"
import { Mistral } from "@mistralai/mistralai"
import dotenv from "dotenv"

dotenv.config()

const apiKey = process.env.MISTRAL_API_KEY

if (!apiKey) {
    console.error("ERROR: MISTRAL_API_KEY is missing from your .env file")
}

const mistral = new Mistral({ apiKey })

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

// Anything unknown or missing falls back to German.
function normalizeLanguage(language) {
    return language === "en" ? "en" : "de"
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
            { role: "system", content: SYSTEM_PROMPTS[lang] },
            ...history.map(turn => ({
                role: turn.role === "assistant" ? "assistant" : "user",
                content: turn.content
            })),
            { role: "user", content: question }
        ]

        const response = await mistral.chat.complete({
            model: "mistral-small-latest",
            messages
        })

        res.json({ answer: response.choices[0].message.content })

    } catch (err) {
        console.error("Mistral API error:", err)
        res.status(500).json({ error: "Something went wrong talking to Mistral." })
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