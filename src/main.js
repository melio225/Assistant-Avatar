import './style.css'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

import eahLogoUrl from './assets/EAH_Logo.png'

// ======================
// Character registry
// ======================
//
// Add more characters here as you get more models. "type" decides which
// loading/animation code path is used — see loadAvatar() below.
//
// glb  → your existing rig: named bones, morphTargetDictionary blendshapes
// vrm  → VRM avatars (e.g. from VRoid Studio): humanoid bone API,
//        expressionManager for face — richer expressions out of the box

const AVATAR_CHARACTERS = [
    {
        id: 'avatar_1',
        name: 'Elena',
        type: 'glb',
        path: '/models/Avatar_1.glb',
        thumbnail: '/thumbnails/Avatar_1.png',
        // Matches the key the backend looks up in ELEVENLABS_VOICE_IDS.
        voice: 'eah'
    },
    {
        id: 'avatar_4',
        name: 'Mika',
        type: 'vrm',
        path: '/models/Avatar_4.vrm',
        thumbnail: '/thumbnails/Avatar_4.png',
        voice: 'anime'
    }
]


// ======================
// Languages
// ======================
//
// The language is chosen on the start screen (required) and then used for
// every UI text, the speech recognition, the browser voice fallback, the
// offline FAQ, and is sent to the backend for chat + text-to-speech.
// To add a language: add an entry here, one option in the start screen,
// and a system prompt in server/server.js.

let currentLanguage = null // 'de' | 'en' — set on the start screen

const I18N = {
    de: {
        speechLang: 'de-DE',
        heading: 'Wähle deinen Assistenten',
        langLabel: 'Sprache',
        loading: 'Assistent wird geladen...',
        badgeSub: 'Virtueller Campus-Assistent',
        greeting: 'Hallo, wie kann ich dir heute helfen? Ich bin der virtuelle Assistent der EAH Jena.',
        placeholder: 'Frag mich etwas über die EAH Jena...',
        send: 'Senden',
        thinking: 'Einen Moment...',
        micTitle: 'Per Sprache fragen',
        micUnsupported: 'Spracheingabe wird in diesem Browser nicht unterstützt',
        fallback: 'Das ist eine gute Frage — dazu habe ich noch keine Angabe, aber ich empfehle, auf eah-jena.de nachzuschauen oder das Studierendensekretariat zu fragen.'
    },
    en: {
        speechLang: 'en-US',
        heading: 'Choose your assistant',
        langLabel: 'Language',
        loading: 'Loading assistant...',
        badgeSub: 'Virtual Campus Assistant',
        greeting: "Hello, how can I help you today? I'm the virtual assistant of EAH Jena.",
        placeholder: 'Ask me something about EAH Jena...',
        send: 'Send',
        thinking: 'One moment...',
        micTitle: 'Ask by voice',
        micUnsupported: 'Voice input is not supported in this browser',
        fallback: "That's a good question, but I don't have information on it yet. Please check eah-jena.de or ask the student office."
    }
}

function t(key) {
    return I18N[currentLanguage || 'de'][key]
}


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

const KNOWLEDGE_BASE_EN = [
    {
        keywords: ["who are you", "what is eah", "about eah", "which university", "welcome"],
        answer: "I'm the virtual assistant of Ernst-Abbe-Hochschule Jena, or EAH Jena for short. We are a university of applied sciences in Jena, founded in 1991, with around 4,200 students."
    },
    {
        keywords: ["study", "program", "programme", "course", "degree", "faculty", "faculties", "subject"],
        answer: "EAH Jena offers around fifty bachelor's and master's programs in four areas: technology, business, social work and health. Examples include electrical engineering, mechanical engineering, medical engineering, biotechnology, business administration, and health and nursing."
    },
    {
        keywords: ["where", "location", "address", "campus"],
        answer: "Our campus is on Carl-Zeiss-Promenade in Jena, in the state of Thuringia."
    },
    {
        keywords: ["admission", "apply", "application", "deadline", "enroll", "enrol"],
        answer: "Most of our programs have no admission restrictions, and many are free of tuition fees. Application deadlines are usually July 15 for the winter semester and February 15 for the summer semester. You'll find exact dates on each program's page."
    },
    {
        keywords: ["history", "founded", "when was", "ernst abbe"],
        answer: "The university was founded in 1991 and has been named Ernst-Abbe-Hochschule since 2014, after Ernst Abbe, a researcher, entrepreneur and social reformer from Jena's Zeiss and science tradition."
    },
    {
        keywords: ["hello", "hi", "good morning", "good afternoon"],
        answer: "Hello! Welcome to EAH Jena. What would you like to know?"
    },
    {
        keywords: ["thank", "thanks"],
        answer: "You're welcome! Let me know if you want to know anything else about EAH Jena."
    }
]

function findAnswer(question) {
    const q = question.toLowerCase()
    const base = currentLanguage === 'en' ? KNOWLEDGE_BASE_EN : KNOWLEDGE_BASE
    for (const entry of base) {
        if (entry.keywords.some(k => q.includes(k))) {
            return entry.answer
        }
    }
    return t('fallback')
}


// ======================
// Backend
// ======================
//
// Set VITE_API_BASE_URL at build time in production. Leave it empty when
// frontend and backend share a domain — requests then go to /api/... on
// the same origin, so no CORS is involved.

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001"
const CHAT_ENDPOINT = `${API_BASE_URL}/api/chat`
const TTS_ENDPOINT = `${API_BASE_URL}/api/tts`

let conversationHistory = []

async function getAnswer(question) {
    try {
        const response = await fetch(CHAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question,
                history: conversationHistory,
                language: currentLanguage
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
    text.textContent = t('loading')

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
    sub.textContent = t('badgeSub')

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

// Start screen: language (required dropdown) + avatar (name buttons with
// picture). Avatars stay locked until a language is chosen; clicking a
// locked avatar highlights the dropdown instead of doing nothing.
function buildCharacterSelectUI(onSelect) {
    const overlay = document.createElement("div")
    overlay.id = "character-select-overlay"
    overlay.classList.add("locked")

    const langLabel = document.createElement("label")
    langLabel.className = "language-label"
    langLabel.htmlFor = "language-select"
    langLabel.textContent = "Language / Sprache"

    const select = document.createElement("select")
    select.id = "language-select"
    select.className = "language-select"
    select.required = true

    const placeholder = document.createElement("option")
    placeholder.value = ""
    placeholder.textContent = "Choose / Wählen …"
    placeholder.disabled = true
    placeholder.selected = true
    select.appendChild(placeholder)

    ;[
        { value: "en", label: "English" },
        { value: "de", label: "Deutsch" }
    ].forEach(({ value, label }) => {
        const option = document.createElement("option")
        option.value = value
        option.textContent = label
        select.appendChild(option)
    })

    const heading = document.createElement("div")
    heading.className = "character-select-heading"
    heading.textContent = "Avatar"

    const grid = document.createElement("div")
    grid.className = "character-select-grid"

    AVATAR_CHARACTERS.forEach((character) => {
        const card = document.createElement("button")
        card.className = "character-card"
        card.type = "button"

        const img = document.createElement("img")
        img.src = character.thumbnail
        img.alt = character.name
        img.onerror = () => { img.style.display = "none" } // fine if no thumbnail exists yet

        const label = document.createElement("div")
        label.className = "character-card-label"
        label.textContent = character.name

        card.appendChild(img)
        card.appendChild(label)
        card.addEventListener("click", () => {
            if (!select.value) {
                select.classList.add("needs-choice")
                select.focus()
                return
            }
            overlay.remove()
            onSelect(character, select.value)
        })

        grid.appendChild(card)
    })

    select.addEventListener("change", () => {
        const texts = I18N[select.value]
        langLabel.textContent = texts.langLabel
        heading.textContent = texts.heading
        select.classList.remove("needs-choice")
        overlay.classList.remove("locked")
    })

    overlay.appendChild(langLabel)
    overlay.appendChild(select)
    overlay.appendChild(heading)
    overlay.appendChild(grid)
    document.body.appendChild(overlay)
}

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
let currentAvatarType = null // 'glb' | 'vrm' — drives every branch below
let currentVRM = null
let currentAvatarVoice = 'eah' // sent to /api/tts so the backend picks the matching ElevenLabs voice

let headMesh = null
let eyelashMesh = null
let teethLowerMesh = null

const loader = new GLTFLoader()
loader.register((parser) => new VRMLoaderPlugin(parser)) // harmless no-op on plain GLBs

function loadAvatar(character) {
    currentAvatarVoice = character.voice || 'eah'
    if (character.type === 'vrm') {
        loadVRMAvatar(character.path)
    } else {
        loadClassicAvatar(character.path)
    }
}

function loadClassicAvatar(path) {
    loader.load(
        path,
        (gltf) => {
            currentAvatarRoot = gltf.scene
            currentAvatarType = 'glb'
            currentVRM = null
            scene.add(gltf.scene)
            gltf.scene.position.set(0, 0, 0)

            gltf.scene.traverse((obj) => {
                if (!obj.isMesh) return
                if (obj.name === 'AvatarHead') headMesh = obj
                if (obj.name === 'AvatarEyelashes') eyelashMesh = obj
                if (obj.name === 'AvatarTeethLower') teethLowerMesh = obj
            })

            setIdlePoseGLB(gltf.scene)
            hideLoadingOverlay()
            startIdleBlinking()

            setTimeout(() => {
                triggerBowGesture()
                speak(t('greeting'))
            }, 800)
        },
        undefined,
        (error) => {
            console.error("Avatar loading error:", error)
        }
    )
}

function loadVRMAvatar(path) {
    loader.load(
        path,
        (gltf) => {
            const vrm = gltf.userData.vrm
            if (!vrm) {
                console.error("File loaded but contains no VRM data:", path)
                return
            }

            // Older VRM0 exports face backward; VRM1 exports already face
            // forward. Only flip if this is actually a VRM0 file.
            if (vrm.meta?.metaVersion === '0') {
                VRMUtils.rotateVRM0(vrm)
            }

            currentVRM = vrm
            currentAvatarRoot = vrm.scene
            currentAvatarType = 'vrm'
            headMesh = null
            eyelashMesh = null
            teethLowerMesh = null

            scene.add(vrm.scene)
            vrm.scene.position.set(0, 0, 0)

            setIdlePoseVRM(vrm)
            hideLoadingOverlay()
            startIdleBlinking()

            setTimeout(() => {
                triggerBowGesture()
                speak(t('greeting'))
            }, 800)
        },
        undefined,
        (error) => {
            console.error("VRM avatar loading error:", error)
        }
    )
}

// Start flow: choose language + avatar → build the language-specific UI →
// load the chosen avatar. The chat UI is built here (not at page load) so
// that every text is created in the chosen language.
buildCharacterSelectUI((character, language) => {
    currentLanguage = language

    const badgeSub = document.querySelector('.badge-sub')
    if (badgeSub) badgeSub.textContent = t('badgeSub')

    buildLoadingOverlay()
    buildChatUI()
    loadAvatar(character)
})


// ======================
// Idle pose & sway
// ======================
//
// Rotation values were tuned live against this specific rig — they are
// not generic and will not transfer to a different avatar model.

let idleBones = {}
let idleBase = {}

function setIdlePoseGLB(root) {
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

// VRM avatars use a standardized humanoid bone API instead of named bones,
// so lookups go through vrm.humanoid rather than getObjectByName. By the
// VRM spec, the humanoid rest pose is a T-pose (arms out horizontally) —
// it is NOT already arms-down like this project's GLB rig. So we have to
// actively rotate the upper arms down into a relaxed pose, same as any
// other VRM idle-pose setup. -75°/+75° is a common starting point; tune
// per-model if the shoulders look pinned or the arms clip the torso.
function setIdlePoseVRM(vrm) {
    const h = vrm.humanoid
    if (!h) return

    const bones = {
        leftUpperArm: h.getNormalizedBoneNode('leftUpperArm'),
        rightUpperArm: h.getNormalizedBoneNode('rightUpperArm'),
        leftLowerArm: h.getNormalizedBoneNode('leftLowerArm'),
        rightLowerArm: h.getNormalizedBoneNode('rightLowerArm'),
        spine: h.getNormalizedBoneNode('spine')
    }

    const DEG = THREE.MathUtils.degToRad

    // Bring arms down from the T-pose rest pose into a relaxed A-pose —
    // slightly short of straight down (58° rather than 75°) so the hands
    // clear the skirt/hip geometry instead of clipping into it.
    if (bones.leftUpperArm) bones.leftUpperArm.rotation.z = DEG(58)
    if (bones.rightUpperArm) bones.rightUpperArm.rotation.z = DEG(-58)
    // Slight elbow bend so the arms don't look ruler-straight.
    if (bones.leftLowerArm) bones.leftLowerArm.rotation.z = DEG(8)
    if (bones.rightLowerArm) bones.rightLowerArm.rotation.z = DEG(-8)

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

    // Finger sway only exists on the classic rig's bone map — harmless
    // no-op for VRM, since those keys are simply absent there.
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
            // The GLB rig's named Spine bone and the VRM humanoid's
            // normalized spine bone rotate in opposite directions for the
            // same "bow forward" intent — flip the sign for VRM so it
            // doesn't bow backward.
            const bowSign = currentAvatarType === 'vrm' ? -1 : 1
            idleBones.spine.rotation.x = idleBase.spine.x + bowSign * eased * 0.35
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
    if (currentAvatarType === 'vrm') {
        startIdleBlinkingVRM()
        return
    }

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

// VRM's expressionManager exposes standard presets by name ('blink',
// 'happy', 'angry', 'sad', 'surprised', etc.) — this is the richer
// expression system VRM avatars are chosen for in the first place.
function startIdleBlinkingVRM() {
    if (!currentVRM?.expressionManager) return
    const em = currentVRM.expressionManager

    function blinkLoop() {
        const nextBlinkIn = 2000 + Math.random() * 4000
        setTimeout(() => {
            em.setValue('blink', 1)
            setTimeout(() => {
                em.setValue('blink', 0)
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

// Shared target computation — 0..~0.35 range, same scale your GLB rig's
// jawOpen blendshape always used. VRM's expressionManager expects roughly
// 0..1, so the VRM branch below rescales it rather than duplicating logic.
function computeMouthTarget(elapsed) {
    if (!isSpeaking) return 0
    if (externalJawTarget !== null) return externalJawTarget

    const wave = (Math.sin(elapsed * 9) * 0.5 + 0.5) * 0.22
    return Math.min(0.08 + wave, 0.35)
}

function updateLipSync(elapsed) {
    if (currentAvatarType === 'vrm') {
        updateLipSyncVRM(elapsed)
        return
    }

    if (!headMesh) return

    const target = computeMouthTarget(elapsed)
    currentJaw += (target - currentJaw) * 0.25
    setMorph([headMesh, teethLowerMesh], "jawOpen", currentJaw)
}

let currentVRMMouth = 0

function updateLipSyncVRM(elapsed) {
    if (!currentVRM?.expressionManager) return

    const target = computeMouthTarget(elapsed) / 0.35 // rescale to ~0..1
    currentVRMMouth += (target - currentVRMMouth) * 0.25
    currentVRM.expressionManager.setValue('aa', currentVRMMouth)
}

// Browser-voice fallback: pick a voice that matches the chosen language.
function pickVoice() {
    if (!('speechSynthesis' in window)) return null
    const prefix = currentLanguage === 'en' ? 'en' : 'de'
    const voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith(prefix))
    return (
        voices.find(v => /female|katja|petra|anna|helena|amala|zira|jenny|samantha/i.test(v.name)) ||
        voices[0] ||
        null
    )
}

if ('speechSynthesis' in window) {
    // Some browsers load the voice list asynchronously; touching it early
    // makes sure it is ready by the time the fallback is needed.
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
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
        body: JSON.stringify({
            text,
            voice: currentAvatarVoice,
            language: currentLanguage
        })
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
    speech.lang = t('speechLang')

    const voice = pickVoice()
    if (voice) speech.voice = voice

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
    input.placeholder = t('placeholder')

    const micBtn = document.createElement("button")
    micBtn.id = "mic-btn"
    micBtn.className = "chat-btn"
    micBtn.textContent = "🎤"
    micBtn.title = t('micTitle')

    const sendBtn = document.createElement("button")
    sendBtn.id = "send-btn"
    sendBtn.className = "chat-btn"
    sendBtn.textContent = t('send')

    row.appendChild(input)
    row.appendChild(micBtn)
    row.appendChild(sendBtn)
    container.appendChild(subtitle)
    container.appendChild(row)
    document.body.appendChild(container)

    async function handleQuestion(text) {
        if (!text || !text.trim()) return
        input.value = ""
        setSubtitle(t('thinking'))
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
        recognition.lang = t('speechLang')
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
        micBtn.title = t('micUnsupported')
    }
}


// ======================
// Animation loop
// ======================

const clock = new THREE.Clock()

function animate() {
    requestAnimationFrame(animate)
    const delta = clock.getDelta()
    const elapsed = clock.getElapsedTime()

    if (currentAvatarRoot) {
        applyIdleSway(elapsed)
        applyActiveGesture()
        updateLipSync(elapsed)
        currentAvatarRoot.position.y = Math.sin(Date.now() * 0.0015) * 0.005
    }

    // Required for VRM spring-bone physics (hair/clothing) and look-at to
    // update — plain GLB avatars have no equivalent step, hence the guard.
    if (currentVRM) {
        currentVRM.update(delta)
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