# EAH Jena Virtueller Avatar-Assistent — Dokumentation

**Projekt:** KI-gestützter 3D-Avatar-Assistent für die Ernst-Abbe-Hochschule Jena (EAH Jena)
**Typ:** Webbasierter interaktiver Campus-Assistent
**Status:** Funktionsfähiger Prototyp

---

## 1. Überblick

Dieses Projekt ist ein browserbasierter virtueller Assistent, dargestellt durch einen realistischen 3D-Avatar. Besucher:innen können Fragen zur EAH Jena eintippen oder per Sprache stellen. Der Avatar antwortet mit synthetisierter Sprache, natürlichen Idle-Bewegungen, Lippensynchronisation und Blinzeln – vor einem Hintergrund im Teal-Farbton der Hochschule.

Der Avatar beantwortet Fragen über ein zweistufiges System: ein KI-Backend für offene Fragen, sowie ein kleines, fest hinterlegtes FAQ als Offline-Rückfallebene, falls das Backend nicht erreichbar ist.

---

## 2. Technologie-Stack

| Ebene | Technologie |
|---|---|
| 3D-Rendering | [Three.js](https://threejs.org/) (WebGL) |
| Build-Tool | Vite |
| Avatar-Modell | glTF Binary (`.glb`), realistisches Ganzkörper-Rig mit ARKit-ähnlichen Gesichts-Blendshapes |
| Avatar-Quelle | [MetaPerson Creator](https://metaperson.avatarsdk.com/) (Avatar SDK) — kostenloser Generator für realistische Avatare |
| Frontend-Sprache | Vanilla JavaScript (ES-Module) |
| Styling | Reines CSS mit Custom Properties (Design-Tokens) |
| Backend | Node.js + Express |
| KI / Chat | Google Gemini API (`gemini-3.6-flash`) |
| Text-zu-Sprache | Browser-`SpeechSynthesis`-API (aktiv); ElevenLabs Neural-TTS (implementiert, aktuell deaktiviert — siehe §7) |
| Spracheingabe | Web Speech API (`SpeechRecognition`) — nur Chrome/Edge |

---

## 3. Projektstruktur

```
ai-avatar/
├── public/
│   └── models/
│       └── avatar_3.glb          # das Avatar-Modell
├── src/
│   ├── assets/
│   │   └── EAH_Logo.png          # offizielles Hochschul-Logo
│   ├── main.js                   # gesamte Frontend-Logik (siehe §4)
│   └── style.css                 # gesamtes Styling / Design-Tokens
└── server/
    ├── server.js                 # Express-Backend (Chat- + TTS-Endpunkte)
    └── .env                      # API-Schlüssel — NIEMALS committen oder teilen
```

---

## 4. Frontend (`main.js`) — Funktionsübersicht

### 4.1 Szenenaufbau
Klassisches Three.js-Setup: perspektivische Kamera, `OrbitControls` für Maus-/Touch-Rotation, Directional- und Ambient-Licht sowie eine weiche, halbtransparente Bodenfläche, damit der Avatar wie stehend statt schwebend wirkt.

Der Hintergrund ist ein vertikaler Teal-Verlauf, gerendert auf eine Canvas-Textur — die Farbe wurde direkt aus dem EAH-Jena-Logo entnommen (`#009898`), statt eine generische Farbe zu verwenden.

### 4.2 Avatar-Laden
Das Modell wird über den einfachen `GLTFLoader` geladen (kein VRM-Plugin — es handelt sich um ein Standard-glTF-Humanoid, keine VRM-Datei). Beim Laden wird:
- Das Modell zur Szene hinzugefügt
- Kopf-, Wimpern- und Unterzahn-Meshes anhand ihres Namens gesucht (nötig für Gesichtsanimation)
- Eine manuell eingestellte Ruhepose angewendet (siehe §4.3) — glTF-Modelle laden standardmäßig in einer T-Pose ohne definierte "entspannte" Haltung

### 4.3 Ruhepose & Sway (Schwingen)
Die Ruhepose wurde durch iteratives Live-Tuning direkt am Skelett dieses spezifischen Modells gefunden (Knochennamen wie `LeftArm`, `RightForeArm`, `LeftHandIndex1` — typische Mixamo-/Ready-Player-Me-Namenskonvention). Der Avatar ruht mit **vor dem Körper gefalteten Händen** (eine japanisch anmutende Empfangshaltung), nicht mit herabhängenden Armen.

Ein leichtes, langsames Sinus-Schwingen liegt über der Ruhepose (Arme + Finger), damit der Avatar nicht eingefroren wirkt — bewusst mit kleiner Amplitude, wobei linker und rechter Arm **synchron in Phase** schwingen (nicht gegenläufig), damit die gefalteten Hände nicht sichtbar auseinanderdriften.

### 4.4 Begrüßungsgeste — die Verbeugung
Nach dem Laden führt der Avatar nach kurzer Pause eine höfliche Verbeugung aus: Die Wirbelsäule beugt sich nach vorn (~20°) mit einer sanften Auf-Halte-Ab-Bewegung und kehrt dann zur Ruhepose zurück. Die Hände bleiben dabei durchgehend gefaltet — nur der Oberkörper bewegt sich. Gleichzeitig wird der Begrüßungssatz gesprochen.

### 4.5 Gesichtsanimation
Das Modell verfügt über echte ARKit-ähnliche Blendshapes (`eyeBlinkLeft/Right`, `jawOpen`, `mouthSmileLeft/Right` usw.) auf den Kopf-, Wimpern- und Unterzahn-Meshes.
- **Blinzeln**: zufällig alle 2–6 Sekunden, gleichzeitig auf Kopf- und Wimpern-Mesh angewendet
- **Lippensynchronisation**: Während des Sprechens wird `jawOpen` entweder durch Echtzeit-Frequenzanalyse des Audios gesteuert (bei ElevenLabs Neural-TTS) oder durch ein geglättetes, synthetisches Sinusmuster (bei Browser-TTS) — mit einer moderaten Obergrenze, damit die Mundbewegung nicht übertrieben wirkt

### 4.6 Sprachausgabe
`speak(text)` nutzt aktuell die browsereigene `SpeechSynthesis`-API und bevorzugt eine englische weibliche Stimme, falls auf dem System verfügbar. Eine auskommentierte alternative Implementierung für ElevenLabs Neural-TTS mit echter audiogesteuerter Lippensynchronisation existiert bereits im Code (siehe §7).

### 4.7 Chat-Oberfläche
Eine schwebende, glasartige Eingabeleiste am unteren Bildschirmrand mit:
- Texteingabe + Senden-Button
- Mikrofon-Button (Spracheingabe über Web Speech API, nur Chrome/Edge — deaktiviert sich bei nicht unterstützten Browsern automatisch mit erklärendem Tooltip)
- Einer ein-/ausblendenden Sprechblase, die anzeigt, was der Avatar gerade sagt

### 4.8 Antwort-Pipeline
1. Die Frage der Nutzer:in wird an das Backend gesendet (`POST /api/chat`), zusammen mit den letzten Gesprächsrunden als Kontext
2. Antwortet das Backend erfolgreich, wird diese Antwort gesprochen
3. Ist das Backend nicht erreichbar (nicht gestartet, Netzwerkproblem etc.), greift das Frontend automatisch auf ein kleines, lokales stichwortbasiertes FAQ (`KNOWLEDGE_BASE`) zurück — mit Antworten zu Studiengängen, Bewerbung, Standort und Geschichte — damit die Demo auch offline nicht komplett ausfällt

---

## 5. Backend (`server.js`)

Ein minimaler Express-Server mit zwei Endpunkten:

| Endpunkt | Zweck |
|---|---|
| `GET /` | Health-Check — bestätigt, dass der Server läuft |
| `POST /api/chat` | Nimmt `{ question, history }` entgegen, sendet die Anfrage mit einem System-Prompt (verankert in EAH-Jena-Fakten) an Gemini, gibt `{ answer }` zurück |
| `POST /api/tts` | Nimmt `{ text }` entgegen, fordert Neural-Speech-Audio von ElevenLabs an, gibt einen MP3-Stream zurück (aktuell vom Frontend ungenutzt — siehe §7) |

**Warum überhaupt ein Backend?** API-Schlüssel dürfen niemals im Frontend-Code offengelegt werden — jede:r könnte sie über die Browser-Entwicklertools auslesen. Das Backend hält beide Schlüssel (Gemini und ElevenLabs) serverseitig und leitet Anfragen im Namen des Frontends weiter.

### System-Prompt
Der Gemini-System-Prompt verankert den Assistenten in einer kurzen Liste geprüfter EAH-Jena-Fakten (Gründungsjahr, Studierendenzahl, Campus-Standort, Anzahl Studiengänge, Bewerbungsfristen) und weist ihn ausdrücklich an, Unsicherheit zuzugeben statt Fakten zu erfinden — wichtig für einen hochschulbezogenen Assistenten, bei dem erfundene Angaben ein echtes Problem wären.

---

## 6. Umgebungsvariablen

Erforderlich in `server/.env` (niemals ins Versionskontrollsystem committen, niemals teilen, niemals irgendwo hochladen):

| Variable | Zweck |
|---|---|
| `GEMINI_API_KEY` | Google-Gemini-API-Schlüssel — [aistudio.google.com/apikey](https://aistudio.google.com/apikey), kostenlose Stufe verfügbar |
| `ELEVENLABS_API_KEY` | ElevenLabs-API-Schlüssel — nur nötig, falls/wenn Neural-TTS reaktiviert wird |
| `PORT` | Backend-Port (Standard: `3001`) |

> ⚠️ **Sicherheitshinweis:** Sollten diese Schlüssel versehentlich offengelegt werden (in ein öffentliches Repository committet, in einen Chat eingefügt usw.), müssen sie sofort über die jeweiligen Dashboards widerrufen und neu erstellt werden. `.env` sollte in `.gitignore` aufgenommen werden, bevor dieses Projekt mit einem Git-Repository verbunden wird.

---

## 7. Bekannte Einschränkungen & offene Punkte

- **Neural-TTS ist implementiert, aber deaktiviert.** Die ElevenLabs-Integration (`/api/tts` + echte audiogesteuerte Lippensynchronisation via Web-Audio-API-Frequenzanalyse) ist sowohl in `server.js` als auch als auskommentierter Block in `main.js` vollständig vorhanden, aktuell nutzt die aktive `speak()`-Funktion jedoch Browser-TTS. Die Reaktivierung erfordert lediglich den Wechsel der aktiven `speak()`-Funktion — der Code für beide Varianten existiert bereits.
- **Spracheingabe funktioniert nur in Chrome/Edge.** Firefox und Safari unterstützen die `SpeechRecognition`-Web-Speech-API nicht; der Mikrofon-Button deaktiviert sich dort automatisch.
- **Das FAQ-Fallback ist bewusst klein gehalten.** Es deckt nur die wahrscheinlichsten Standardfragen ab; alle anderen Fragen sollten über das laufende Gemini-Backend beantwortet werden.
- **Das Avatar-Modell ist ein kostenloses, generiertes Asset**, kein offizieller EAH-Jena-Markencharakter — relevant, falls das Projekt vom Prototyp zu einer offiziellen öffentlichen Anwendung weiterentwickelt wird (Lizenzfragen, ggf. Wunsch nach einem eigenen/markenkonformen Avatar).
- **Das Backend läuft aktuell nur auf `localhost`.** Vor einer öffentlichen Bereitstellung muss das Backend gehostet werden (z. B. kleiner VPS, Render, Railway) und die `CHAT_ENDPOINT`/`TTS_ENDPOINT`-URLs im Frontend entsprechend angepasst werden; zudem muss CORS für die echte Domain statt offenen Zugriffs konfiguriert werden.

---

## 8. Danksagung / Quellen

- **Avatar-Modell**: erstellt mit [MetaPerson Creator](https://metaperson.avatarsdk.com/) von Avatar SDK
- **Hochschul-Branding**: offizielles EAH-Jena-Logo und Farbidentität (`#009898`)
- **KI**: Google Gemini API
- **Sprache**: Browser Web Speech API / ElevenLabs (geplant)
