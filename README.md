# GD Arena — Voice-First AI Group Discussion Practice Room

## What it does
**Problem Statement: Campus Placement Voice-First Group Discussion Practice Arena**
GD Arena enables students preparing for placement interviews to join a realistic, live spoken group discussion with dynamic AI participants and an authoritative moderator. The app orchestrates natural turn-taking, handles real-time voice interruptions and barge-in, enforces group discussion rules, and generates a quote-linked diagnostic report with actionable feedback and missed opening analysis.

---

## Done / Left / Plan
### What works now
- **Full Voice Loop & STT**: Web Speech API live caption streaming with interim results and configurable silence patience detector (800ms–3000ms).
- **Multi-Model AI Engine**: OpenRouter dual-model orchestration with automatic fallback (Primary: `google/gemini-2.0-flash-001`, Fallback: `meta-llama/llama-3.3-70b-instruct`, Direct Gemini fallback, and local deterministic resilience).
- **High-Energy Barge-In Detection**: Web Audio API RMS analyzer detecting speech during AI playback (>300ms sustained threshold), instantly halting playback and acknowledging student interjections.
- **Strict Single-Channel Audio Queue**: Sequential playback preventing overlapping speakers with persona-tailored pitch, rate, and browser voice mappings.
- **Distinct AI Personas**: Aarav (Dominator), Meera (Data Analyst), Rohan (Quiet Thinker), Priya (Tangent Drifter), Vikram (Devil's Advocate), and Moderator Ananya.
- **Rules Enforcement**: Max 2 consecutive AI turns without student, AI-to-AI peer referencing by name, silent nudges at 90s, time warning at T-90s, and closing round at T-0s.
- **Quote-Linked Evaluation**: Post-discussion placement report quoting exact spoken lines with timestamps, animated speaking airtime variation charts, and "What You Could Have Said" strategic openings.
- **Resilience Matrix**: Text-mode fallback for mic denial, non-Chrome browser detection, Supabase database integration with automatic local offline storage fallback.
- **Animations**: Framer Motion transitions and GSAP audio waveform visualizers.

### What is left for the next 16 hours
- Cross-browser WebRTC audio streaming proxy for mobile devices.
- Video facial presence avatar rendering using lightweight canvas shaders.
- Custom rubric scoring uploads by college placement cells.

### Plan to finish it
1. Run local table demonstrations with live microphone audio and simulate network drops to verify seamless local fallback.
2. Polish Hinglish colloquialisms for regional placement scenarios.
3. Package Docker container configuration for optional cloud deployment.

---

## Architecture and why
- **Frontend (React + Vite + Tailwind + Framer Motion + GSAP)**:
  - Built as a decoupled client for low-latency audio processing.
  - Client-side Zustand finite state machine owns the microphone stream, Web Audio API context, STT interim streams, and audio playback queue.
  - GSAP delivers responsive 60fps audio waveform visualizations and timing indicators without re-rendering overhead.
  - Framer Motion handles fluid modal transitions, badge animations, and participant active states.
- **Backend (Node.js + Express + TypeScript)**:
  - Decoupled REST API acting as a stateless orchestrator and proxy.
  - Isolates API keys from the browser and handles resilient multi-model failover.
- **AI Models & OpenRouter Multi-Model Fallback**:
  - Primary Model: High-speed reasoning model (`google/gemini-2.0-flash-001` via OpenRouter) to meet the strict ≤3s latency budget.
  - Fallback Model: Large context instruction model (`meta-llama/llama-3.3-70b-instruct` via OpenRouter) for automatic failover during traffic spikes or rate limits.
  - Direct Gemini & Local Heuristic Fallbacks: Guarantee zero crashes during live judge evaluation even without internet access.
- **Data Store (Supabase + Local In-Memory Fallback)**:
  - Supabase PostgreSQL schema (`sessions`, `turns`, `reports`) for persistent analytics and historical tracking.
  - In-memory and local storage layer seamlessly activated when credentials are not configured or offline.

---

## What we added
- **GSAP Real-Time Audio Waveform Visualizers**: Dynamic audio bars rendered inside each participant's tile that react during their speaking turn.
- **"What You Could Have Said" Missed Openings Engine**: Pinpoints moments in the transcript where pauses occurred or arguments drifted, generating the exact sentence the student could have spoken to steer the discussion.
- **Hinglish Mode Toggle**: Realistic bilingual code-switching mode allowing participants to mix Hindi and English idioms, mirroring authentic Indian engineering campus placement discussions.
- **Interactive Transcript Jump-Links**: Clicking any feedback quote smoothly scrolls to and highlights the exact turn in the complete session transcript.

---

## How to run it
### Prerequisites
- Node.js (v18 or higher)
- Google Chrome (recommended for Web Speech API STT)

### 1. Clone & Setup Environment
```bash
# Clone the repository
git clone <repo-url>
cd C2C

# Copy environment variables
cp .env.example .env
```
Edit `.env` to provide your OpenRouter API key:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```
*(Note: If no API keys are provided, GD Arena automatically runs in local resilience mode without crashing!)*

### 2. Install Dependencies
```bash
# Install root, backend, and frontend packages
npm run install:all
```

### 3. Run Development Server
```bash
# Concurrently starts backend on :5000 and frontend on :5173
npm run dev
```
Open **`http://localhost:5173`** in Google Chrome.

---

## Tools and AI used
- **Frameworks & Libraries**: React, Vite, Node.js, Express, Zustand, Framer Motion, GSAP, TailwindCSS, Lucide React, Zod.
- **AI Models & Gateways**:
  - OpenRouter API (`google/gemini-2.0-flash-001` and `meta-llama/llama-3.3-70b-instruct`)
  - Google Gemini API (`gemini-2.5-flash` direct fallback)
- **Speech Technologies**: Browser Web Speech API (`webkitSpeechRecognition`), Web Audio API `AudioContext` & `AnalyserNode`, Browser SpeechSynthesis.
- **Database**: Supabase PostgreSQL + Local in-memory caching.
- **AI Disclosure**:
  1. Persistent warning banner displayed on the lobby screen.
  2. Persistent indicator chip displayed in the room header during the entire discussion.
  3. Moderator Ananya explicitly states the AI disclosure verbally in the opening line of every session.

---

## Who it is for
- **Engineering & MBA Students**: Students preparing for high-stakes on-campus placements who cannot easily assemble 6 peers and a faculty moderator for daily mock discussions.
- **Career & Placement Cells**: Institutions seeking an automated, objective evaluation benchmark that tracks candidate airtime, evidence usage, and interruption resilience.
- **Why users return**: Every discussion topic introduces fresh, unpredictable arguments from distinct personalities, and the quote-linked reports provide specific, measurable focus areas for progressive skill improvement.
