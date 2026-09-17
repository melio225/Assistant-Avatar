import express from "express"
import cors from "cors"
import { GoogleGenAI } from "@google/genai"
import dotenv from "dotenv"

dotenv.config()

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
    console.error("ERROR: GEMINI_API_KEY is missing from your .env file")
}

const ai = new GoogleGenAI({ apiKey })

const app = express()

// Set FRONTEND_URL in production to the exact frontend origin (no trailing
// slash) so only your own site can call this backend. Open when unset,
// which is fine for local development.
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
            config: { systemInstruction: SYSTEM_PROMPT }
        })

        res.json({ answer: response.text })

    } catch (err) {
        console.error("Gemini API error:", err)
        res.status(500).json({ error: "Something went wrong talking to Gemini." })
    }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})