import express from "express"
import cors from "cors"
import { GoogleGenAI } from "@google/genai"
import dotenv from "dotenv"

dotenv.config()

const apiKey = process.env.GEMINI_API_KEY
const elevenApiKey = process.env.ELEVENLABS_API_KEY

if (!apiKey) {
    console.error("❌ ERROR: GEMINI_API_KEY is missing from your .env file!")
} else {
    console.log(`✅ GEMINI_API_KEY successfully loaded (starts with ${apiKey.slice(0, 4)}...)`)
}

if (!elevenApiKey) {
    console.warn("⚠️ WARNING: ELEVENLABS_API_KEY is missing from your .env file!")
} else {
    console.log(`✅ ELEVENLABS_API_KEY successfully loaded`)
}

const ai = new GoogleGenAI({ apiKey: apiKey })

const app = express()
// In production, set FRONTEND_URL in your hosting provider's environment
// variables to your deployed frontend's exact URL (e.g.
// https://your-app.vercel.app) so only your site can call this backend.
// Left open ("*") if unset, which is fine for local development.
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }))
app.use(express.json())

const SYSTEM_PROMPT = `You are the virtual assistant avatar for Ernst-Abbe-Hochschule Jena (EAH Jena), a university of applied sciences in Jena, Germany.

Facts you can rely on:
- Founded 1991, renamed Ernst-Abbe-Hochschule in 2014, named after Ernst Abbe.
- Around 4,200 students.
- Campus on Carl-Zeiss-Promenade in Jena, Thuringia.
- About 50 bachelor's and master's programs across four fields: technology, business, social affairs, and health.
- Most programs are admission-free; many are tuition-free.
- Typical application deadlines: July 15 (winter semester), February 15 (summer semester).

Guidelines:
- Keep answers short and spoken-friendly (2-4 sentences), since they'll be read aloud by text-to-speech.
- Be warm and welcoming, like a campus tour guide.
- If you don't know a specific detail, say so honestly and suggest checking eah-jena.de rather than guessing.`

app.get("/", (req, res) => {
    res.send("EAH Jena assistant backend is running.")
})

// Chat endpoint (Gemini)
app.post("/api/chat", async (req, res) => {
    try {
        const { question, history = [] } = req.body

        if (!question || typeof question !== "string") {
            return res.status(400).json({ error: "Missing question" })
        }

        let promptText = ""
        for (const turn of history) {
            const speaker = turn.role === "assistant" ? "Assistant" : "User"
            promptText += `${speaker}: ${turn.content}\n`
        }
        promptText += `User: ${question}`

        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: promptText,
            config: {
                systemInstruction: SYSTEM_PROMPT
            }
        })

        res.json({ answer: response.text })

    } catch (err) {
        console.error("Gemini API error details:", err)
        res.status(500).json({ error: "Something went wrong talking to Gemini." })
    }
})

// Text-to-Speech endpoint (ElevenLabs)
app.post("/api/tts", async (req, res) => {
    try {
        const { text } = req.body
        if (!text) return res.status(400).json({ error: "Missing text" })

        // Default ElevenLabs voice ID
        const voiceId = "pNInz6obpgDQGcFmaJgB" // Replace with your desired voice ID
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
            method: "POST",
            headers: {
                "xi-api-key": process.env.ELEVENLABS_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_flash_v2_5" // Low-latency Flash model optimized for real-time agents
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("ElevenLabs API error:", response.status, errorText)
            throw new Error(`ElevenLabs API returned status ${response.status}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        res.set("Content-Type", "audio/mpeg")
        res.send(Buffer.from(arrayBuffer))

    } catch (err) {
        console.error("TTS error:", err)
        res.status(500).json({ error: "Failed to generate neural speech." })
    }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
})