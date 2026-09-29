import './style.css'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import eahLogoUrl from './assets/EAH_Logo.png'


// ======================
// EAH Jena Knowledge Base (offline fallback)
// ======================

const KNOWLEDGE_BASE = [
    {
        keywords: ["was ist die eah", "über die eah", "wer bist du", "welche hochschule", "willkommen"],
        answer: "Ich bin der virtuelle Assistent der Ernst-Abbe-Hochschule Jena, kurz EAH Jena. Wir sind eine Hochschule für angewandte Wissenschaften in Jena, gegründet 1991, mit rund viertausendzweihundert Studierenden."
    },
    {
        keywords: ["studiengang", "studium", "studieren", "fach", "fachbereich", "fachbereiche"],
        answer: "Die EAH Jena bietet rund fünfzig Bachelor- und Masterstudiengänge in vier Bereichen: Technik, Wirtschaft, Soziales und Gesundheit. Dazu gehören zum Beispiel Elektrotechnik, Maschinenbau, Medizintechnik und Biotechnologie, Betriebswirtschaft sowie Gesundheit und Pflege."
    },
    {
        keywords: ["lage", "wo ist", "adresse", "campus"],
        answer: "Unser Campus liegt an der Carl-Zeiss-Promenade in Jena, im Bundesland Thüringen."
    },
    {
        keywords: ["zulassung", "bewerben", "bewerbung", "frist", "einschreiben"],
        answer: "Die meisten unserer Studiengänge sind zulassungsfrei, viele auch gebührenfrei. Bewerbungsfristen sind in der Regel der 15. Juli für das Wintersemester und der 15. Februar für das Sommersemester — genaue Termine findest du auf der jeweiligen Studiengangsseite."
    },
    {
        keywords: ["geschichte", "gegründet", "wann wurde", "ernst abbe"],
        answer: "Die Hochschule wurde 1991 gegründet und trägt seit 2014 den Namen Ernst-Abbe-Hochschule, benannt nach Ernst Abbe, einem Forscher, Unternehmer und Sozialreformer aus der Zeiss- und Jenaer Wissenschaftstradition."
    },
    {
        keywords: ["hallo", "hi", "guten tag"],
        answer: "Hallo! Willkommen an der EAH Jena. Was möchtest du wissen?"
    },
    {
        keywords: ["danke", "vielen dank"],
        answer: "Gerne! Sag Bescheid, wenn du noch etwas über die EAH Jena wissen möchtest."
    }
]

const FALLBACK_ANSWER =
    "Das ist eine gute Frage — dazu habe ich noch keine Angabe, aber ich empfehle, auf eah-jena.de nachzuschauen oder das Studierendensekretariat zu fragen."

function findAnswer(question) {
    const q = question.toLowerCase()
    for (const entry of KNOWLEDGE_BASE) {
        if (entry.keywords.some(k => q.includes(k))) {
            return entry.answer
        }
    }
    return FALLBACK_ANSWER
}


// ======================
// Backend
// ======================
//
// Set VITE_API_BASE_URL at build time in production. Leave it empty when
// frontend and backend share a domain — requests then go to /api/... on
// the same origin, so no CORS is involved.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
const CHAT_ENDPOINT = `${API_BASE_URL}/api/chat`
const TTS_ENDPOINT = `${API_BASE_URL}/api/tts`

let conversationHistory = []

async function getAnswer(question) {
    try {
        const response = await fetch(CHAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, history: conversationHistory })
        })

        if (!response.ok) throw new Error("Backend returned " + response.status)

        const data = await response.json()

        conversationHistory.push({ role: "user", content: question })
        conversationHistory.push({ role: "assistant", content: data.answer })

        if (conversationHistory.length > 10) {
            conversationHistory = conversationHistory.slice(-10)
        }

        return data.answer

    } catch (err) {
        console.warn("Backend unreachable, using local FAQ fallback:", err)
        return findAnswer(question)
    }
}


// ======================
// Scene
// ======================

function createGradientBackground() {
    const canvas = document.createElement("canvas")
    canvas.width = 2
    canvas.height = 512

    const ctx = canvas.getContext("2d")
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, "#004d4d")
    gradient.addColorStop(0.5, "#007373")
    gradient.addColorStop(1, "#a9d6d6")

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

const scene = new THREE.Scene()
scene.background = createGradientBackground()

const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 64),
    new THREE.MeshStandardMaterial({
        color: 0x003333,
        transparent: true,
        opacity: 0.25,
        roughness: 0.8
    })
)
ground.rotation.x = -Math.PI / 2
scene.add(ground)


// ======================
// DOM chrome (loading overlay, badge, vignette)
// ======================

function buildLoadingOverlay() {
    const overlay = document.createElement("div")
    overlay.id = "loading-overlay"

    const spinner = document.createElement("div")
    spinner.className = "loading-spinner"

    const text = document.createElement("div")
    text.className = "loading-text"
    text.textContent = "Assistent wird geladen..."

    overlay.appendChild(spinner)
    overlay.appendChild(text)
    document.body.appendChild(overlay)
}

function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay")
    if (overlay) overlay.classList.add("hidden")
}

function buildBadge() {
    const badge = document.createElement("div")
    badge.id = "uni-badge"

    const logo = document.createElement("img")
    logo.id = "badge-logo"
    logo.src = eahLogoUrl
    logo.alt = "EAH Jena logo"

    const textCol = document.createElement("div")
    textCol.id = "badge-text"

    const title = document.createElement("div")
    title.className = "badge-title"
    title.textContent = "Ernst-Abbe-Hochschule Jena"

    const sub = document.createElement("div")
    sub.className = "badge-sub"
    sub.textContent = "Virtueller Campus-Assistent"

    textCol.appendChild(title)
    textCol.appendChild(sub)
    badge.appendChild(logo)
    badge.appendChild(textCol)
    document.body.appendChild(badge)
}

function buildVignette() {
    const v = document.createElement("div")
    v.className = "vignette-overlay"
    document.body.appendChild(v)
}

buildLoadingOverlay()
buildBadge()
buildVignette()


// ======================
// Camera, renderer, controls, lights
// ======================

const camera = new THREE.PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
)
camera.position.set(0, 1.4, 3)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1.2, 0)
controls.update()

const directionalLight = new THREE.DirectionalLight(0xffffff, 3)
directionalLight.position.set(1, 2, 3)
scene.add(directionalLight)
scene.add(new THREE.AmbientLight(0xffffff, 1))


// ======================
// Avatar loading
// ======================

let currentAvatarRoot = null
let headMesh = null
let eyelashMesh = null
let teethLowerMesh = null

const loader = new GLTFLoader()

loader.load(
    '/models/avatar_3.glb',
    (gltf) => {
        currentAvatarRoot = gltf.scene
        scene.add(gltf.scene)
        gltf.scene.position.set(0, 0, 0)

        gltf.scene.traverse((obj) => {
            if (!obj.isMesh) return
            if (obj.name === 'AvatarHead') headMesh = obj
            if (obj.name === 'AvatarEyelashes') eyelashMesh = obj
            if (obj.name === 'AvatarTeethLower') teethLowerMesh = obj
        })

        setIdlePose(gltf.scene)
        hideLoadingOverlay()
        startIdleBlinking()

        setTimeout(() => {
            triggerBowGesture()
            speak("Hallo, wie kann ich dir heute helfen? Ich bin der virtuelle Assistent der EAH Jena.")
        }, 800)
    },
    undefined,
    (error) => {
        console.error("Avatar loading error:", error)
    }
)


// ======================
// Idle pose & sway
// ======================
//
// Rotation values were tuned live against this specific rig — they are
// not generic and will not transfer to a different avatar model.

let idleBones = {}
let idleBase = {}

function setIdlePose(root) {
    const bones = {
        leftUpperArm: root.getObjectByName('LeftArm'),
        rightUpperArm: root.getObjectByName('RightArm'),
        leftLowerArm: root.getObjectByName('LeftForeArm'),
        rightLowerArm: root.getObjectByName('RightForeArm'),
        leftHand: root.getObjectByName('LeftHand'),
        rightHand: root.getObjectByName('RightHand'),
        leftIndexProximal: root.getObjectByName('LeftHandIndex1'),
        rightIndexProximal: root.getObjectByName('RightHandIndex1'),
        leftMiddleProximal: root.getObjectByName('LeftHandMiddle1'),
        rightMiddleProximal: root.getObjectByName('RightHandMiddle1'),
        spine: root.getObjectByName('Spine')
    }

    if (bones.leftUpperArm) bones.leftUpperArm.rotation.set(1.25, 1.10, -0.20)
    if (bones.rightUpperArm) bones.rightUpperArm.rotation.set(1.40, -0.85, 0.15)
    if (bones.leftLowerArm) bones.leftLowerArm.rotation.set(0.00, -0.40, 1.60)
    if (bones.rightLowerArm) bones.rightLowerArm.rotation.set(-0.05, 0.30, -1.50)
    if (bones.leftHand) bones.leftHand.rotation.set(0, 0, 0.1)
    if (bones.rightHand) bones.rightHand.rotation.set(0, 0, -0.1)

    idleBones = bones

    idleBase = {}
    for (const key in bones) {
        if (bones[key]) idleBase[key] = bones[key].rotation.clone()
    }
}

function applyIdleSway(elapsed) {
    const b = idleBones
    const base = idleBase
    const armSway = Math.sin(elapsed * 0.5) * 0.012

    if (b.leftUpperArm && base.leftUpperArm) b.leftUpperArm.rotation.z = base.leftUpperArm.z + armSway
    if (b.rightUpperArm && base.rightUpperArm) b.rightUpperArm.rotation.z = base.rightUpperArm.z + armSway
    if (b.leftLowerArm && base.leftLowerArm) b.leftLowerArm.rotation.y = base.leftLowerArm.y + armSway
    if (b.rightLowerArm && base.rightLowerArm) b.rightLowerArm.rotation.y = base.rightLowerArm.y + armSway

    if (b.leftIndexProximal) b.leftIndexProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.7) * 0.03
    if (b.rightIndexProximal) b.rightIndexProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.72 + 2.4) * 0.03
    if (b.leftMiddleProximal) b.leftMiddleProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.65 + 1) * 0.03
    if (b.rightMiddleProximal) b.rightMiddleProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.68 + 3) * 0.03
}


// ======================
// Bow gesture
// ======================

let activeGesture = null

function triggerBowGesture() {
    if (!idleBones.spine) return
    activeGesture = { type: 'bow', startTime: clock.getElapsedTime(), duration: 2.2 }
}

function applyActiveGesture() {
    if (!activeGesture) return
    const t = clock.getElapsedTime() - activeGesture.startTime

    if (t > activeGesture.duration) {
        activeGesture = null
        return
    }

    if (activeGesture.type === 'bow') {
        const riseTime = 0.7
        const fallTime = 0.7
        const fallStart = activeGesture.duration - fallTime

        let lift
        if (t < riseTime) {
            lift = t / riseTime
        } else if (t < fallStart) {
            lift = 1
        } else {
            lift = Math.max(0, (activeGesture.duration - t) / fallTime)
        }
        const eased = lift * lift * (3 - 2 * lift)

        if (idleBones.spine && idleBase.spine) {
            idleBones.spine.rotation.x = idleBase.spine.x + eased * 0.35
        }
    }
}


// ======================
// Facial animation (blendshapes)
// ======================

function setMorph(meshes, name, value) {
    meshes.forEach((mesh) => {
        if (!mesh || !mesh.morphTargetDictionary) return
        const index = mesh.morphTargetDictionary[name]
        if (index !== undefined) {
            mesh.morphTargetInfluences[index] = value
        }
    })
}

function startIdleBlinking() {
    if (!headMesh && !eyelashMesh) return
    const faces = [headMesh, eyelashMesh]

    function blinkLoop() {
        const nextBlinkIn = 2000 + Math.random() * 4000
        setTimeout(() => {
            setMorph(faces, "eyeBlinkLeft", 1)
            setMorph(faces, "eyeBlinkRight", 1)
            setTimeout(() => {
                setMorph(faces, "eyeBlinkLeft", 0)
                setMorph(faces, "eyeBlinkRight", 0)
                blinkLoop()
            }, 150)
        }, nextBlinkIn)
    }
    blinkLoop()
}


// ======================
// Speech & lip-sync
// ======================

let isSpeaking = false
let currentJaw = 0

// When ElevenLabs timing data is driving the mouth, this holds the
// current target jaw-open value each frame. Null means "no real timing
// available right now" — updateLipSync then falls back to the sine wave,
// which is what happens automatically during browser-TTS fallback.
let externalJawTarget = null

function startLipSync() { isSpeaking = true }
function stopLipSync() {
    isSpeaking = false
    externalJawTarget = null
}

function updateLipSync(elapsed) {
    if (!headMesh) return

    let target = 0
    if (isSpeaking) {
        if (externalJawTarget !== null) {
            target = externalJawTarget
        } else {
            const wave = (Math.sin(elapsed * 9) * 0.5 + 0.5) * 0.22
            target = Math.min(0.08 + wave, 0.35)
        }
    }

    currentJaw += (target - currentJaw) * 0.25
    setMorph([headMesh, teethLowerMesh], "jawOpen", currentJaw)
}

let selectedVoice = null

function loadVoices() {
    const voices = window.speechSynthesis.getVoices()
    selectedVoice = voices.find(v =>
        v.lang.startsWith('de') && (
            v.name.includes('Katja') ||
            v.name.includes('Petra') ||
            v.name.includes('Anna') ||
            v.name.includes('Helena') ||
            v.name.includes('Amala') ||
            v.name.toLowerCase().includes('female')
        )
    ) || voices.find(v => v.lang.startsWith('de'))
}

if ('speechSynthesis' in window) {
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
}

// Vowel-heavy characters open the jaw more than consonants/spaces —
// a cheap but effective stand-in for real viseme classification.
const OPEN_CHARS = new Set(["a", "e", "i", "o", "u", "ä", "ö", "ü", "A", "E", "I", "O", "U"])

function driveLipSyncFromAlignment(audio, alignment) {
    const { characters, character_start_times_seconds } = alignment
    let frameId

    function frame() {
        const t = audio.currentTime
        let idx = -1
        for (let i = 0; i < character_start_times_seconds.length; i++) {
            const start = character_start_times_seconds[i]
            const next = character_start_times_seconds[i + 1] ?? Infinity
            if (t >= start && t < next) { idx = i; break }
        }

        const ch = characters[idx] || ""
        externalJawTarget = OPEN_CHARS.has(ch) ? 0.32 : 0.08

        if (!audio.paused && !audio.ended) {
            frameId = requestAnimationFrame(frame)
        }
    }

    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
}

function speakWithElevenLabs(text) {
    return fetch(TTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    })
        .then(res => {
            if (!res.ok) throw new Error("TTS backend returned " + res.status)
            return res.json()
        })
        .then(({ audio_base64, alignment }) => {
            const audio = new Audio(`data:audio/mpeg;base64,${audio_base64}`)

            return new Promise((resolve, reject) => {
                let stopDriving = null

                audio.addEventListener("play", () => {
                    startLipSync()
                    stopDriving = driveLipSyncFromAlignment(audio, alignment)
                })
                audio.addEventListener("ended", () => {
                    if (stopDriving) stopDriving()
                    stopLipSync()
                    setSubtitle("")
                    resolve()
                })
                audio.addEventListener("error", (e) => {
                    if (stopDriving) stopDriving()
                    stopLipSync()
                    reject(e)
                })

                audio.play().catch(reject)
            })
        })
}

function speakWithBrowserTTS(text) {
    const speech = new SpeechSynthesisUtterance(text)
    speech.lang = "de-DE"
    if (selectedVoice) speech.voice = selectedVoice

    speech.onstart = () => startLipSync()
    speech.onend = () => {
        stopLipSync()
        setSubtitle("")
    }
    speech.onerror = () => {
        stopLipSync()
        setSubtitle("")
    }

    window.speechSynthesis.speak(speech)
}

async function speak(text) {
    setSubtitle(text)

    try {
        await speakWithElevenLabs(text)
    } catch (err) {
        console.warn("ElevenLabs TTS unavailable, falling back to browser speech synthesis:", err)
        speakWithBrowserTTS(text)
    }
}


// ======================
// Chat UI
// ======================

function setSubtitle(text) {
    const el = document.getElementById("avatar-subtitle")
    if (!el) return
    if (text) {
        el.textContent = text
        el.classList.add("visible")
    } else {
        el.classList.remove("visible")
    }
}

function buildChatUI() {
    const container = document.createElement("div")
    container.id = "chat-ui"

    const subtitle = document.createElement("div")
    subtitle.id = "avatar-subtitle"

    const row = document.createElement("div")
    row.className = "chat-row"

    const input = document.createElement("input")
    input.id = "chat-input"
    input.type = "text"
    input.placeholder = "Frag mich etwas über die EAH Jena..."

    const micBtn = document.createElement("button")
    micBtn.id = "mic-btn"
    micBtn.className = "chat-btn"
    micBtn.textContent = "🎤"
    micBtn.title = "Per Sprache fragen"

    const sendBtn = document.createElement("button")
    sendBtn.id = "send-btn"
    sendBtn.className = "chat-btn"
    sendBtn.textContent = "Senden"

    row.appendChild(input)
    row.appendChild(micBtn)
    row.appendChild(sendBtn)
    container.appendChild(subtitle)
    container.appendChild(row)
    document.body.appendChild(container)

    async function handleQuestion(text) {
        if (!text || !text.trim()) return
        input.value = ""
        setSubtitle("Einen Moment...")
        const answer = await getAnswer(text)
        speak(answer)
    }

    sendBtn.addEventListener("click", () => handleQuestion(input.value))
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleQuestion(input.value)
    })

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.lang = "de-DE"
        recognition.interimResults = false

        micBtn.addEventListener("click", () => {
            micBtn.classList.add("listening")
            micBtn.textContent = "●"
            recognition.start()
        })

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript
            input.value = transcript
            handleQuestion(transcript)
        }

        recognition.onend = () => {
            micBtn.classList.remove("listening")
            micBtn.textContent = "🎤"
        }
        recognition.onerror = () => {
            micBtn.classList.remove("listening")
            micBtn.textContent = "🎤"
        }
    } else {
        micBtn.disabled = true
        micBtn.title = "Spracheingabe wird in diesem Browser nicht unterstützt"
    }
}

buildChatUI()


// ======================
// Animation loop
// ======================

const clock = new THREE.Clock()

function animate() {
    requestAnimationFrame(animate)
    const elapsed = clock.getElapsedTime()

    if (currentAvatarRoot) {
        applyIdleSway(elapsed)
        applyActiveGesture()
        updateLipSync(elapsed)
        currentAvatarRoot.position.y = Math.sin(Date.now() * 0.0015) * 0.005
    }

    renderer.render(scene, camera)
}

animate()


// ======================
// Resize
// ======================

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})