import './style.css'

import * as THREE from 'three'

import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Your project already has this at src/assets/EAH_Logo.png
import eahLogoUrl from './assets/EAH_Logo.png'


// ======================
// EAH Jena Knowledge Base
// (Edit / expand this freely — this is what the avatar "knows")
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
// Backend-powered answers (Claude API via your own server)
// ======================
//
// NEVER call api.anthropic.com directly from this file — your API key would
// be visible to anyone who opens dev tools. Instead this hits a small local
// backend (see server.js) that holds the key and proxies the request.
//
// If the backend is unreachable (not running, no internet, etc.) this falls
// back to the local keyword FAQ so the demo still works offline.

const CHAT_ENDPOINT = "http://localhost:3001/api/chat"

// Keep a short running history so the assistant has conversational context
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

        // Keep history short so requests don't balloon
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
//
// A flat color reads flat. This paints a soft vertical gradient onto a
// canvas and uses it as the scene background — same brand teal as the
// EAH Jena logo, sampled directly at #009898, so the 3D scene and the
// chat interface feel like one design instead of two things bolted
// together.
//
// Swap this out for a real environment map (HDRI) or a campus photo later
// if you want a literal setting — see the comment at the bottom of this
// function for how.

function createGradientBackground() {
    const canvas = document.createElement("canvas")
    canvas.width = 2
    canvas.height = 512

    const ctx = canvas.getContext("2d")
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)

    // Top: brand teal haze -> bottom: light paper tone (matches --paper-100)
    gradient.addColorStop(0, "#007373")
    gradient.addColorStop(0.45, "#a9d6d6")
    gradient.addColorStop(1, "#f5f7f7")

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    return texture

    // To use a real photo of the EAH Jena campus instead, drop an image in
    // /public and replace this whole function's body with:
    //   return new THREE.TextureLoader().load('/campus-background.jpg')
}


// ======================
// Scene
// ======================

const scene = new THREE.Scene()

scene.background = createGradientBackground()

// Soft shadow-catcher plane so the avatar feels grounded rather than floating
const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 64),
    new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        roughness: 1
    })
)
ground.rotation.x = -Math.PI / 2
ground.position.y = 0
scene.add(ground)


// ======================
// Loading overlay + university badge (DOM chrome)
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
// Camera
// ======================

const camera = new THREE.PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
)

camera.position.set(0, 1.4, 3)


// ======================
// Renderer
// ======================

const renderer = new THREE.WebGLRenderer({ antialias: true })

renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.outputColorSpace = THREE.SRGBColorSpace

document.body.appendChild(renderer.domElement)


// ======================
// Controls
// ======================

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
// Avatar loading (plain glTF — no VRM plugin)
// ======================
//
// This model (avatar_3.glb) is NOT a VRM file, so there's no humanoid/
// expressionManager API to lean on. Instead:
//  - Bones are looked up directly by name from the skeleton (Mixamo/
//    Ready-Player-Me-style naming: LeftArm, RightForeArm, etc.)
//  - Facial animation runs through real ARKit-style morph targets
//    (eyeBlinkLeft, jawOpen, mouthSmileLeft, ...) found on the
//    AvatarHead / AvatarEyelashes / AvatarTeethLower meshes.
//
// Put the file at: public/models/avatar_3.glb  (Vite serves /public at
// the site root, so the load path below is correct as long as it's there)

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

        // This rig may face the opposite way from what you expect by
        // default — if the avatar loads facing AWAY from the camera,
        // this flip fixes it. If it loads facing the WRONG way after
        // this, just delete the next line.
        // This rig conventionally faces +Z in its bind pose, which already
        // points toward the camera in this scene's default setup — so no
        // rotation flip needed here. If she still faces away, uncomment:
        // gltf.scene.rotation.y = Math.PI
        gltf.scene.position.set(0, 0, 0)

        // Find the meshes that carry facial morph targets
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

        // Greet once loaded and voices are ready
        whenVoicesReady(() => {
            setTimeout(() => {
                triggerBowGesture()
                speak("Hello, how can I assist you today? I'm the virtual assistant for EAH Jena.")
            }, 800)
        })
    },
    undefined,
    (error) => {
        console.error("Avatar loading error:", error)
    }
)


// ======================
// Idle pose — hands clasped in front ("Japanese welcome" stance)
// ======================
//
// This replaces the old arms-at-sides resting pose. Instead, the avatar
// now rests with hands together in front of the body — the pose she
// stays in permanently, both before and after the bow gesture.
//
// IMPORTANT — the values below are an educated first guess, not tuned
// values like the old arms-at-sides pose was. They're built from what
// your tuning already taught us about this rig (upper arm rotation.x
// lowers the arm to the side, rotation.z swings it forward/inward —
// that's what caused the "zombie" arms earlier, and it's exactly what
// we need now to bring the hands to the front). But a full two-handed
// clasped pose is more complex than a single arm, so expect to need the
// tuner (press P, keys 1-6) to get hands actually meeting/overlapping
// rather than just close.

// Filled in by setIdlePose, read every frame by applyIdleSway / applyGesture
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
        // Proximal finger bones — this rig has full finger chains
        leftIndexProximal: root.getObjectByName('LeftHandIndex1'),
        rightIndexProximal: root.getObjectByName('RightHandIndex1'),
        leftMiddleProximal: root.getObjectByName('LeftHandMiddle1'),
        rightMiddleProximal: root.getObjectByName('RightHandMiddle1'),
        // Spine — used for the bow gesture, not part of the arm pose
        spine: root.getObjectByName('Spine')
    }

    // Upper arms and forearms: all four values below were found live via
    // the pose tuner (press P) — actual working values for THIS rig's
    // hands-together pose, not a guess.
    if (bones.leftUpperArm) bones.leftUpperArm.rotation.set(1.25, 1.10, -0.20)
    if (bones.rightUpperArm) bones.rightUpperArm.rotation.set(1.40, -0.85, 0.15)

    if (bones.leftLowerArm) bones.leftLowerArm.rotation.set(0.00, -0.40, 1.60)
    if (bones.rightLowerArm) bones.rightLowerArm.rotation.set(-0.05, 0.30, -1.50)

    // Hands: left starts flat, right resting on top — still needs tuning
    // (key 5 = rightHand, key 6 = leftHand)
    if (bones.leftHand) bones.leftHand.rotation.set(0, 0, 0.1)
    if (bones.rightHand) bones.rightHand.rotation.set(0, 0, -0.1)

    idleBones = bones
    window.idleBones = bones // handy for manual console testing, e.g. idleBones.rightHand.rotation.z = 1

    // Snapshot this resting pose — sway and gestures animate AROUND these
    // values rather than replacing them, so the avatar always settles
    // back to the same relaxed stance.
    idleBase = {}
    for (const key in bones) {
        if (bones[key]) idleBase[key] = bones[key].rotation.clone()
    }
}


// ======================
// Idle sway ("körperlich" — a little physical presence)
// ======================
//
// Small, slow sine offsets so the avatar doesn't look frozen between
// blinks. With hands clasped together, left/right now move IN PHASE
// (same sign, same timing) rather than opposite — swaying them
// out-of-phase like before would make the hands visibly drift apart
// during idle, which looks broken for a clasped-hands pose. Amplitude
// is also lower than the old arms-at-sides version for the same reason.

function applyIdleSway(elapsed) {
    const b = idleBones
    const base = idleBase

    const armSway = Math.sin(elapsed * 0.5) * 0.012

    if (b.leftUpperArm && base.leftUpperArm) {
        b.leftUpperArm.rotation.z = base.leftUpperArm.z + armSway
    }
    if (b.rightUpperArm && base.rightUpperArm) {
        b.rightUpperArm.rotation.z = base.rightUpperArm.z + armSway
    }
    if (b.leftLowerArm && base.leftLowerArm) {
        b.leftLowerArm.rotation.y = base.leftLowerArm.y + armSway
    }
    if (b.rightLowerArm && base.rightLowerArm) {
        b.rightLowerArm.rotation.y = base.rightLowerArm.y + armSway
    }

    // Fingers — a very subtle curl drift (fine to leave out-of-phase,
    // doesn't affect whether the hands stay together)
    if (b.leftIndexProximal) b.leftIndexProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.7) * 0.03
    if (b.rightIndexProximal) b.rightIndexProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.72 + 2.4) * 0.03
    if (b.leftMiddleProximal) b.leftMiddleProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.65 + 1) * 0.03
    if (b.rightMiddleProximal) b.rightMiddleProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.68 + 3) * 0.03
}


// ======================
// One-off gestures (Japanese-style welcome bow)
// ======================
//
// Runs on top of idle sway for a fixed duration, then hands control back.
// Only the spine bends forward and back — the arms/hands stay exactly
// where they are in the clasped resting pose the whole time, which is
// what makes it read as a bow rather than a wave.
//
// rotation.x is the standard convention for forward/backward spine bend
// on almost every humanoid rig — best first guess, but if she leans
// sideways or twists instead of bending forward, use the tuner (press P,
// key 7) to find the right axis on THIS bone.

let activeGesture = null // { type, startTime, duration }

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

        // Rise, hold, then FALL back to 0 over the final stretch — lift
        // returns to exactly 0 by the time the gesture ends, so the
        // handoff back to idle sway is seamless instead of a jump-cut.
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
        // Ease (smoothstep) instead of linear, so the bow feels less
        // mechanical — a real bow doesn't move at constant speed
        const eased = lift * lift * (3 - 2 * lift)

        if (b.spine && base.spine) {
            // A polite ~20° bow (0.35 rad) — modest, not a deep formal
            // bow. Increase toward ~0.5-0.6 for a deeper one.
            b.spine.rotation.x = base.spine.x + eased * 0.35
        }
    }
}


// ======================
// Facial animation helper
// ======================
//
// Sets a named morph target's influence across every mesh that has it.
// Different meshes carry different subsets (e.g. only AvatarHead and
// AvatarTeethLower have jawOpen — AvatarTeethUpper doesn't move).

function setMorph(meshes, name, value) {
    meshes.forEach((mesh) => {
        if (!mesh || !mesh.morphTargetDictionary) return
        const index = mesh.morphTargetDictionary[name]
        if (index !== undefined) {
            mesh.morphTargetInfluences[index] = value
        }
    })
}


// ======================
// Live pose tuner (press P in the browser)
// ======================
//
// Since I can't see your render from here, this lets YOU find the right
// rotation values interactively instead of me guessing axes blindly.
//
//   P              toggle the tuner panel on/off (also freezes idle sway
//                  AND freezes any in-progress bow gesture, so your
//                  edits aren't overwritten every frame)
//   1-7            select: left upper arm / right upper arm / left
//                  forearm / right forearm / right hand / left hand /
//                  spine (for the bow)
//   Arrow Left/Right   adjust Z rotation
//   Arrow Up/Down      adjust X rotation
//   Shift + Up/Down    adjust Y rotation
//   R              reset selected bone to its original bind rotation
//
// For the hands-together pose specifically: the current values in
// setIdlePose are an educated guess, not tuned. Use 1/2/3/4/5/6 to bring
// the hands actually together (they'll likely be close but not
// overlapping at first). For the bow, reload the page, and right as she
// starts bowing press P — this freezes mid-bow so you can select 7 and
// find the correct forward-bend axis/sign for the spine.
//
// Once everything looks right, send me all the rotation.set(...) lines
// together and I'll bake them into setIdlePose (for 1-6) and the bow
// gesture (for 7) in one pass.

let tunerActive = false
let tunerSelection = 'leftUpperArm'
const tunerBindRotation = {} // original T-pose rotation, for the R reset key

const TUNER_BONES = {
    '1': 'leftUpperArm',
    '2': 'rightUpperArm',
    '3': 'leftLowerArm',
    '4': 'rightLowerArm',
    '5': 'rightHand',
    '6': 'leftHand',
    '7': 'spine'
}

function buildTunerPanel() {
    const panel = document.createElement('div')
    panel.id = 'pose-tuner'
    panel.style.cssText = `
        position: fixed; bottom: 100px; right: 24px; z-index: 20;
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        background: rgba(16,32,31,0.88); color: #7fd0d0;
        padding: 12px 14px; border-radius: 10px; line-height: 1.6;
        white-space: pre; display: none; max-width: 340px;
    `
    document.body.appendChild(panel)
    return panel
}

const tunerPanel = buildTunerPanel()

function updateTunerPanel() {
    const bone = idleBones[tunerSelection]
    if (!bone) {
        tunerPanel.textContent = `No bone found for "${tunerSelection}"`
        return
    }
    const r = bone.rotation
    tunerPanel.textContent =
`POSE TUNER — press P to close
selected: ${tunerSelection}  (1-4 to switch)
x: ${r.x.toFixed(2)}  y: ${r.y.toFixed(2)}  z: ${r.z.toFixed(2)}

← → z-axis   ↑ ↓ x-axis   shift+↑↓ y-axis   R reset

paste into setIdlePose():
bones.${tunerSelection}.rotation.set(${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)})`
}

window.addEventListener('keydown', (e) => {
    // Don't hijack typing in the chat input
    if (document.activeElement && document.activeElement.id === 'chat-input') return

    if (e.key === 'p' || e.key === 'P') {
        tunerActive = !tunerActive
        tunerPanel.style.display = tunerActive ? 'block' : 'none'
        if (tunerActive) updateTunerPanel()
        return
    }

    if (!tunerActive) return

    if (TUNER_BONES[e.key]) {
        tunerSelection = TUNER_BONES[e.key]
        updateTunerPanel()
        return
    }

    const bone = idleBones[tunerSelection]
    if (!bone) return

    const step = 0.05

    if (!(tunerSelection in tunerBindRotation)) {
        tunerBindRotation[tunerSelection] = bone.rotation.clone()
    }

    if (e.key === 'ArrowLeft') bone.rotation.z -= step
    else if (e.key === 'ArrowRight') bone.rotation.z += step
    else if (e.key === 'ArrowUp' && !e.shiftKey) bone.rotation.x -= step
    else if (e.key === 'ArrowDown' && !e.shiftKey) bone.rotation.x += step
    else if (e.key === 'ArrowUp' && e.shiftKey) bone.rotation.y -= step
    else if (e.key === 'ArrowDown' && e.shiftKey) bone.rotation.y += step
    else if (e.key === 'r' || e.key === 'R') {
        bone.rotation.copy(tunerBindRotation[tunerSelection])
    } else {
        return
    }

    e.preventDefault()
    updateTunerPanel()
})


// ======================
// Idle blinking (natural, randomized)
// ======================

function startIdleBlinking() {
    if (!headMesh && !eyelashMesh) return

    const faces = [headMesh, eyelashMesh]

    function blinkLoop() {
        const nextBlinkIn = 2000 + Math.random() * 4000 // every 2-6s

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
// Speech + basic lip-sync
// ======================

let voicesCache = []
let voicesReadyCallbacks = []
let voicesReady = false

function whenVoicesReady(cb) {
    if (voicesReady) {
        cb()
    } else {
        voicesReadyCallbacks.push(cb)
    }
}

function loadVoices() {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
        voicesCache = voices
        voicesReady = true
        voicesReadyCallbacks.forEach(cb => cb())
        voicesReadyCallbacks = []
    }
}

// Some browsers have voices immediately, others fire the event later
loadVoices()
window.speechSynthesis.onvoiceschanged = loadVoices

function pickVoice() {
    return voicesCache.find(v =>
        v.name.toLowerCase().includes("zira") ||
        v.name.toLowerCase().includes("jenny") ||
        v.name.toLowerCase().includes("aria") ||
        v.name.toLowerCase().includes("female")
    )
}

// Driven per-frame from animate() via updateLipSync(), not a setInterval —
// that's what makes it smooth instead of a hard on/off flicker.
let isSpeaking = false
let currentJaw = 0

function startLipSync() {
    isSpeaking = true
}

function stopLipSync() {
    isSpeaking = false
}

function updateLipSync(elapsed) {
    if (!headMesh) return

    let target = 0

    if (isSpeaking) {
        // Two layered sine waves at different speeds so it doesn't look
        // like a metronome — and capped low on purpose. This was too
        // extreme before (toggling up to 0.8 instantly); real speech
        // barely opens the jaw past ~0.3-0.35 most of the time.
        const wave =
            (Math.sin(elapsed * 9) * 0.5 + 0.5) * 0.22 +
            (Math.sin(elapsed * 17 + 1) * 0.5 + 0.5) * 0.08
        target = Math.min(0.08 + wave, 0.35)
    }

    // Smooth toward the target instead of snapping — removes the "wild"
    // flicker and makes it read as a mouth moving, not a switch flipping.
    currentJaw += (target - currentJaw) * 0.25

    // jawOpen exists on both AvatarHead and AvatarTeethLower — move both
    // together so the teeth don't lag behind the jaw visually
    setMorph([headMesh, teethLowerMesh], "jawOpen", currentJaw)
}

function speak(text) {
    setSubtitle(text)

    const speech = new SpeechSynthesisUtterance(text)

    const voice = pickVoice()
    if (voice) {
        speech.voice = voice
        console.log("Using voice:", voice.name)
    }

    speech.lang = "en-US"
    speech.pitch = 1.5
    speech.rate = 1.05

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
// Chat UI (text input + mic)
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

    // Optional: voice input via Web Speech API (Chrome/Edge support it)
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
// Animation
// ======================

const clock = new THREE.Clock()

function animate() {
    requestAnimationFrame(animate)

    clock.getDelta()
    const elapsed = clock.getElapsedTime()

    if (currentAvatarRoot) {
        if (!tunerActive) {
            applyIdleSway(elapsed)
            applyActiveGesture()
        }

        updateLipSync(elapsed)

        // very small breathing
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