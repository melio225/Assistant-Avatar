import './style.css'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

import qrcode from 'qrcode-generator'

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
//
// To add a language:
//   1. add it to LANGUAGES (code, native name, speech-recognition locale),
//   2. add its texts to I18N (copy the English block and translate it),
//   3. add its English name to LANGUAGE_NAMES in server/server.js.
// A built-in offline FAQ only exists for German and English; every other
// language shows the "fallback" text if the backend is unreachable.

const LANGUAGES = [
    { code: "en", native: "English", speech: "en-US" },
    { code: "de", native: "Deutsch", speech: "de-DE" },
    { code: "fr", native: "Français", speech: "fr-FR" },
    { code: "es", native: "Español", speech: "es-ES" },
    { code: "it", native: "Italiano", speech: "it-IT" },
    { code: "pt", native: "Português", speech: "pt-PT" },
    { code: "nl", native: "Nederlands", speech: "nl-NL" },
    { code: "pl", native: "Polski", speech: "pl-PL" },
    { code: "tr", native: "Türkçe", speech: "tr-TR" },
    { code: "ru", native: "Русский", speech: "ru-RU" },
    { code: "uk", native: "Українська", speech: "uk-UA" },
    { code: "ar", native: "العربية", speech: "ar-SA", rtl: true },
    { code: "zh", native: "中文", speech: "zh-CN" },
    { code: "ja", native: "日本語", speech: "ja-JP" }
]

let currentLanguage = null // language code, set on the start screen

// Kiosk behaviour: after this much time without any input the page warns
// and then reloads, which brings back the welcome screen for the next guest.
const IDLE_TIMEOUT_MS = 3 * 60 * 1000 // total idle time before the reset
const IDLE_WARNING_S = 20             // the warning is shown for the last N seconds

// QR codes. They are shown on the big screen on the wall behind the avatar
// (rotating slides) and, on small or portrait screens, as link chips.
// Both QR codes are generated in the browser from their link, so changing a
// link here is all it takes. Set a url to "" to hide that QR code (its slide
// and its chip).
//  - APP_QR:  the Ernst App.
//  - SITE_QR: the official website.
const APP_QR = {
    title: "Ernst App",
    url: "https://www.eah-jena.de/hochschule/organisation-und-services/ernstapp"
}
const SITE_QR = {
    title: "EAH Jena",
    url: "https://www.eah-jena.de"
}

// Visual tuning — all motion and atmosphere values live here.
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const FX = {
    particleCount: 90,               // floating light dots in the scene (0 = off)
    particleSpread: [1.7, 2.2, 1.0], // half-extent x, height y, half-extent z
    particleSpeed: 0.06,             // upward drift
    parallaxStrength: 0.12,          // how far the view follows the pointer
    parallaxEase: 0.04,              // smoothing of that movement (0..1)
    lightSwayAmount: 0.6,            // slow side-to-side movement of the key light
    introDuration: 1.8,              // seconds for the camera move after the avatar loads
    bubbleLifetimeMs: 7000,          // how long a question bubble stays visible
    welcomeWordIntervalMs: 2600      // how fast the welcome word changes language
}

// The room around the avatar and how far the visitor may move the camera.
// Angles are in radians; distances in scene units (the avatar is ~1.7 high).
const ROOM = { halfWidth: 1.9, height: 2.8, back: -1.8, front: 5.2 }
const CAMERA_LIMITS = {
    minDistance: 2.4,
    maxDistance: 3.8,
    minAzimuth: -0.45,   // about 26 degrees to the left
    maxAzimuth: 0.45,    // about 26 degrees to the right
    minPolar: 1.2,       // how far the camera may look down from above
    maxPolar: 1.75,      // how far it may drop below the eye line
    rotateSpeed: 0.5
}

const I18N = {
    "en": {
        "welcome": "Welcome",
        "chooseLanguage": "Choose your language",
        "heading": "Choose your assistant",
        "back": "Back",
        "loading": "Loading assistant...",
        "badgeSub": "Virtual Campus Assistant",
        "greeting": "Hello, how can I help you today? I'm the virtual assistant of EAH Jena.",
        "placeholder": "Ask me something about EAH Jena...",
        "send": "Send",
        "thinking": "One moment...",
        "micTitle": "Ask by voice",
        "micUnsupported": "Voice input is not supported in this browser",
        "fallback": "That's a good question, but I don't have information on it yet. Please check eah-jena.de or ask the student office.",
        "suggestions": [
            "Which programs can I study?",
            "How can I apply?",
            "Where is the campus?",
            "When was EAH Jena founded?"
        ],
        "idleTitle": "Still there?",
        "idleText": "The session will reset in {s} seconds.",
        "idleStay": "I'm still here",
        "appText": "Scan the QR code to download the app",
        "siteLabel": "Website",
        "siteText": "Scan the QR code to visit the website",
        "stopTitle": "Stop talking",
        "slideNumbersTitle": "EAH Jena in numbers",
        "statFounded": "founded",
        "statStudents": "students",
        "statPrograms": "degree programs",
        "slideAreasTitle": "Four areas of study",
        "areaTech": "Technology",
        "areaBusiness": "Business",
        "areaSocial": "Social work",
        "areaHealth": "Health",
        "slideApplyTitle": "Thinking of applying?",
        "applyText": "Most programs have no admission restrictions, and many are free of tuition fees.",
        "applyWinter": "Winter semester",
        "applySummer": "Summer semester",
        "applyNote": "Usual deadlines. Exact dates are on each program's page.",
        "slideAskTitle": "Ask me anything",
        "askText": "Tap a suggested question or use the microphone."
    },
    "de": {
        "welcome": "Willkommen",
        "chooseLanguage": "Wähle deine Sprache",
        "heading": "Wähle deinen Assistenten",
        "back": "Zurück",
        "loading": "Assistent wird geladen...",
        "badgeSub": "Virtueller Campus-Assistent",
        "greeting": "Hallo, wie kann ich dir heute helfen? Ich bin der virtuelle Assistent der EAH Jena.",
        "placeholder": "Frag mich etwas über die EAH Jena...",
        "send": "Senden",
        "thinking": "Einen Moment...",
        "micTitle": "Per Sprache fragen",
        "micUnsupported": "Spracheingabe wird in diesem Browser nicht unterstützt",
        "fallback": "Das ist eine gute Frage — dazu habe ich noch keine Angabe, aber ich empfehle, auf eah-jena.de nachzuschauen oder das Studierendensekretariat zu fragen.",
        "suggestions": [
            "Welche Studiengänge gibt es?",
            "Wie kann ich mich bewerben?",
            "Wo liegt der Campus?",
            "Wann wurde die EAH Jena gegründet?"
        ],
        "idleTitle": "Noch da?",
        "idleText": "Die Sitzung wird in {s} Sekunden zurückgesetzt.",
        "idleStay": "Ich bin noch da",
        "appText": "QR-Code scannen und die App herunterladen",
        "siteLabel": "Webseite",
        "siteText": "QR-Code scannen und die Website besuchen",
        "stopTitle": "Sprechen stoppen",
        "slideNumbersTitle": "EAH Jena in Zahlen",
        "statFounded": "gegründet",
        "statStudents": "Studierende",
        "statPrograms": "Studiengänge",
        "slideAreasTitle": "Vier Studienbereiche",
        "areaTech": "Technik",
        "areaBusiness": "Wirtschaft",
        "areaSocial": "Soziales",
        "areaHealth": "Gesundheit",
        "slideApplyTitle": "Du willst dich bewerben?",
        "applyText": "Die meisten Studiengänge sind zulassungsfrei, viele auch gebührenfrei.",
        "applyWinter": "Wintersemester",
        "applySummer": "Sommersemester",
        "applyNote": "Übliche Fristen. Genaue Termine stehen auf der Seite des Studiengangs.",
        "slideAskTitle": "Frag mich etwas",
        "askText": "Tippe auf eine Beispielfrage oder nutze das Mikrofon."
    },
    "fr": {
        "welcome": "Bienvenue",
        "chooseLanguage": "Choisissez votre langue",
        "heading": "Choisissez votre assistant",
        "back": "Retour",
        "loading": "Chargement de l'assistant...",
        "badgeSub": "Assistant virtuel du campus",
        "greeting": "Bonjour, comment puis-je vous aider aujourd'hui ? Je suis l'assistant virtuel de l'EAH Jena.",
        "placeholder": "Posez-moi une question sur l'EAH Jena...",
        "send": "Envoyer",
        "thinking": "Un instant...",
        "micTitle": "Poser une question à voix haute",
        "micUnsupported": "La saisie vocale n'est pas prise en charge par ce navigateur",
        "fallback": "C'est une bonne question, mais je n'ai pas encore d'information à ce sujet. Je vous conseille de consulter eah-jena.de ou de vous adresser au secrétariat des étudiants.",
        "suggestions": [
            "Quelles filières puis-je étudier ?",
            "Comment puis-je postuler ?",
            "Où se trouve le campus ?",
            "Quand l'EAH Jena a-t-elle été fondée ?"
        ],
        "idleTitle": "Toujours là ?",
        "idleText": "La session sera réinitialisée dans {s} secondes.",
        "idleStay": "Je suis toujours là",
        "appText": "Scannez le code QR pour télécharger l'appli",
        "siteLabel": "Site web",
        "siteText": "Scannez le code QR pour visiter le site web",
        "stopTitle": "Arrêter la parole",
        "slideNumbersTitle": "L'EAH Jena en chiffres",
        "statFounded": "fondée",
        "statStudents": "étudiants",
        "statPrograms": "filières",
        "slideAreasTitle": "Quatre domaines d'études",
        "areaTech": "Technique",
        "areaBusiness": "Économie",
        "areaSocial": "Social",
        "areaHealth": "Santé",
        "slideApplyTitle": "Envie de postuler ?",
        "applyText": "La plupart des filières sont sans restriction d'admission, et beaucoup sont sans frais de scolarité.",
        "applyWinter": "Semestre d'hiver",
        "applySummer": "Semestre d'été",
        "applyNote": "Délais habituels. Les dates exactes figurent sur la page de chaque filière.",
        "slideAskTitle": "Posez-moi vos questions",
        "askText": "Touchez une question suggérée ou utilisez le microphone."
    },
    "es": {
        "welcome": "Bienvenido",
        "chooseLanguage": "Elige tu idioma",
        "heading": "Elige tu asistente",
        "back": "Atrás",
        "loading": "Cargando el asistente...",
        "badgeSub": "Asistente virtual del campus",
        "greeting": "¡Hola! ¿En qué puedo ayudarte hoy? Soy el asistente virtual de la EAH Jena.",
        "placeholder": "Pregúntame algo sobre la EAH Jena...",
        "send": "Enviar",
        "thinking": "Un momento...",
        "micTitle": "Preguntar por voz",
        "micUnsupported": "La entrada de voz no es compatible con este navegador",
        "fallback": "Es una buena pregunta, pero todavía no tengo información al respecto. Te recomiendo consultar eah-jena.de o preguntar en la secretaría de estudiantes.",
        "suggestions": [
            "¿Qué carreras puedo estudiar?",
            "¿Cómo puedo solicitar plaza?",
            "¿Dónde está el campus?",
            "¿Cuándo se fundó la EAH Jena?"
        ],
        "idleTitle": "¿Sigues ahí?",
        "idleText": "La sesión se reiniciará en {s} segundos.",
        "idleStay": "Sigo aquí",
        "appText": "Escanea el código QR para descargar la app",
        "siteLabel": "Sitio web",
        "siteText": "Escanea el código QR para visitar el sitio web",
        "stopTitle": "Detener la voz",
        "slideNumbersTitle": "La EAH Jena en cifras",
        "statFounded": "fundada",
        "statStudents": "estudiantes",
        "statPrograms": "titulaciones",
        "slideAreasTitle": "Cuatro áreas de estudio",
        "areaTech": "Tecnología",
        "areaBusiness": "Economía",
        "areaSocial": "Trabajo social",
        "areaHealth": "Salud",
        "slideApplyTitle": "¿Quieres solicitar plaza?",
        "applyText": "La mayoría de las titulaciones no tienen restricciones de admisión y muchas no cobran tasas.",
        "applyWinter": "Semestre de invierno",
        "applySummer": "Semestre de verano",
        "applyNote": "Plazos habituales. Las fechas exactas están en la página de cada titulación.",
        "slideAskTitle": "Pregúntame lo que quieras",
        "askText": "Toca una pregunta sugerida o usa el micrófono."
    },
    "it": {
        "welcome": "Benvenuto",
        "chooseLanguage": "Scegli la tua lingua",
        "heading": "Scegli il tuo assistente",
        "back": "Indietro",
        "loading": "Caricamento dell'assistente...",
        "badgeSub": "Assistente virtuale del campus",
        "greeting": "Ciao, come posso aiutarti oggi? Sono l'assistente virtuale della EAH Jena.",
        "placeholder": "Chiedimi qualcosa sulla EAH Jena...",
        "send": "Invia",
        "thinking": "Un attimo...",
        "micTitle": "Chiedi a voce",
        "micUnsupported": "L'input vocale non è supportato da questo browser",
        "fallback": "È una bella domanda, ma non ho ancora informazioni a riguardo. Ti consiglio di consultare eah-jena.de o di rivolgerti alla segreteria studenti.",
        "suggestions": [
            "Quali corsi di studio posso frequentare?",
            "Come posso candidarmi?",
            "Dov'è il campus?",
            "Quando è stata fondata la EAH Jena?"
        ],
        "idleTitle": "Sei ancora lì?",
        "idleText": "La sessione verrà reimpostata tra {s} secondi.",
        "idleStay": "Sono ancora qui",
        "appText": "Scansiona il codice QR per scaricare l'app",
        "siteLabel": "Sito web",
        "siteText": "Scansiona il codice QR per visitare il sito web",
        "stopTitle": "Interrompi la voce",
        "slideNumbersTitle": "La EAH Jena in cifre",
        "statFounded": "fondata",
        "statStudents": "studenti",
        "statPrograms": "corsi di studio",
        "slideAreasTitle": "Quattro aree di studio",
        "areaTech": "Tecnica",
        "areaBusiness": "Economia",
        "areaSocial": "Sociale",
        "areaHealth": "Salute",
        "slideApplyTitle": "Vuoi candidarti?",
        "applyText": "La maggior parte dei corsi è ad accesso libero e molti sono senza tasse universitarie.",
        "applyWinter": "Semestre invernale",
        "applySummer": "Semestre estivo",
        "applyNote": "Scadenze abituali. Le date esatte sono sulla pagina di ogni corso.",
        "slideAskTitle": "Chiedimi qualsiasi cosa",
        "askText": "Tocca una domanda suggerita o usa il microfono."
    },
    "pt": {
        "welcome": "Bem-vindo",
        "chooseLanguage": "Escolha o seu idioma",
        "heading": "Escolha o seu assistente",
        "back": "Voltar",
        "loading": "A carregar o assistente...",
        "badgeSub": "Assistente virtual do campus",
        "greeting": "Olá, como posso ajudá-lo hoje? Sou o assistente virtual da EAH Jena.",
        "placeholder": "Pergunte-me algo sobre a EAH Jena...",
        "send": "Enviar",
        "thinking": "Um momento...",
        "micTitle": "Perguntar por voz",
        "micUnsupported": "A entrada de voz não é suportada neste navegador",
        "fallback": "É uma boa pergunta, mas ainda não tenho informação sobre isso. Recomendo consultar eah-jena.de ou perguntar na secretaria de estudantes.",
        "suggestions": [
            "Que cursos posso estudar?",
            "Como posso candidatar-me?",
            "Onde fica o campus?",
            "Quando foi fundada a EAH Jena?"
        ],
        "idleTitle": "Ainda aí?",
        "idleText": "A sessão será reiniciada em {s} segundos.",
        "idleStay": "Ainda estou aqui",
        "appText": "Leia o código QR para descarregar a app",
        "siteLabel": "Site",
        "siteText": "Leia o código QR para visitar o site",
        "stopTitle": "Parar a fala",
        "slideNumbersTitle": "A EAH Jena em números",
        "statFounded": "fundada",
        "statStudents": "estudantes",
        "statPrograms": "cursos",
        "slideAreasTitle": "Quatro áreas de estudo",
        "areaTech": "Tecnologia",
        "areaBusiness": "Economia",
        "areaSocial": "Serviço social",
        "areaHealth": "Saúde",
        "slideApplyTitle": "Quer candidatar-se?",
        "applyText": "A maioria dos cursos não tem restrições de admissão e muitos não têm propinas.",
        "applyWinter": "Semestre de inverno",
        "applySummer": "Semestre de verão",
        "applyNote": "Prazos habituais. As datas exatas estão na página de cada curso.",
        "slideAskTitle": "Pergunte-me o que quiser",
        "askText": "Toque numa pergunta sugerida ou use o microfone."
    },
    "nl": {
        "welcome": "Welkom",
        "chooseLanguage": "Kies je taal",
        "heading": "Kies je assistent",
        "back": "Terug",
        "loading": "Assistent wordt geladen...",
        "badgeSub": "Virtuele campusassistent",
        "greeting": "Hallo, waarmee kan ik je vandaag helpen? Ik ben de virtuele assistent van de EAH Jena.",
        "placeholder": "Stel me een vraag over de EAH Jena...",
        "send": "Verzenden",
        "thinking": "Een moment...",
        "micTitle": "Stel je vraag met je stem",
        "micUnsupported": "Spraakinvoer wordt in deze browser niet ondersteund",
        "fallback": "Dat is een goede vraag, maar daar heb ik nog geen informatie over. Kijk op eah-jena.de of vraag het bij het studentensecretariaat.",
        "suggestions": [
            "Welke opleidingen kan ik volgen?",
            "Hoe kan ik me aanmelden?",
            "Waar ligt de campus?",
            "Wanneer is de EAH Jena opgericht?"
        ],
        "idleTitle": "Ben je er nog?",
        "idleText": "De sessie wordt over {s} seconden gereset.",
        "idleStay": "Ik ben er nog",
        "appText": "Scan de QR-code om de app te downloaden",
        "siteLabel": "Website",
        "siteText": "Scan de QR-code om de website te bezoeken",
        "stopTitle": "Stop met praten",
        "slideNumbersTitle": "EAH Jena in cijfers",
        "statFounded": "opgericht",
        "statStudents": "studenten",
        "statPrograms": "opleidingen",
        "slideAreasTitle": "Vier studiegebieden",
        "areaTech": "Techniek",
        "areaBusiness": "Economie",
        "areaSocial": "Sociaal werk",
        "areaHealth": "Gezondheid",
        "slideApplyTitle": "Wil je je aanmelden?",
        "applyText": "De meeste opleidingen hebben geen toelatingsbeperking en veel zijn zonder collegegeld.",
        "applyWinter": "Wintersemester",
        "applySummer": "Zomersemester",
        "applyNote": "Gebruikelijke deadlines. Exacte data staan op de pagina van elke opleiding.",
        "slideAskTitle": "Stel me een vraag",
        "askText": "Tik op een voorbeeldvraag of gebruik de microfoon."
    },
    "pl": {
        "welcome": "Witamy",
        "chooseLanguage": "Wybierz język",
        "heading": "Wybierz swojego asystenta",
        "back": "Wstecz",
        "loading": "Ładowanie asystenta...",
        "badgeSub": "Wirtualny asystent kampusu",
        "greeting": "Cześć, w czym mogę dziś pomóc? Jestem wirtualnym asystentem EAH Jena.",
        "placeholder": "Zapytaj mnie o EAH Jena...",
        "send": "Wyślij",
        "thinking": "Chwileczkę...",
        "micTitle": "Zapytaj głosowo",
        "micUnsupported": "Wprowadzanie głosowe nie jest obsługiwane w tej przeglądarce",
        "fallback": "To dobre pytanie, ale nie mam jeszcze na ten temat informacji. Zajrzyj na eah-jena.de lub zapytaj w biurze obsługi studentów.",
        "suggestions": [
            "Jakie kierunki mogę studiować?",
            "Jak mogę się zgłosić?",
            "Gdzie znajduje się kampus?",
            "Kiedy założono EAH Jena?"
        ],
        "idleTitle": "Nadal tu jesteś?",
        "idleText": "Sesja zostanie zresetowana za {s} s.",
        "idleStay": "Nadal tu jestem",
        "appText": "Zeskanuj kod QR, aby pobrać aplikację",
        "siteLabel": "Strona",
        "siteText": "Zeskanuj kod QR, aby odwiedzić stronę",
        "stopTitle": "Zatrzymaj mowę",
        "slideNumbersTitle": "EAH Jena w liczbach",
        "statFounded": "założona",
        "statStudents": "studentów",
        "statPrograms": "kierunków",
        "slideAreasTitle": "Cztery obszary studiów",
        "areaTech": "Technika",
        "areaBusiness": "Ekonomia",
        "areaSocial": "Praca socjalna",
        "areaHealth": "Zdrowie",
        "slideApplyTitle": "Chcesz aplikować?",
        "applyText": "Większość kierunków nie ma ograniczeń przyjęć, a wiele jest bez czesnego.",
        "applyWinter": "Semestr zimowy",
        "applySummer": "Semestr letni",
        "applyNote": "Zwykłe terminy. Dokładne daty są na stronie kierunku.",
        "slideAskTitle": "Zapytaj mnie o cokolwiek",
        "askText": "Dotknij proponowanego pytania lub użyj mikrofonu."
    },
    "tr": {
        "welcome": "Hoş geldiniz",
        "chooseLanguage": "Dilinizi seçin",
        "heading": "Asistanınızı seçin",
        "back": "Geri",
        "loading": "Asistan yükleniyor...",
        "badgeSub": "Sanal kampüs asistanı",
        "greeting": "Merhaba, bugün size nasıl yardımcı olabilirim? Ben EAH Jena'nın sanal asistanıyım.",
        "placeholder": "Bana EAH Jena hakkında bir şey sorun...",
        "send": "Gönder",
        "thinking": "Bir saniye...",
        "micTitle": "Sesli sor",
        "micUnsupported": "Sesli giriş bu tarayıcıda desteklenmiyor",
        "fallback": "Güzel bir soru, ancak henüz bu konuda bilgim yok. eah-jena.de adresine bakmanızı veya öğrenci işlerine danışmanızı öneririm.",
        "suggestions": [
            "Hangi bölümlerde okuyabilirim?",
            "Nasıl başvurabilirim?",
            "Kampüs nerede?",
            "EAH Jena ne zaman kuruldu?"
        ],
        "idleTitle": "Hâlâ orada mısınız?",
        "idleText": "Oturum {s} saniye içinde sıfırlanacak.",
        "idleStay": "Buradayım",
        "appText": "Uygulamayı indirmek için QR kodu tarayın",
        "siteLabel": "Web sitesi",
        "siteText": "Web sitesini ziyaret etmek için QR kodu tarayın",
        "stopTitle": "Konuşmayı durdur",
        "slideNumbersTitle": "Sayılarla EAH Jena",
        "statFounded": "kuruluş",
        "statStudents": "öğrenci",
        "statPrograms": "program",
        "slideAreasTitle": "Dört çalışma alanı",
        "areaTech": "Teknik",
        "areaBusiness": "İşletme",
        "areaSocial": "Sosyal hizmet",
        "areaHealth": "Sağlık",
        "slideApplyTitle": "Başvurmak mı istiyorsunuz?",
        "applyText": "Programların çoğunda kabul kısıtlaması yoktur ve birçoğu harçsızdır.",
        "applyWinter": "Güz dönemi",
        "applySummer": "Bahar dönemi",
        "applyNote": "Olağan son tarihler. Kesin tarihler her programın sayfasındadır.",
        "slideAskTitle": "Bana her şeyi sorun",
        "askText": "Önerilen bir soruya dokunun veya mikrofonu kullanın."
    },
    "ru": {
        "welcome": "Добро пожаловать",
        "chooseLanguage": "Выберите язык",
        "heading": "Выберите ассистента",
        "back": "Назад",
        "loading": "Загрузка ассистента...",
        "badgeSub": "Виртуальный ассистент кампуса",
        "greeting": "Здравствуйте! Чем могу помочь? Я виртуальный ассистент EAH Jena.",
        "placeholder": "Спросите меня об EAH Jena...",
        "send": "Отправить",
        "thinking": "Минутку...",
        "micTitle": "Задать вопрос голосом",
        "micUnsupported": "Голосовой ввод не поддерживается в этом браузере",
        "fallback": "Хороший вопрос, но у меня пока нет информации об этом. Рекомендую заглянуть на eah-jena.de или обратиться в студенческий секретариат.",
        "suggestions": [
            "Какие специальности можно выбрать?",
            "Как подать заявление?",
            "Где находится кампус?",
            "Когда основана EAH Jena?"
        ],
        "idleTitle": "Вы ещё здесь?",
        "idleText": "Сеанс будет сброшен через {s} с.",
        "idleStay": "Я здесь",
        "appText": "Отсканируйте QR-код, чтобы скачать приложение",
        "siteLabel": "Сайт",
        "siteText": "Отсканируйте QR-код, чтобы открыть сайт",
        "stopTitle": "Остановить речь",
        "slideNumbersTitle": "EAH Jena в цифрах",
        "statFounded": "основана",
        "statStudents": "студентов",
        "statPrograms": "программ обучения",
        "slideAreasTitle": "Четыре направления обучения",
        "areaTech": "Техника",
        "areaBusiness": "Экономика",
        "areaSocial": "Социальная работа",
        "areaHealth": "Здравоохранение",
        "slideApplyTitle": "Хотите поступить?",
        "applyText": "Большинство программ без ограничений при приёме, многие бесплатные.",
        "applyWinter": "Зимний семестр",
        "applySummer": "Летний семестр",
        "applyNote": "Обычные сроки. Точные даты указаны на странице программы.",
        "slideAskTitle": "Спросите меня о чём угодно",
        "askText": "Нажмите на подсказку или используйте микрофон."
    },
    "uk": {
        "welcome": "Ласкаво просимо",
        "chooseLanguage": "Оберіть мову",
        "heading": "Оберіть асистента",
        "back": "Назад",
        "loading": "Завантаження асистента...",
        "badgeSub": "Віртуальний асистент кампусу",
        "greeting": "Вітаю! Чим я можу допомогти? Я віртуальний асистент EAH Jena.",
        "placeholder": "Запитайте мене про EAH Jena...",
        "send": "Надіслати",
        "thinking": "Хвилинку...",
        "micTitle": "Запитати голосом",
        "micUnsupported": "Голосове введення не підтримується в цьому браузері",
        "fallback": "Гарне запитання, але в мене поки немає інформації про це. Радимо зазирнути на eah-jena.de або звернутися до студентського секретаріату.",
        "suggestions": [
            "Які спеціальності можна обрати?",
            "Як подати заявку?",
            "Де розташований кампус?",
            "Коли засновано EAH Jena?"
        ],
        "idleTitle": "Ви ще тут?",
        "idleText": "Сеанс буде скинуто через {s} с.",
        "idleStay": "Я тут",
        "appText": "Скануйте QR-код, щоб завантажити застосунок",
        "siteLabel": "Вебсайт",
        "siteText": "Скануйте QR-код, щоб відкрити вебсайт",
        "stopTitle": "Зупинити мовлення",
        "slideNumbersTitle": "EAH Jena в цифрах",
        "statFounded": "заснована",
        "statStudents": "студентів",
        "statPrograms": "програм навчання",
        "slideAreasTitle": "Чотири напрями навчання",
        "areaTech": "Техніка",
        "areaBusiness": "Економіка",
        "areaSocial": "Соціальна робота",
        "areaHealth": "Охорона здоров'я",
        "slideApplyTitle": "Хочете вступити?",
        "applyText": "Більшість програм без обмежень при вступі, багато з них безкоштовні.",
        "applyWinter": "Зимовий семестр",
        "applySummer": "Літній семестр",
        "applyNote": "Звичайні терміни. Точні дати вказані на сторінці програми.",
        "slideAskTitle": "Запитайте мене про що завгодно",
        "askText": "Торкніться підказки або скористайтеся мікрофоном."
    },
    "ar": {
        "welcome": "مرحباً بكم",
        "chooseLanguage": "اختر لغتك",
        "heading": "اختر مساعدك",
        "back": "رجوع",
        "loading": "جارٍ تحميل المساعد...",
        "badgeSub": "المساعد الافتراضي للحرم الجامعي",
        "greeting": "مرحباً، كيف يمكنني مساعدتك اليوم؟ أنا المساعد الافتراضي لجامعة EAH Jena.",
        "placeholder": "اسألني عن جامعة EAH Jena...",
        "send": "إرسال",
        "thinking": "لحظة من فضلك...",
        "micTitle": "اسأل بالصوت",
        "micUnsupported": "الإدخال الصوتي غير مدعوم في هذا المتصفح",
        "fallback": "سؤال جيد، لكن ليست لدي معلومات عنه بعد. أنصحك بزيارة eah-jena.de أو سؤال شؤون الطلاب.",
        "suggestions": [
            "ما التخصصات التي يمكنني دراستها؟",
            "كيف أتقدم بطلب الالتحاق؟",
            "أين يقع الحرم الجامعي؟",
            "متى تأسست EAH Jena؟"
        ],
        "idleTitle": "هل ما زلت هنا؟",
        "idleText": "ستُعاد تهيئة الجلسة خلال {s} ثانية.",
        "idleStay": "ما زلت هنا",
        "appText": "امسح رمز QR لتحميل التطبيق",
        "siteLabel": "الموقع",
        "siteText": "امسح رمز QR لزيارة الموقع الإلكتروني",
        "stopTitle": "إيقاف الكلام",
        "slideNumbersTitle": "EAH Jena بالأرقام",
        "statFounded": "تأسست",
        "statStudents": "طالب",
        "statPrograms": "برنامج دراسي",
        "slideAreasTitle": "أربعة مجالات للدراسة",
        "areaTech": "التقنية",
        "areaBusiness": "الاقتصاد",
        "areaSocial": "العمل الاجتماعي",
        "areaHealth": "الصحة",
        "slideApplyTitle": "هل تفكر في التقديم؟",
        "applyText": "معظم البرامج بلا قيود قبول، والعديد منها بلا رسوم دراسية.",
        "applyWinter": "الفصل الشتوي",
        "applySummer": "الفصل الصيفي",
        "applyNote": "المواعيد المعتادة. المواعيد الدقيقة في صفحة كل برنامج.",
        "slideAskTitle": "اسألني أي شيء",
        "askText": "المس سؤالاً مقترحاً أو استخدم الميكروفون."
    },
    "zh": {
        "welcome": "欢迎",
        "chooseLanguage": "请选择语言",
        "heading": "请选择您的助手",
        "back": "返回",
        "loading": "正在加载助手……",
        "badgeSub": "虚拟校园助手",
        "greeting": "您好，今天有什么可以帮您？我是 EAH Jena 的虚拟助手。",
        "placeholder": "向我询问有关 EAH Jena 的问题……",
        "send": "发送",
        "thinking": "请稍等……",
        "micTitle": "语音提问",
        "micUnsupported": "此浏览器不支持语音输入",
        "fallback": "这是个好问题，但我暂时没有相关信息。建议您访问 eah-jena.de 或咨询学生事务办公室。",
        "suggestions": [
            "我可以学习哪些专业？",
            "我该如何申请？",
            "校园在哪里？",
            "EAH Jena 是什么时候成立的？"
        ],
        "idleTitle": "您还在吗？",
        "idleText": "会话将在 {s} 秒后重置。",
        "idleStay": "我还在",
        "appText": "扫描二维码下载应用",
        "siteLabel": "官网",
        "siteText": "扫描二维码访问网站",
        "stopTitle": "停止说话",
        "slideNumbersTitle": "数字看 EAH Jena",
        "statFounded": "成立",
        "statStudents": "学生",
        "statPrograms": "学位项目",
        "slideAreasTitle": "四大学习领域",
        "areaTech": "技术",
        "areaBusiness": "经济",
        "areaSocial": "社会工作",
        "areaHealth": "健康",
        "slideApplyTitle": "想申请吗？",
        "applyText": "大多数专业无入学限制，许多专业免学费。",
        "applyWinter": "冬季学期",
        "applySummer": "夏季学期",
        "applyNote": "常规截止日期，具体日期请见各专业页面。",
        "slideAskTitle": "有问题尽管问",
        "askText": "点击推荐问题或使用麦克风。"
    },
    "ja": {
        "welcome": "ようこそ",
        "chooseLanguage": "言語を選択してください",
        "heading": "アシスタントを選択してください",
        "back": "戻る",
        "loading": "アシスタントを読み込み中…",
        "badgeSub": "バーチャルキャンパスアシスタント",
        "greeting": "こんにちは。本日はどのようなご用件でしょうか。私は EAH Jena のバーチャルアシスタントです。",
        "placeholder": "EAH Jena について質問してください…",
        "send": "送信",
        "thinking": "少々お待ちください…",
        "micTitle": "音声で質問する",
        "micUnsupported": "このブラウザでは音声入力に対応していません",
        "fallback": "良いご質問ですが、まだ情報がありません。eah-jena.de をご覧いただくか、学生課にお問い合わせください。",
        "suggestions": [
            "どんな学科がありますか？",
            "どうやって出願しますか？",
            "キャンパスはどこにありますか？",
            "EAH Jena はいつ設立されましたか？"
        ],
        "idleTitle": "まだいらっしゃいますか？",
        "idleText": "{s} 秒後にリセットされます。",
        "idleStay": "まだいます",
        "appText": "QRコードを読み取ってアプリをダウンロード",
        "siteLabel": "ウェブサイト",
        "siteText": "QRコードを読み取ってウェブサイトへ",
        "stopTitle": "話すのを止める",
        "slideNumbersTitle": "数字で見る EAH Jena",
        "statFounded": "設立",
        "statStudents": "学生",
        "statPrograms": "学位プログラム",
        "slideAreasTitle": "4つの学習分野",
        "areaTech": "技術",
        "areaBusiness": "経済",
        "areaSocial": "社会福祉",
        "areaHealth": "健康",
        "slideApplyTitle": "出願をお考えですか？",
        "applyText": "ほとんどのプログラムは入学制限がなく、多くは授業料も無料です。",
        "applyWinter": "冬学期",
        "applySummer": "夏学期",
        "applyNote": "通常の締切です。正確な日付は各プログラムのページをご覧ください。",
        "slideAskTitle": "なんでも聞いてください",
        "askText": "おすすめの質問をタップするか、マイクを使ってください。"
    }
}

// Text lookup: falls back to English if a key is missing in a language.
function t(key) {
    const code = currentLanguage || 'de'
    if (key === 'speechLang') {
        return (LANGUAGES.find(l => l.code === code) || LANGUAGES[0]).speech
    }
    const entry = I18N[code] || I18N.en
    return entry[key] !== undefined ? entry[key] : I18N.en[key]
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
    // Built-in offline answers exist for German and English only.
    const base = currentLanguage === 'en' ? KNOWLEDGE_BASE_EN
        : currentLanguage === 'de' ? KNOWLEDGE_BASE
        : []
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

// Returns the answer, or null if the request was cancelled (a newer question
// replaced it, or the visitor pressed stop).
async function getAnswer(question, signal) {
    try {
        const response = await fetch(CHAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question,
                history: conversationHistory,
                language: currentLanguage
            }),
            signal
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
        if (err.name === "AbortError") return null
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
scene.background = new THREE.Color(0x002e2e) // seen only if the room is not covering the view

const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 64),
    new THREE.MeshStandardMaterial({
        color: 0x003333,
        transparent: true,
        opacity: 0.25,
        roughness: 0.8
    })
)
ground.rotation.x = -Math.PI / 2
scene.add(ground)

// A thin glowing ring on the floor that breathes slowly.
const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 1.68, 96),
    new THREE.MeshBasicMaterial({
        color: 0x7fd0d0,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    })
)
ring.rotation.x = -Math.PI / 2
ring.position.y = 0.002
scene.add(ring)

// ======================
// Room (a closed cube around the avatar)
// ======================
//
// Unlit materials with painted textures, so the look is exactly what is
// drawn here and does not depend on scene lighting. The camera limits
// further below keep the visitor inside the room.

const ROOM_DEPTH = ROOM.front - ROOM.back
const ROOM_CENTER_Z = (ROOM.front + ROOM.back) / 2
const ROOM_WIDTH = ROOM.halfWidth * 2

function paintedTexture(w, h, paint) {
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    paint(canvas.getContext("2d"), w, h)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
}

// worldW x worldH is the real size of the wall in scene units, so panel
// widths and the baseboard keep correct proportions on every wall.
function wallTexture(worldW, worldH) {
    const w = 1024
    const h = Math.round(w * worldH / worldW)
    return paintedTexture(w, h, (g) => {
        const base = g.createLinearGradient(0, 0, 0, h)
        base.addColorStop(0, "#005c5c")
        base.addColorStop(0.55, "#007070")
        base.addColorStop(1, "#004a4b")
        g.fillStyle = base
        g.fillRect(0, 0, w, h)

        // vertical panels, 0.7 units wide
        const panelW = 0.7 / worldW * w
        let n = 0
        for (let x = 0; x < w; x += panelW, n++) {
            if (n % 2 === 1) {
                g.fillStyle = "rgba(255,255,255,0.035)"
                g.fillRect(x, 0, panelW, h)
            }
            g.fillStyle = "rgba(0,0,0,0.18)"
            g.fillRect(x - 2, 0, 4, h)
            g.fillStyle = "rgba(127,208,208,0.12)"
            g.fillRect(x + 2, 0, 2, h)
        }

        // light spilling down from the ceiling
        const spill = g.createLinearGradient(0, 0, 0, h * 0.4)
        spill.addColorStop(0, "rgba(207,250,250,0.32)")
        spill.addColorStop(1, "rgba(207,250,250,0)")
        g.fillStyle = spill
        g.fillRect(0, 0, w, h * 0.4)

        // baseboard with a thin glowing line on top
        const bb = 0.16 / worldH * h
        g.fillStyle = "#003636"
        g.fillRect(0, h - bb, w, bb)
        g.fillStyle = "rgba(127,208,208,0.65)"
        g.fillRect(0, h - bb - 3, w, 3)

        // darker corners where walls meet
        const edge = w * 0.10
        ;[[0, edge], [w, w - edge]].forEach(([x0, x1]) => {
            const gr = g.createLinearGradient(x0, 0, x1, 0)
            gr.addColorStop(0, "rgba(0,20,20,0.45)")
            gr.addColorStop(1, "rgba(0,20,20,0)")
            g.fillStyle = gr
            g.fillRect(Math.min(x0, x1), 0, edge, h)
        })
    })
}

function floorTexture() {
    const w = 512
    const h = Math.round(w * ROOM_DEPTH / ROOM_WIDTH)
    return paintedTexture(w, h, (g) => {
        g.fillStyle = "#003c3c"
        g.fillRect(0, 0, w, h)

        // 0.5-unit grid
        g.strokeStyle = "rgba(127,208,208,0.13)"
        g.lineWidth = 2
        for (let x = 0; x <= w; x += 0.5 / ROOM_WIDTH * w) {
            g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke()
        }
        for (let y = 0; y <= h; y += 0.5 / ROOM_DEPTH * h) {
            g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke()
        }

        // soft glow around the spot where the avatar stands (z = 0);
        // the top of this texture is the back wall
        const cy = (0 - ROOM.back) / ROOM_DEPTH * h
        const glow = g.createRadialGradient(w / 2, cy, 0, w / 2, cy, w * 0.62)
        glow.addColorStop(0, "rgba(127,208,208,0.42)")
        glow.addColorStop(1, "rgba(127,208,208,0)")
        g.fillStyle = glow
        g.fillRect(0, 0, w, h)
    })
}

function ceilingTexture() {
    const w = 512
    const h = Math.round(w * ROOM_DEPTH / ROOM_WIDTH)
    return paintedTexture(w, h, (g) => {
        g.fillStyle = "#00302f"
        g.fillRect(0, 0, w, h)

        // glowing light panels above the avatar and in front of it;
        // the top of this texture is the front of the room
        ;[0, 2.6].forEach((z) => {
            const cy = (ROOM.front - z) / ROOM_DEPTH * h
            const pw = 1.1 / ROOM_WIDTH * w
            const ph = 1.4 / ROOM_DEPTH * h
            g.save()
            g.shadowColor = "rgba(207,250,250,0.9)"
            g.shadowBlur = 40
            g.fillStyle = "#e6ffff"
            g.fillRect(w / 2 - pw / 2, cy - ph / 2, pw, ph)
            g.restore()
        })
    })
}

function addRoom() {
    const flat = (map) => new THREE.MeshBasicMaterial({ map })
    const H = ROOM.height

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), flat(floorTexture()))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, -0.001, ROOM_CENTER_Z)

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), flat(ceilingTexture()))
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.set(0, H, ROOM_CENTER_Z)

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, H), flat(wallTexture(ROOM_WIDTH, H)))
    backWall.position.set(0, H / 2, ROOM.back)

    const left = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, H), flat(wallTexture(ROOM_DEPTH, H)))
    left.rotation.y = Math.PI / 2
    left.position.set(-ROOM.halfWidth, H / 2, ROOM_CENTER_Z)

    const right = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, H), flat(wallTexture(ROOM_DEPTH, H)))
    right.rotation.y = -Math.PI / 2
    right.position.set(ROOM.halfWidth, H / 2, ROOM_CENTER_Z)

    scene.add(floor, ceiling, backWall, left, right)
}

addRoom()

// ======================
// Big screen on the back wall
// ======================
//
// A large screen hangs on the wall behind the avatar and rotates through
// slides: the website QR code, the Ernst App QR picture and a few general
// facts. Each slide is painted once into its own canvas (in the chosen
// language); the screen only cross-fades between them, so it costs almost
// nothing while a slide is showing. The content sits on the left and the
// right, which leaves the middle free for the avatar standing in front.
// On small or portrait screens the screen would be too small to read; there
// the QR codes appear as link chips instead (see buildQrChips).

const SCREEN = {
    w: 3.3, h: 1.3, y: 1.25,       // size and height of the screen in the room (low enough to clear the badge)
    canvasW: 1584, canvasH: 624,   // painting resolution (same proportions as w x h)
    slideSeconds: 8,               // how long each slide stays
    fadeSeconds: 0.8,              // cross-fade between slides
    leftX: 60, rightX: 1024,       // the two content zones (px on the canvas)
    zoneW: 500
}

const FONT_HEAD = '"Space Grotesk","Inter","Noto Sans",system-ui,sans-serif'
const FONT_BODY = '"Inter","Noto Sans",system-ui,sans-serif'
const FONT_MONO = '"JetBrains Mono",ui-monospace,monospace'

const screenState = {
    group: null,     // the meshes of the screen
    ctx: null,       // the canvas the visitor sees
    texture: null,
    slides: [],      // one painted canvas per slide
    index: 0,
    shownAt: 0,
    fade: null,      // { from, to, start, progress } while cross-fading
    active: false
}

// The university logo drawn in the header of every slide.
const screenLogo = new Image()
screenLogo.addEventListener("load", () => rebuildScreenSlides())
screenLogo.src = eahLogoUrl

function isRtl() {
    const lang = LANGUAGES.find(l => l.code === currentLanguage)
    return !!(lang && lang.rtl)
}

// ---- small painting helpers ----

function roundedRect(g, x, y, w, h, r) {
    g.beginPath()
    g.moveTo(x + r, y)
    g.arcTo(x + w, y, x + w, y + h, r)
    g.arcTo(x + w, y + h, x, y + h, r)
    g.arcTo(x, y + h, x, y, r)
    g.arcTo(x, y, x + w, y, r)
    g.closePath()
}

// Where text starts inside a zone: the left edge, or the right edge for Arabic.
function zoneAnchor(start) {
    return isRtl() ? start + SCREEN.zoneW : start
}

function setTextDirection(g) {
    g.textAlign = isRtl() ? "right" : "left"
    g.direction = isRtl() ? "rtl" : "ltr"
    g.textBaseline = "alphabetic"
}

// Shrinks the font until the text fits the width (keeps long translations inside their zone).
function fitFont(g, text, weight, family, maxW, startPx, minPx) {
    let px = startPx
    g.font = `${weight} ${px}px ${family}`
    while (px > minPx && g.measureText(text).width > maxW) {
        px -= 2
        g.font = `${weight} ${px}px ${family}`
    }
    return px
}

// Word wrap that also works for Chinese and Japanese (no spaces: every
// character may start a new line).
function wrapLines(g, text, maxW) {
    const tokens = text.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]|[^\s\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]+|\s+/g) || []
    const lines = []
    let line = ""
    for (const tok of tokens) {
        const test = line + tok
        if (g.measureText(test.trim()).width > maxW && line.trim()) {
            lines.push(line.trim())
            line = tok.trimStart()
        } else {
            line = test
        }
    }
    if (line.trim()) lines.push(line.trim())
    return lines
}

// Draws wrapped text and returns the y position below the last line.
function paintParagraph(g, text, x, y, maxW, lineH) {
    const lines = wrapLines(g, text, maxW)
    lines.forEach((line, k) => g.fillText(line, x, y + k * lineH))
    return y + lines.length * lineH
}

function drawQrMatrix(g, url, x, y, size) {
    const qr = qrcode(0, "M")
    qr.addData(url)
    qr.make()
    const n = qr.getModuleCount()
    const cell = Math.floor(size / n)
    const ox = x + (size - cell * n) / 2
    const oy = y + (size - cell * n) / 2
    g.fillStyle = "#10201f"
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (qr.isDark(r, c)) g.fillRect(ox + c * cell, oy + r * cell, cell, cell)
        }
    }
}

// White tile with a soft shadow; the QR is drawn inside, leaving a quiet zone.
function drawQrTile(g, x, y, size, drawInner) {
    g.save()
    g.shadowColor = "rgba(0,0,0,0.35)"
    g.shadowBlur = 36
    g.shadowOffsetY = 12
    roundedRect(g, x, y, size, size, 30)
    g.fillStyle = "#ffffff"
    g.fill()
    g.restore()
    g.imageSmoothingQuality = "high"
    drawInner(g, x + 28, y + 28, size - 56)
}

// Background, header (logo + small title) and page dots shared by all slides.
function paintBase(g, kicker, i, n) {
    const W = SCREEN.canvasW
    const H = SCREEN.canvasH

    const bg = g.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, "#00322f")
    bg.addColorStop(1, "#00706f")
    g.fillStyle = bg
    g.fillRect(0, 0, W, H)

    const glow = g.createRadialGradient(W * 0.8, H * 0.35, 0, W * 0.8, H * 0.35, W * 0.5)
    glow.addColorStop(0, "rgba(127,208,208,0.25)")
    glow.addColorStop(1, "rgba(127,208,208,0)")
    g.fillStyle = glow
    g.fillRect(0, 0, W, H)

    // faint scan lines, like a real screen
    g.fillStyle = "rgba(255,255,255,0.025)"
    for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2)

    // logo tile
    roundedRect(g, SCREEN.leftX, 34, 84, 84, 18)
    g.fillStyle = "#ffffff"
    g.fill()
    if (screenLogo.complete && screenLogo.naturalWidth) {
        const box = 60
        const r = Math.min(box / screenLogo.naturalWidth, box / screenLogo.naturalHeight)
        const w = screenLogo.naturalWidth * r
        const h = screenLogo.naturalHeight * r
        g.drawImage(screenLogo, SCREEN.leftX + (84 - w) / 2, 34 + (84 - h) / 2, w, h)
    }

    // small title next to the logo
    g.direction = "ltr"
    g.textAlign = "left"
    g.textBaseline = "alphabetic"
    g.fillStyle = "#7fd0d0"
    fitFont(g, kicker.toUpperCase(), 500, FONT_MONO, 760, 26, 16)
    if ("letterSpacing" in g) g.letterSpacing = "3px"
    g.fillText(kicker.toUpperCase(), SCREEN.leftX + 108, 34 + 52)
    if ("letterSpacing" in g) g.letterSpacing = "0px"

    // page dots
    for (let k = 0; k < n; k++) {
        g.beginPath()
        g.arc(SCREEN.leftX + 10 + k * 30, H - 38, k === i ? 8 : 5, 0, Math.PI * 2)
        g.fillStyle = k === i ? "#7fd0d0" : "rgba(255,255,255,0.35)"
        g.fill()
    }
}

// ---- the slides ----

// Text on the left, QR code on the right.
function paintQrSlide({ title, sub, text, url, qr }) {
    return (g, i, n) => {
        const H = SCREEN.canvasH
        paintBase(g, "EAH Jena", i, n)
        setTextDirection(g)
        const x = zoneAnchor(SCREEN.leftX)

        g.fillStyle = "#ffffff"
        fitFont(g, title, 700, FONT_HEAD, SCREEN.zoneW, 96, 52)
        let y = 250
        g.fillText(title, x, y)

        if (sub) {
            g.fillStyle = "#7fd0d0"
            g.font = `600 44px ${FONT_HEAD}`
            y += 60
            g.fillText(sub, x, y)
        }

        g.fillStyle = "rgba(255,255,255,0.88)"
        g.font = `400 34px ${FONT_BODY}`
        paintParagraph(g, text, x, y + 62, SCREEN.zoneW, 46)

        if (url) {
            g.fillStyle = "#7fd0d0"
            fitFont(g, url, 500, FONT_MONO, SCREEN.zoneW, 26, 14)
            g.fillText(url, x, H - 70)
        }

        const tile = 440
        drawQrTile(g, SCREEN.rightX + (SCREEN.zoneW - tile) / 2, (H - tile) / 2 + 14, tile, qr)
    }
}

function paintFactsSlide(g, i, n) {
    paintBase(g, t('slideNumbersTitle'), i, n)
    setTextDirection(g)
    const number = (value, options) => new Intl.NumberFormat(currentLanguage || "de", options).format(value)

    function stat(zoneStart, baseline, valueText, label, startPx) {
        const x = zoneAnchor(zoneStart)
        g.fillStyle = "#7fd0d0"
        fitFont(g, valueText, 700, FONT_HEAD, SCREEN.zoneW, startPx, 60)
        g.fillText(valueText, x, baseline)
        g.fillStyle = "rgba(255,255,255,0.88)"
        g.font = `500 36px ${FONT_BODY}`
        g.fillText(label, x, baseline + 52)
    }

    stat(SCREEN.leftX, 290, number(1991, { useGrouping: false }), t('statFounded'), 130)
    stat(SCREEN.leftX, 480, "~" + number(50), t('statPrograms'), 130)
    stat(SCREEN.rightX, 380, "~" + number(4200), t('statStudents'), 150)
}

function paintAreasSlide(g, i, n) {
    paintBase(g, t('slideAreasTitle'), i, n)
    setTextDirection(g)

    function pill(zoneStart, y, text) {
        roundedRect(g, zoneStart, y, SCREEN.zoneW, 120, 24)
        g.fillStyle = "rgba(255,255,255,0.12)"
        g.fill()
        // accent bar on the side where reading starts
        roundedRect(g, isRtl() ? zoneStart + SCREEN.zoneW - 14 : zoneStart, y, 14, 120, 7)
        g.fillStyle = "#7fd0d0"
        g.fill()
        g.fillStyle = "#ffffff"
        fitFont(g, text, 700, FONT_HEAD, SCREEN.zoneW - 80, 50, 26)
        g.fillText(text, isRtl() ? zoneStart + SCREEN.zoneW - 40 : zoneStart + 40, y + 76)
    }

    pill(SCREEN.leftX, 190, t('areaTech'))
    pill(SCREEN.leftX, 340, t('areaBusiness'))
    pill(SCREEN.rightX, 190, t('areaSocial'))
    pill(SCREEN.rightX, 340, t('areaHealth'))
}

function paintApplySlide(g, i, n) {
    paintBase(g, "EAH Jena", i, n)
    setTextDirection(g)
    const x = zoneAnchor(SCREEN.leftX)

    g.fillStyle = "#ffffff"
    g.font = `700 60px ${FONT_HEAD}`
    let y = paintParagraph(g, t('slideApplyTitle'), x, 230, SCREEN.zoneW, 70)

    g.fillStyle = "rgba(255,255,255,0.88)"
    g.font = `400 31px ${FONT_BODY}`
    paintParagraph(g, t('applyText'), x, y + 22, SCREEN.zoneW, 42)

    // usual deadlines; the dates are formatted for the chosen language
    const date = (month) => new Intl.DateTimeFormat(currentLanguage || "de", { day: "numeric", month: "long" })
        .format(new Date(2000, month, 15))

    function card(y0, dateText, label) {
        roundedRect(g, SCREEN.rightX, y0, SCREEN.zoneW, 150, 26)
        g.fillStyle = "rgba(255,255,255,0.12)"
        g.fill()
        const ax = isRtl() ? SCREEN.rightX + SCREEN.zoneW - 36 : SCREEN.rightX + 36
        g.fillStyle = "#ffffff"
        fitFont(g, dateText, 700, FONT_HEAD, SCREEN.zoneW - 72, 66, 36)
        g.fillText(dateText, ax, y0 + 78)
        g.fillStyle = "#7fd0d0"
        g.font = `500 32px ${FONT_BODY}`
        g.fillText(label, ax, y0 + 122)
    }

    card(150, date(6), t('applyWinter'))
    card(320, date(1), t('applySummer'))

    g.fillStyle = "rgba(255,255,255,0.7)"
    g.font = `400 24px ${FONT_BODY}`
    paintParagraph(g, t('applyNote'), zoneAnchor(SCREEN.rightX), 520, SCREEN.zoneW, 32)
}

function paintAskSlide(g, i, n) {
    const H = SCREEN.canvasH
    paintBase(g, "EAH Jena", i, n)
    setTextDirection(g)
    const x = zoneAnchor(SCREEN.leftX)

    g.fillStyle = "#ffffff"
    g.font = `700 70px ${FONT_HEAD}`
    const y = paintParagraph(g, t('slideAskTitle'), x, 250, SCREEN.zoneW, 80)

    g.fillStyle = "rgba(255,255,255,0.88)"
    g.font = `400 34px ${FONT_BODY}`
    paintParagraph(g, t('askText'), x, y + 24, SCREEN.zoneW, 46)

    // a big question mark in a ring
    const cx = SCREEN.rightX + SCREEN.zoneW / 2
    const cy = H / 2 + 10
    g.beginPath()
    g.arc(cx, cy, 170, 0, Math.PI * 2)
    g.fillStyle = "rgba(255,255,255,0.1)"
    g.fill()
    g.lineWidth = 8
    g.strokeStyle = "#7fd0d0"
    g.stroke()
    g.fillStyle = "#ffffff"
    g.font = `700 230px ${FONT_HEAD}`
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.direction = "ltr"
    g.fillText("?", cx, cy + 12)
}

// ---- building and showing ----

function rebuildScreenSlides() {
    const s = screenState
    if (!s.active) return

    const painters = []
    const shortUrl = (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "")

    if (SITE_QR.url) {
        painters.push(paintQrSlide({
            title: SITE_QR.title,
            sub: t('siteLabel'),
            text: t('siteText'),
            url: shortUrl(SITE_QR.url),
            qr: (g, x, y, size) => drawQrMatrix(g, SITE_QR.url, x, y, size)
        }))
    }
    if (APP_QR.url) {
        painters.push(paintQrSlide({
            title: APP_QR.title,
            sub: "",
            text: t('appText'),
            url: shortUrl(APP_QR.url),
            qr: (g, x, y, size) => drawQrMatrix(g, APP_QR.url, x, y, size)
        }))
    }
    painters.push(paintFactsSlide, paintAreasSlide, paintApplySlide, paintAskSlide)

    s.slides = painters.map((paint, i) => {
        const canvas = document.createElement("canvas")
        canvas.width = SCREEN.canvasW
        canvas.height = SCREEN.canvasH
        paint(canvas.getContext("2d"), i, painters.length)
        return canvas
    })
    if (s.index >= s.slides.length) s.index = 0
    s.fade = null
    composeScreen(null)
}

function easeInOut(p) {
    return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
}

// Puts the current slide (or a cross-fade between two) on the visible canvas.
function composeScreen(fade) {
    const s = screenState
    if (!s.ctx || !s.slides.length) return
    s.ctx.globalAlpha = 1
    if (!fade) {
        s.ctx.drawImage(s.slides[s.index], 0, 0)
    } else {
        const p = easeInOut(fade.progress)
        s.ctx.drawImage(s.slides[fade.from], 0, 0)
        s.ctx.globalAlpha = p
        s.ctx.drawImage(s.slides[fade.to], (1 - p) * 60, 0) // slides in slightly from the side while fading in
        s.ctx.globalAlpha = 1
    }
    s.texture.needsUpdate = true
}

function addScreen() {
    const canvas = document.createElement("canvas")
    canvas.width = SCREEN.canvasW
    canvas.height = SCREEN.canvasH
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#00302f"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4

    const z = ROOM.back
    const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(SCREEN.w + 1.0, SCREEN.h + 1.0),
        new THREE.MeshBasicMaterial({
            map: createSoftDotTexture(),
            color: 0x7fd0d0,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    )
    glow.position.set(0, SCREEN.y, z + 0.004)

    const bezel = new THREE.Mesh(
        new THREE.PlaneGeometry(SCREEN.w + 0.14, SCREEN.h + 0.14),
        new THREE.MeshBasicMaterial({ color: 0x06191a })
    )
    bezel.position.set(0, SCREEN.y, z + 0.01)

    const face = new THREE.Mesh(
        new THREE.PlaneGeometry(SCREEN.w, SCREEN.h),
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    )
    face.position.set(0, SCREEN.y, z + 0.02)

    const group = new THREE.Group()
    group.add(glow, bezel, face)
    group.visible = false // appears once a language is chosen
    scene.add(group)

    screenState.group = group
    screenState.ctx = ctx
    screenState.texture = texture
}

addScreen()

function startScreen() {
    if (screenState.active) return
    screenState.active = true
    screenState.shownAt = clock.getElapsedTime()
    screenState.group.visible = true
    rebuildScreenSlides()

    // Web fonts load asynchronously; repaint once they are ready so the text uses them.
    if (document.fonts && document.fonts.load) {
        Promise.all([
            document.fonts.load('700 40px "Space Grotesk"'),
            document.fonts.load('400 24px "Inter"'),
            document.fonts.load('500 20px "JetBrains Mono"')
        ]).then(() => rebuildScreenSlides()).catch(() => {})
    }
}

// Small or portrait windows get link chips instead (the screen would be too small to read).
const compactQuery = window.matchMedia("(max-width: 900px), (max-aspect-ratio: 6/5)")
let screenWanted = false

function requestScreen() {
    screenWanted = true
    if (!compactQuery.matches) startScreen()
}
compactQuery.addEventListener("change", () => {
    if (screenWanted && !compactQuery.matches) startScreen()
})

function updateScreen(elapsed) {
    const s = screenState
    if (!s.active || s.slides.length < 2) return

    if (s.fade) {
        const p = (elapsed - s.fade.start) / SCREEN.fadeSeconds
        if (p >= 1) {
            s.index = s.fade.to
            s.fade = null
            s.shownAt = elapsed
            composeScreen(null)
        } else {
            s.fade.progress = Math.max(0, p)
            composeScreen(s.fade)
        }
        return
    }

    if (elapsed - s.shownAt >= SCREEN.slideSeconds) {
        const to = (s.index + 1) % s.slides.length
        if (REDUCED_MOTION) {
            s.index = to
            s.shownAt = elapsed
            composeScreen(null)
        } else {
            s.fade = { from: s.index, to, start: elapsed, progress: 0 }
        }
    }
}


// Soft floating light dots behind and around the avatar.
function createSoftDotTexture() {
    const c = document.createElement("canvas")
    c.width = c.height = 64
    const g = c.getContext("2d")
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, "rgba(255,255,255,1)")
    grad.addColorStop(0.4, "rgba(255,255,255,0.35)")
    grad.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
}

const particleCount = REDUCED_MOTION ? 0 : FX.particleCount
const particleSeeds = []
let particles = null

if (particleCount > 0) {
    const positions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() * 2 - 1) * FX.particleSpread[0]
        positions[i * 3 + 1] = Math.random() * FX.particleSpread[1] + 0.1
        positions[i * 3 + 2] = (Math.random() * 2 - 1) * FX.particleSpread[2] - 0.5
        particleSeeds.push(Math.random() * Math.PI * 2)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    particles = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
            size: 0.07,
            map: createSoftDotTexture(),
            color: 0xcffafa,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    )
    scene.add(particles)
}

function updateAtmosphere(delta, elapsed) {
    if (REDUCED_MOTION) return

    if (particles) {
        const pos = particles.geometry.attributes.position
        for (let i = 0; i < particleCount; i++) {
            let y = pos.getY(i) + FX.particleSpeed * delta * (0.5 + (i % 5) * 0.25)
            if (y > FX.particleSpread[1] + 0.3) y = 0.1
            pos.setY(i, y)
            pos.setX(i, pos.getX(i) + Math.sin(elapsed * 0.4 + particleSeeds[i]) * 0.0006)
        }
        pos.needsUpdate = true
    }

    ring.material.opacity = 0.28 + Math.sin(elapsed * 1.2) * 0.08
    ring.scale.setScalar(1 + Math.sin(elapsed * 0.8) * 0.015)
    directionalLight.position.x = 1 + Math.sin(elapsed * 0.35) * FX.lightSwayAmount
}


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

// Compact link chips for small or portrait screens, where the big screen on
// the wall is too small to read. The CSS shows them only there. The Ernst
// App chip is hidden if APP_QR.url is empty.
function buildQrChips() {
    const panel = document.createElement("div")
    panel.id = "qr-panels"

    function chip(title, url) {
        const link = document.createElement("a")
        link.className = "qr-chip"
        link.href = url
        link.target = "_blank"
        link.rel = "noopener noreferrer"
        link.textContent = title
        return link
    }

    if (APP_QR.url) panel.appendChild(chip(APP_QR.title, APP_QR.url))
    if (SITE_QR.url) panel.appendChild(chip(`${SITE_QR.title} · ${t('siteLabel')}`, SITE_QR.url))

    if (panel.children.length) document.body.appendChild(panel)
}

// Start flow in three steps, one screen each:
//   1. welcome   – animated greeting that cycles through all languages
//   2. language  – one button per language
//   3. avatar    – choose Elena or Mika, shown in the chosen language
// Elements of the active step rise in one after another (--i drives the
// CSS delay). Choosing an avatar fades the overlay out while the loading
// screen takes over.
function buildCharacterSelectUI(onSelect) {
    const overlay = document.createElement("div")
    overlay.id = "character-select-overlay"

    const steps = {}
    function makeStep(name) {
        const el = document.createElement("section")
        el.className = "step"
        steps[name] = el
        overlay.appendChild(el)
        return el
    }
    // Adds an element to a step with its position in the entrance order.
    function put(step, el, order) {
        el.classList.add("stagger")
        el.style.setProperty("--i", String(order))
        step.appendChild(el)
        return el
    }
    function div(className, text) {
        const el = document.createElement("div")
        el.className = className
        if (text !== undefined) el.textContent = text
        return el
    }
    function backButton(label, onClick) {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "step-back"
        btn.setAttribute("aria-label", label)
        btn.textContent = "←"
        btn.addEventListener("click", onClick)
        return btn
    }

    let welcomeTimer = null
    function stopWelcome() {
        if (welcomeTimer) clearInterval(welcomeTimer)
        welcomeTimer = null
    }
    function goStep(name) {
        Object.entries(steps).forEach(([key, el]) => el.classList.toggle("active", key === name))
        if (name !== "welcome") stopWelcome()
    }

    // ---- step 1: welcome ----
    const welcome = makeStep("welcome")

    const logoWrap = div("welcome-logo")
    const logo = document.createElement("img")
    logo.src = eahLogoUrl
    logo.alt = "EAH Jena"
    logoWrap.appendChild(logo)
    put(welcome, logoWrap, 0)

    const wordWrap = div("welcome-word-wrap")
    wordWrap.setAttribute("aria-label", "Welcome")
    put(welcome, wordWrap, 1)

    put(welcome, div("start-title", "Ernst-Abbe-Hochschule Jena"), 2)
    put(welcome, div("start-sub", "Virtual Campus Assistant"), 3)

    const startWrap = div("start-btn-wrap")
    const startBtn = document.createElement("button")
    startBtn.type = "button"
    startBtn.className = "start-btn"
    startBtn.textContent = "Start  →"
    startBtn.addEventListener("click", () => goStep("language"))
    startWrap.appendChild(startBtn)
    put(welcome, startWrap, 4)

    // The welcome word changes language every few seconds.
    let wordIndex = 0
    function showWord(index) {
        const lang = LANGUAGES[index]
        wordWrap.querySelectorAll(".welcome-word").forEach((old) => {
            old.classList.add("out")
            setTimeout(() => old.remove(), 600)
        })
        const span = document.createElement("span")
        span.className = "welcome-word"
        span.lang = lang.code
        span.setAttribute("aria-hidden", "true")
        span.textContent = I18N[lang.code].welcome
        wordWrap.appendChild(span)
    }
    showWord(0)
    if (!REDUCED_MOTION) {
        welcomeTimer = setInterval(() => {
            wordIndex = (wordIndex + 1) % LANGUAGES.length
            showWord(wordIndex)
        }, FX.welcomeWordIntervalMs)
    }

    // ---- step 2: language ----
    const languageStep = makeStep("language")
    put(languageStep, backButton("Back", () => goStep("welcome")), 0)
    put(languageStep, div("step-title", "Choose your language"), 1)

    const languageGrid = div("language-grid")
    put(languageStep, languageGrid, 2)

    // ---- step 3: avatar ----
    const avatarStep = makeStep("avatar")
    const avatarBack = backButton("Back", () => goStep("language"))
    put(avatarStep, avatarBack, 0)
    const avatarHeading = put(avatarStep, div("step-title", ""), 1)
    const avatarGrid = div("character-select-grid")
    put(avatarStep, avatarGrid, 2)

    function chooseLanguage(code) {
        const lang = LANGUAGES.find(l => l.code === code)
        currentLanguage = code
        document.documentElement.lang = code
        document.documentElement.dir = lang.rtl ? "rtl" : "ltr"
        avatarHeading.textContent = t('heading')
        avatarBack.setAttribute("aria-label", t('back'))
        languageGrid.querySelectorAll(".language-btn").forEach((b) => {
            b.classList.toggle("selected", b.dataset.code === code)
        })
        goStep("avatar")
    }

    LANGUAGES.forEach((lang, i) => {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "language-btn stagger"
        btn.style.setProperty("--i", String(i))
        btn.dataset.code = lang.code

        const nativeName = document.createElement("span")
        nativeName.className = "language-native"
        nativeName.lang = lang.code
        nativeName.textContent = lang.native

        const code = document.createElement("span")
        code.className = "language-code"
        code.textContent = lang.code

        btn.appendChild(nativeName)
        btn.appendChild(code)
        btn.addEventListener("click", () => chooseLanguage(lang.code))
        languageGrid.appendChild(btn)
    })

    AVATAR_CHARACTERS.forEach((character, i) => {
        const card = document.createElement("button")
        card.type = "button"
        card.className = "character-card stagger"
        card.style.setProperty("--i", String(i))

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
            card.classList.add("selected")
            overlay.classList.add("leaving")
            setTimeout(() => overlay.remove(), 650)
            onSelect(character, currentLanguage)
        })
        avatarGrid.appendChild(card)
    })

    document.body.appendChild(overlay)
    goStep("welcome")
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

// The visitor may only turn the view a little and zoom within a small
// range, so the camera always stays inside the room in front of the avatar.
controls.enablePan = false
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.rotateSpeed = CAMERA_LIMITS.rotateSpeed
controls.minDistance = CAMERA_LIMITS.minDistance
controls.maxDistance = CAMERA_LIMITS.maxDistance
controls.minAzimuthAngle = CAMERA_LIMITS.minAzimuth
controls.maxAzimuthAngle = CAMERA_LIMITS.maxAzimuth
controls.minPolarAngle = CAMERA_LIMITS.minPolar
controls.maxPolarAngle = CAMERA_LIMITS.maxPolar
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
            startIntro()
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
            startIntro()
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
    buildQrChips()
    requestScreen()
    loadAvatar(character)
    startIdleWatch()
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

// The "speaking" class on <body> drives the equalizer bars in the chat UI.
function startLipSync() {
    isSpeaking = true
    document.body.classList.add("speaking")
}
function stopLipSync() {
    isSpeaking = false
    externalJawTarget = null
    document.body.classList.remove("speaking")
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
    const prefix = currentLanguage || 'de'
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

// ---- One voice at a time ----
//
// Every call to speak() or stopSpeaking() starts a new "turn" (speechToken).
// Whatever is still running from an older turn — a pending voice request,
// audio that is playing, the browser voice, the lip-sync — is stopped, and
// late callbacks of an older turn check the token and do nothing. That is
// what prevents two voices from overlapping.

let speechToken = 0
let currentAudio = null
let currentStopDriving = null
let ttsAbort = null

// "busy" (on <body>) shows the stop button while she waits for an answer or talks.
function setBusy(on) {
    document.body.classList.toggle("busy", on)
}

function stopSpeaking() {
    speechToken++
    if (ttsAbort) { ttsAbort.abort(); ttsAbort = null }
    if (currentAudio) { currentAudio.pause(); currentAudio = null }
    if (currentStopDriving) { currentStopDriving(); currentStopDriving = null }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
    stopLipSync()
    setSubtitle("")
}

// Pending chat request, so a newer question (or stop) can cancel it.
let chatAbort = null
let questionId = 0

function cancelPendingQuestion() {
    questionId++
    if (chatAbort) { chatAbort.abort(); chatAbort = null }
}

// The stop button and the Esc key: silence her right now and drop any
// answer that has not arrived yet.
function stopEverything() {
    cancelPendingQuestion()
    stopSpeaking()
    setBusy(false)
}

async function speakWithElevenLabs(text, token) {
    ttsAbort = new AbortController()
    const res = await fetch(TTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text,
            voice: currentAvatarVoice,
            language: currentLanguage
        }),
        signal: ttsAbort.signal
    })
    if (!res.ok) throw new Error("TTS backend returned " + res.status)
    const { audio_base64, alignment } = await res.json()

    // A newer turn took over while we were waiting for the audio.
    if (token !== speechToken) return

    const audio = new Audio(`data:audio/mpeg;base64,${audio_base64}`)
    currentAudio = audio

    return new Promise((resolve, reject) => {
        let stopDriving = null
        let finished = false

        // Runs when the audio ended or was paused (stopSpeaking() pauses it).
        const finish = () => {
            if (finished) return
            finished = true
            if (stopDriving) stopDriving()
            if (token === speechToken) {
                currentAudio = null
                currentStopDriving = null
                stopLipSync()
                setSubtitle("")
                setBusy(false)
            }
            resolve()
        }

        audio.addEventListener("play", () => {
            if (token !== speechToken) return
            startLipSync()
            stopDriving = driveLipSyncFromAlignment(audio, alignment)
            currentStopDriving = stopDriving
        })
        audio.addEventListener("ended", finish)
        audio.addEventListener("pause", finish)
        audio.addEventListener("error", (e) => {
            if (finished) return
            finished = true
            if (stopDriving) stopDriving()
            if (token === speechToken) {
                currentAudio = null
                stopLipSync()
            }
            reject(e)
        })

        audio.play().catch(reject)
    })
}

function speakWithBrowserTTS(text, token) {
    const speech = new SpeechSynthesisUtterance(text)
    speech.lang = t('speechLang')

    const voice = pickVoice()
    if (voice) speech.voice = voice

    const done = () => {
        if (token !== speechToken) return // an older voice ending must not touch the new one
        stopLipSync()
        setSubtitle("")
        setBusy(false)
    }

    speech.onstart = () => { if (token === speechToken) startLipSync() }
    speech.onend = done
    speech.onerror = done

    window.speechSynthesis.speak(speech)
}

async function speak(text) {
    stopSpeaking() // never two voices at once
    const token = ++speechToken
    setBusy(true)
    setSubtitle(text)

    try {
        await speakWithElevenLabs(text, token)
    } catch (err) {
        // Stopped on purpose (new question, stop button): stay silent.
        if (token !== speechToken || err.name === "AbortError") return
        console.warn("ElevenLabs TTS unavailable, falling back to browser speech synthesis:", err)
        speakWithBrowserTTS(text, token)
    }
}


// ======================
// Idle reset (kiosk mode)
// ======================
//
// Any pointer, key, touch or wheel input counts as activity, and so does
// the avatar speaking. When the visitor goes quiet, a "still there?"
// warning appears; if nobody reacts, the page reloads and shows the start
// screen again (which also clears the conversation).

let lastActivity = Date.now()
let idleOverlayEl = null
let idleSecondsEl = null

function markActivity() {
    lastActivity = Date.now()
    hideIdleWarning()
}

function showIdleWarning(secondsLeft) {
    if (!idleOverlayEl) {
        idleOverlayEl = document.createElement("div")
        idleOverlayEl.id = "idle-overlay"

        const card = document.createElement("div")
        card.className = "idle-card"

        const title = document.createElement("div")
        title.className = "idle-title"
        title.textContent = t('idleTitle')

        const text = document.createElement("div")
        text.className = "idle-text"
        idleSecondsEl = text

        const btn = document.createElement("button")
        btn.className = "idle-btn"
        btn.type = "button"
        btn.textContent = t('idleStay')
        btn.addEventListener("click", markActivity)

        card.appendChild(title)
        card.appendChild(text)
        card.appendChild(btn)
        idleOverlayEl.appendChild(card)
        document.body.appendChild(idleOverlayEl)
    }
    idleSecondsEl.textContent = t('idleText').replace('{s}', String(secondsLeft))
    idleOverlayEl.classList.add("visible")
}

function hideIdleWarning() {
    if (idleOverlayEl) idleOverlayEl.classList.remove("visible")
}

function startIdleWatch() {
    lastActivity = Date.now()

    ;["pointerdown", "keydown", "touchstart", "wheel"].forEach((evt) => {
        window.addEventListener(evt, markActivity, { passive: true })
    })

    setInterval(() => {
        // The avatar talking counts as activity, so long answers don't
        // trigger a reset in the middle of a sentence.
        if (isSpeaking) lastActivity = Date.now()

        const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity)
        if (remaining <= 0) {
            window.location.reload()
        } else if (remaining <= IDLE_WARNING_S * 1000) {
            showIdleWarning(Math.ceil(remaining / 1000))
        }
    }, 1000)
}


// ======================
// Chat UI
// ======================

// While waiting for an answer the bubble pulses (thinking = true).
function setSubtitle(text, thinking = false) {
    const el = document.getElementById("avatar-subtitle")
    if (!el) return
    el.classList.toggle("thinking", thinking && !!text)
    if (text) {
        el.textContent = text
        el.classList.add("visible")
    } else {
        el.classList.remove("visible")
    }
}

// The visitor's last questions appear as small bubbles that fade away.
function showUserBubble(text) {
    const host = document.getElementById("bubbles")
    if (!host) return
    const bubble = document.createElement("div")
    bubble.className = "bubble user"
    bubble.textContent = text
    host.appendChild(bubble)
    while (host.children.length > 2) host.firstChild.remove()
    setTimeout(() => {
        bubble.classList.add("leaving")
        setTimeout(() => bubble.remove(), 500)
    }, FX.bubbleLifetimeMs)
}

function buildChatUI() {
    const container = document.createElement("div")
    container.id = "chat-ui"

    const bubbles = document.createElement("div")
    bubbles.id = "bubbles"
    bubbles.setAttribute("aria-hidden", "true")

    // Equalizer bars, visible only while the avatar speaks.
    const bars = document.createElement("div")
    bars.id = "speaking-bars"
    bars.setAttribute("aria-hidden", "true")
    for (let i = 0; i < 5; i++) bars.appendChild(document.createElement("span"))

    const subtitle = document.createElement("div")
    subtitle.id = "avatar-subtitle"
    subtitle.setAttribute("role", "status")
    subtitle.setAttribute("aria-live", "polite")

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

    // Stops her immediately (also on the Esc key); only visible while she
    // is thinking or talking.
    const stopBtn = document.createElement("button")
    stopBtn.id = "stop-btn"
    stopBtn.className = "chat-btn"
    stopBtn.type = "button"
    stopBtn.textContent = "■"
    stopBtn.title = `${t('stopTitle')} (Esc)`
    stopBtn.setAttribute("aria-label", t('stopTitle'))
    stopBtn.addEventListener("click", stopEverything)
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") stopEverything()
    })

    const sendBtn = document.createElement("button")
    sendBtn.id = "send-btn"
    sendBtn.className = "chat-btn"
    sendBtn.textContent = t('send')

    row.appendChild(input)
    row.appendChild(micBtn)
    row.appendChild(stopBtn)
    row.appendChild(sendBtn)

    // Tappable example questions, shown until the first question is asked.
    const suggestionsEl = document.createElement("div")
    suggestionsEl.id = "suggestions"
    t('suggestions').forEach((question, i) => {
        const chip = document.createElement("button")
        chip.className = "suggestion-chip"
        chip.type = "button"
        chip.style.setProperty("--i", String(i))
        chip.textContent = question
        chip.addEventListener("click", () => handleQuestion(question))
        suggestionsEl.appendChild(chip)
    })

    container.appendChild(bubbles)
    container.appendChild(bars)
    container.appendChild(subtitle)
    container.appendChild(suggestionsEl)
    container.appendChild(row)
    document.body.appendChild(container)

    // A new question always interrupts the current one: her voice stops at
    // once, an answer that is still on its way is dropped, and only the
    // newest question gets answered.
    async function handleQuestion(text) {
        if (!text || !text.trim()) return
        cancelPendingQuestion()
        stopSpeaking()
        const thisQuestion = questionId
        chatAbort = new AbortController()
        const signal = chatAbort.signal

        suggestionsEl.classList.add("hidden")
        markActivity()
        input.value = ""
        showUserBubble(text)
        setBusy(true)
        setSubtitle(t('thinking'), true)

        const answer = await getAnswer(text, signal)
        if (answer === null || thisQuestion !== questionId) return // replaced or stopped
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
            stopEverything() // so the microphone does not pick up her own voice
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

// Camera motion: a smooth move-in after the avatar loads, then a gentle
// parallax that follows the pointer (both skipped for reduced motion).
const INTRO_FROM = new THREE.Vector3(0, 1.6, 4.6)
const INTRO_TO = new THREE.Vector3(0, 1.4, 3)
let introStart = null

function startIntro() {
    if (REDUCED_MOTION) return
    introStart = clock.getElapsedTime()
    controls.maxDistance = Infinity // the intro starts a bit farther away than visitors may go
}

const pointer = { x: 0, y: 0 }
const parallax = { x: 0, y: 0 }
window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
}, { passive: true })

function updateCameraMotion(elapsed) {
    if (introStart !== null) {
        const p = Math.min((elapsed - introStart) / FX.introDuration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        camera.position.lerpVectors(INTRO_FROM, INTRO_TO, eased)
        controls.update()
        if (p >= 1) {
            introStart = null
            controls.maxDistance = CAMERA_LIMITS.maxDistance
        }
        return
    }

    if (!REDUCED_MOTION && currentAvatarRoot) {
        parallax.x += (pointer.x - parallax.x) * FX.parallaxEase
        parallax.y += (pointer.y - parallax.y) * FX.parallaxEase
        controls.target.x = parallax.x * FX.parallaxStrength
        controls.target.y = 1.2 + parallax.y * FX.parallaxStrength * 0.5
    }
    controls.update() // needed every frame because of the damping
}

function animate() {
    requestAnimationFrame(animate)
    const delta = clock.getDelta()
    const elapsed = clock.getElapsedTime()

    updateAtmosphere(delta, elapsed)
    updateScreen(elapsed)

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

    updateCameraMotion(elapsed)

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