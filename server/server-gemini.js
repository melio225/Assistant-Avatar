// ======================
// EAH Jena Avatar Assistant — Backend (Gemini free-tier version)
// ======================
//
// Uses Google's current Gemini API (the "Interactions API" via the
// @google/genai SDK — the OLD @google/generative-ai package is
// deprecated as of Nov 2025, which is why the previous version of this
// file was returning errors).
//
// Gemini's free tier (as of mid-2026) gives a generous daily request
// allowance on Gemini Flash models, no credit card required — good fit
// for a prototype/demo like this.
//
// Setup:
//   npm install express cors @google/genai dotenv
//   Get a free key at https://aistudio.google.com/apikey (sign in with a
//   Google account, no card, no Google Cloud project needed)
//   Create a .env file with: GEMINI_API_KEY=your-key-here
//   node server-gemini.js

import express from "express"
import cors from "cors"
import { GoogleGenAI } from "@google/genai"
import dotenv from "dotenv"

dotenv.config()

// Temporary diagnostic — confirms whether .env actually loaded the key.
// Remove this line once things are working.
console.log(
    "GEMINI_API_KEY loaded:",
    process.env.GEMINI_API_KEY
        ? `yes (starts with ${process.env.GEMINI_API_KEY.slice(0, 4)}...)`
        : "NO — not found. Check .env is in this same folder and named exactly '.env'"
)

const app = express()
app.use(cors())
app.use(express.json())

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// System prompt: keeps the assistant grounded to EAH Jena and gives it
// a persona. Edit this freely as you learn more about what visitors ask.
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
- If you don't know a specific detail (exact deadlines for a particular program, staff names, current events), say so honestly and suggest checking eah-jena.de rather than guessing.
- Don't make up statistics, rankings, or facts not listed above.`

// Visiting http://localhost:3001 in a browser hits this — confirms the
// server is actually running instead of showing a confusing error
app.get("/", (req, res) => {
    res.send("EAH Jena assistant backend is running. POST questions to /api/chat.")
})

app.post("/api/chat", async (req, res) => {
    try {
        const { question, history = [] } = req.body

        if (!question || typeof question !== "string") {
            return res.status(400).json({ error: "Missing question" })
        }

        // Fold prior turns into the prompt as plain text context. Simpler
        // and more robust than reconstructing the API's multi-step
        // history format, at the cost of using slightly more tokens per
        // request — a non-issue at this conversation length.
        let promptText = ""
        for (const turn of history) {
            const speaker = turn.role === "assistant" ? "Assistant" : "User"
            promptText += `${speaker}: ${turn.content}\n`
        }
        promptText += `User: ${question}`

        const interaction = await ai.interactions.create({
            model: "gemini-3.6-flash",
            input: promptText,
            system_instruction: SYSTEM_PROMPT
        })

        const answer = interaction.output_text

        res.json({ answer })

    } catch (err) {
        console.error("Gemini API error:", err)
        res.status(500).json({ error: "Something went wrong talking to Gemini." })
    }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`EAH Jena assistant backend (Gemini) running on http://localhost:${PORT}`)
})