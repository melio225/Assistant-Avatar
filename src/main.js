import './style.css'

import * as THREE from 'three'

import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Your project already has this at src/assets/EAH_Logo.png
import eahLogoUrl from './assets/EAH_Logo.png'

import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

// ======================
// EAH Jena Knowledge Base
// ======================

const KNOWLEDGE_BASE = [
    {
        keywords: ["what is eah", "about eah", "who are you", "what university", "welcome"],
        answer: "I'm the virtual assistant for Ernst-Abbe-Hochschule Jena, EAH Jena for short. We're a university of applied sciences in Jena, Germany, founded in 1991, with around four thousand two hundred students."
    },
    {
        keywords: ["program", "study", "course", "degree", "faculty", "faculties"],
        answer: "EAH Jena offers about fifty bachelor's and master's programs across four fields: technology, business, social affairs, and health. That includes subjects like electrical engineering, mechanical engineering, medical engineering and biotechnology, business administration, and health and nursing."
    },
    {
        keywords: ["location", "where", "address", "campus"],
        answer: "Our campus is on the Carl-Zeiss-Promenade in Jena, in the state of Thuringia, Germany."
    },
    {
        keywords: ["admission", "apply", "application", "deadline", "enroll"],
        answer: "Most of our programs are admission-free, and many are also tuition-free. Application deadlines are typically July 15th for the winter semester and February 15th for the summer semester, though it's best to check the specific program page for exact dates."
    },
    {
        keywords: ["history", "founded", "when was", "ernst abbe"],
        answer: "The university was founded in 1991 and took the name Ernst-Abbe-Hochschule in 2014, named after Ernst Abbe, a researcher, entrepreneur, and social reformer connected to the Zeiss and Jena scientific tradition."
    },
    {
        keywords: ["hello", "hi", "hey"],
        answer: "Hello! Welcome to EAH Jena. What would you like to know?"
    },
    {
        keywords: ["thank", "thanks"],
        answer: "You're very welcome! Let me know if there's anything else you'd like to know about EAH Jena."
    }
]

const FALLBACK_ANSWER =
    "That's a great question — I don't have that detail yet, but I'd recommend checking eah-jena.de or asking at the student services desk for the most accurate answer."

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
// Backend Endpoints
// ======================

const CHAT_ENDPOINT = "http://localhost:3001/api/chat"
const TTS_ENDPOINT = "http://localhost:3001/api/tts"

let conversationHistory = []

async function getAnswer(question) {
    try {
        const response = await fetch(CHAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question,
                history: conversationHistory
            })
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
// Scene background
// ======================

function createGradientBackground() {
    const canvas = document.createElement("canvas")
    canvas.width = 2
    canvas.height = 512

    const ctx = canvas.getContext("2d")
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)

    // Richer EAH Jena teal gradient (less stark white)
    gradient.addColorStop(0, "#004d4d")     // Deep teal at top
    gradient.addColorStop(0.5, "#007373")   // Mid teal
    gradient.addColorStop(1, "#a9d6d6")     // Soft muted teal at bottom (instead of pure white)

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
        color: 0x003333, // Darker teal ground tint
        transparent: true,
        opacity: 0.25,
        roughness: 0.8
    })
)
ground.rotation.x = -Math.PI / 2
ground.position.y = 0
scene.add(ground)


// ======================
// DOM UI Elements
// ======================

function buildLoadingOverlay() {
    const overlay = document.createElement("div")
    overlay.id = "loading-overlay"

    const spinner = document.createElement("div")
    spinner.className = "loading-spinner"

    const text = document.createElement("div")
    text.className = "loading-text"
    text.textContent = "Loading assistant..."

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
    sub.textContent = "Virtual Campus Assistant"

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
// Camera & Renderer
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


// ======================
// Lights
// ======================

const directionalLight = new THREE.DirectionalLight(0xffffff, 3)
directionalLight.position.set(1, 2, 3)
scene.add(directionalLight)
scene.add(new THREE.AmbientLight(0xffffff, 1))


// ======================
// Avatar Loading
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
        console.log("Avatar loaded!", gltf)

        hideLoadingOverlay()
        startIdleBlinking()

        setTimeout(() => {
            triggerBowGesture()
            speak("Hello, how can I assist you today? I'm the virtual assistant for EAH Jena.")
        }, 800)
    },
    undefined,
    (error) => {
        console.error("Avatar loading error:", error)
    }
)


// ======================
// Idle Pose & Sway
// ======================

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
    window.idleBones = bones

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
        const b = idleBones
        const base = idleBase
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

        if (b.spine && base.spine) {
            b.spine.rotation.x = base.spine.x + eased * 0.35
        }
    }
}


// ======================
// Morph Targets & Blinking
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
// Neural Voice & Audio Lip-Sync
// ======================

let audioAnalyser = null
let audioDataArray = null
let audioCtx = null
let isSpeaking = false
let currentJaw = 0

function startLipSync() { isSpeaking = true }
function stopLipSync() { isSpeaking = false }

function updateLipSync(elapsed) {
    if (!headMesh) return

    let target = 0

    if (isSpeaking && audioAnalyser && audioDataArray) {
        audioAnalyser.getByteFrequencyData(audioDataArray)
        let sum = 0
        for (let i = 0; i < audioDataArray.length; i++) {
            sum += audioDataArray[i]
        }
        let average = sum / audioDataArray.length
        target = Math.min((average / 128) * 0.35, 0.35)
    } else if (isSpeaking) {
        const wave = (Math.sin(elapsed * 9) * 0.5 + 0.5) * 0.22
        target = Math.min(0.08 + wave, 0.35)
    }

    currentJaw += (target - currentJaw) * 0.25
    setMorph([headMesh, teethLowerMesh], "jawOpen", currentJaw)
}



let selectedFemaleVoice = null

// Load browser voices asynchronously when available
function loadVoices() {
    const voices = window.speechSynthesis.getVoices()
    selectedFemaleVoice = voices.find(v => 
        v.lang.startsWith('en') && (
            v.name.includes('Zira') || 
            v.name.includes('Aria') || 
            v.name.includes('Jenny') || 
            v.name.includes('Samantha') || 
            v.name.includes('Karen') || 
            v.name.includes('Victoria') ||
            v.name.toLowerCase().includes('female')
        )
    ) || voices.find(v => v.lang.startsWith('en'))
}

if ('speechSynthesis' in window) {
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
}

// Use browser TTS as a fallback if neural TTS fails or is unavailable
async function speak(text) {
    setSubtitle(text)
    
    const speech = new SpeechSynthesisUtterance(text)
    speech.lang = "en-US"

    if (selectedFemaleVoice) {
        speech.voice = selectedFemaleVoice
    }

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

// ======================
// Neural TTS (ElevenLabs) - currently disabled in favor of browser TTS
// ======================
// async function speak(text) {
//     setSubtitle(text)

//     try {
//         const response = await fetch(TTS_ENDPOINT, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ text })
//         })

//         if (!response.ok) throw new Error("Backend TTS unavailable")

//         const blob = await response.blob()
//         const audioUrl = URL.createObjectURL(blob)
//         const audio = new Audio(audioUrl)

//         if (!audioCtx) {
//             audioCtx = new (window.AudioContext || window.webkitAudioContext)()
//         }
//         if (audioCtx.state === 'suspended') {
//             await audioCtx.resume()
//         }

//         const source = audioCtx.createMediaElementSource(audio)
//         const analyser = audioCtx.createAnalyser()
//         analyser.fftSize = 256
//         source.connect(analyser)
//         analyser.connect(audioCtx.destination)

//         audioAnalyser = analyser
//         audioDataArray = new Uint8Array(analyser.frequencyBinCount)

//         audio.onplay = () => startLipSync()
//         audio.onended = () => {
//             stopLipSync()
//             setSubtitle("")
//             audioAnalyser = null
//         }
//         audio.onerror = () => {
//             stopLipSync()
//             setSubtitle("")
//             audioAnalyser = null
//         }

//         await audio.play()

//     } catch (err) {
//         console.warn("Neural TTS failed, falling back to browser speech:", err)
//         const speech = new SpeechSynthesisUtterance(text)
//         speech.onstart = () => startLipSync()
//         speech.onend = () => { stopLipSync(); setSubtitle("") }
//         window.speechSynthesis.speak(speech)
//     }
// }


// ======================
// Chat UI & Input
// ======================

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
    input.placeholder = "Ask me about EAH Jena..."

    const micBtn = document.createElement("button")
    micBtn.id = "mic-btn"
    micBtn.className = "chat-btn"
    micBtn.textContent = "🎤"
    micBtn.title = "Ask by voice"

    const sendBtn = document.createElement("button")
    sendBtn.id = "send-btn"
    sendBtn.className = "chat-btn"
    sendBtn.textContent = "Send"

    row.appendChild(input)
    row.appendChild(micBtn)
    row.appendChild(sendBtn)

    container.appendChild(subtitle)
    container.appendChild(row)
    document.body.appendChild(container)

    async function handleQuestion(text) {
        if (!text || !text.trim()) return
        input.value = ""
        setSubtitle("Thinking...")
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
        recognition.lang = "en-US"
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
        micBtn.title = "Voice input not supported in this browser"
    }
}

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

buildChatUI()


// ======================
// Main Animation Loop
// ======================

const clock = new THREE.Clock()

function animate() {
    requestAnimationFrame(animate)

    clock.getDelta()
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
// Resize Handling
// ======================

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})