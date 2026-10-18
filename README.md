<img width="1150" height="1658" alt="ai-interview-simulator-live vercel app_ (1)" src="https://github.com/user-attachments/assets/372b82ad-b8c8-4ce3-b3a6-90c65365661f" />

<!-- 
  ----------------------
  1. Create a folder: docs/screenshots/
  2. Save your images there using the file names below (or change the paths).
  3. In each "IMAGE:" comment block, delete the opening comment line (starts with "<!" + "--")
     and the closing line (two dashes + ">") around the <img> tags to make them show.
  Until you do, nothing renders, so the README never shows broken images.

  Suggested captures (run in mock mode, 1280px wide; use the theme toggle for dark-mode shots):
    hero.gif            – 20–40s screen recording: setup → answer → feedback → report
    setup.png           – Setup screen
    recording.png       – Answering a question: live transcript, timer bar, live stats
    feedback.png        – Feedback panel + "The interviewer follows up" block
    report.png          – Final report
    history.png         – History screen with the score trend chart
    dark-mode.png       – Any screen in dark mode
    mobile.png          – Phone-width screenshot (390px)
    live-ai-demo.gif    – Short recording using the real Gemini key, for the "Live AI" section
-->

# AI Interview Simulator

**Practice the interview before the interview.** A voice-first mock interview app: answer AI-generated questions out loud, watch your answer get transcribed live, get scored feedback on every answer, handle follow-up questions, and track your progress across interviews.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-v5-FF4154?logo=reactquery&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3-3E67B1?logo=zod&logoColor=white)

<!-- LIVE DEMO: deploy (see "Deploying to Vercel"), replace the URL below, then delete the comment markers around it.
**[▶ Live demo](https://YOUR-DEMO-URL.vercel.app)** · runs in demo mode, so AI responses are simulated and no API key is needed.
-->

<!-- IMAGE: hero GIF (setup → answer → feedback → report)
<p align="center">
  <img src="docs/screenshots/hero.gif" alt="Answering a mock interview question and receiving feedback" width="900">
</p>
-->

---

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Deploying to Vercel](#deploying-to-vercel)
- [How it works](#how-it-works)
- [Technical highlights](#technical-highlights)
- [Project structure](#project-structure)
- [Privacy and security](#privacy-and-security)
- [Browser support](#browser-support)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Features

### Interview
- **AI-generated questions** tailored to role, level (junior → lead), interview type (behavioral, technical, system design, mixed), focus areas and an optional job description
- **Answer out loud**: microphone recording with a live level meter and **real-time transcription**
- **Edit before submitting**: fix anything the speech recogniser misheard, or type your answer instead
- **Questions read aloud** with text-to-speech, so it feels like a real interviewer
- **Time limits**: timer bar with a warning at 80% and "time's up" at 100%
- **Live speaking stats** while recording: word count, pace (words per minute) and filler words
- **Interviewer follow-ups**: after feedback, answer the follow-up the interviewer would ask next (optional)
- **End anytime**: get a report on what you've answered, save and come back later, or discard

### Feedback and reports
- **Per-answer scoring** (0–10) with a rubric: relevance, structure, depth and communication
- **What worked, what to improve, and what a strong answer covers** for every question
- **Final report**: overall score out of 100, readiness level, competency breakdown, pace and filler-word assessment, and a practice plan
- **Answer replay**: listen back to your recorded answers on the report
- **Progress comparison**: "▲ +7 vs your last Frontend Engineer interview"
- **Export**: download a readable Markdown report, print or save as PDF, or export the raw JSON data

### Progress and preferences
- **History**: every finished interview is saved in the browser, with a **score-over-time chart**, average and best scores, and a filter by role
- **Resume after refresh**: an unfinished interview is saved automatically and can be picked up later
- **Light, dark or auto theme**
- **Speech language**: English (US, India, UK or Australia) for more accurate transcripts
- **Remembers your setup**: last role, level and type are pre-filled

### Works offline in demo mode
Run the whole app **without any API key**. Mock mode simulates the AI locally, so every screen and feature can be explored for free.

---

## Screenshots
<img width="1150" height="1658" alt="ai-interview-simulator-live vercel app_ (1)" src="https://github.com/user-attachments/assets/372b82ad-b8c8-4ce3-b3a6-90c65365661f" />

<img width="1150" height="1056" alt="ai-interview-simulator-live vercel app_ (2)" src="https://github.com/user-attachments/assets/fcbf9b15-6ca2-47ac-b3d9-228f6c6b5c05" />

<img width="1150" height="1265" alt="ai-interview-simulator-live vercel app_ (3)" src="https://github.com/user-attachments/assets/93d440e6-e70a-4ba8-83af-61a9415db733" />

<img width="1150" height="1548" alt="ai-interview-simulator-live vercel app_ (4)" src="https://github.com/user-attachments/assets/8b14c2c8-814d-4422-a1ff-aed91ed50296" />

<img width="1150" height="1869" alt="ai-interview-simulator-live vercel app_" src="https://github.com/user-attachments/assets/b715fa60-9c8c-4059-ba5b-53f8dd6e7841" />

<img width="1150" height="1654" alt="ai-interview-simulator-live vercel app_ (5)" src="https://github.com/user-attachments/assets/e210a9b7-c9db-474e-ab11-d945df6d97e3" />

<img width="1150" height="1830" alt="ai-interview-simulator-live vercel app_ (6)" src="https://github.com/user-attachments/assets/693e3bf9-0fea-4258-85d4-e333d3739d17" />

<img width="1170" height="869" alt="ai-interview-simulator-live vercel app_ (7)" src="https://github.com/user-attachments/assets/14ad493a-1b12-4bcf-8aed-a0cc2057fd0a" />

<img width="1150" height="1658" alt="ai-interview-simulator-live vercel app_ (8)" src="https://github.com/user-attachments/assets/1fd79d7c-00bf-449f-985a-8aed4a79be1a" />


<!-- IMAGE: setup + recording, side by side
| Setup | Answering a question |
|---|---|
| <img src="docs/screenshots/setup.png" alt="Setup screen with role, level and interview type" width="440"> | <img src="docs/screenshots/recording.png" alt="Recording an answer with live transcript, timer and speaking stats" width="440"> |
-->

<!-- IMAGE: feedback + report, side by side
| Feedback and follow-up | Final report |
|---|---|
| <img src="docs/screenshots/feedback.png" alt="Scored feedback with rubric and an interviewer follow-up question" width="440"> | <img src="docs/screenshots/report.png" alt="Final report with overall score, competencies and practice plan" width="440"> |
-->

<!-- IMAGE: history + dark mode + mobile
| History and progress | Dark mode | Mobile |
|---|---|---|
| <img src="docs/screenshots/history.png" alt="History screen with score trend chart" width="360"> | <img src="docs/screenshots/dark-mode.png" alt="The app in dark mode" width="360"> | <img src="docs/screenshots/mobile.png" alt="The app at phone width" width="180"> |
-->

---

## Tech stack

| Area | Technology |
|---|---|
| UI | React 18, TypeScript, plain CSS with design tokens (no UI library) |
| Build | Vite 5 |
| Server state | TanStack React Query v5 (mutations with retry and backoff for transient errors) |
| Client state | `useReducer` + Context, `useSyncExternalStore` for the history store |
| Validation | Zod schemas **shared by client and server** |
| Browser APIs | Web Speech API (recognition and synthesis), MediaRecorder, Web Audio API, `localStorage`, `<dialog>` |
| Charts | Hand-built SVG (no chart library) |
| API proxy | Node.js + Express (keeps the AI key off the client) |
| AI | Google Gemini (free tier) or Anthropic Claude, chosen with one environment variable |

---

## Getting started

### Requirements
- Node.js 20.6 or newer (the API scripts use `--env-file`)
- Chrome or Edge for live transcription (other browsers can still record and type; see [Browser support](#browser-support))

### 1. Demo mode (no API key)

```bash
git clone https://github.com/YOUR-USERNAME/ai-interview-simulator.git
cd ai-interview-simulator
npm install
cp .env.example .env
npm run dev:web
```

Open **http://localhost:5173**. Questions and feedback are simulated locally.

### 2. Live AI mode (free Gemini key)

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/) → **Get API key**.
2. Edit `.env`:

   ```bash
   VITE_AI_MODE=live
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your-key-here
   # Comma-separated fallback chain; each model has its own free quota
   GEMINI_MODEL=gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite
   ```

3. Start the app and the API proxy together:

   ```bash
   npm run dev
   ```

The API terminal prints the active provider, e.g. `[api] AI provider: gemini (gemini-3.5-flash → …)`.

> **Using Anthropic Claude instead:** set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=...` in `.env`. Only `server/ai.ts` knows about providers.

### Free-tier usage
Each interview uses **questions + 2** AI requests (one to generate the questions, one per answer, one for the report), plus **1 per follow-up** you choose to answer. When one Gemini model hits its free quota, the server automatically moves to the next model in `GEMINI_MODEL`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Frontend + API proxy (live mode) |
| `npm run dev:web` | Frontend only (demo / mock mode) |
| `npm run dev:api` | API proxy only |
| `npm run build` | Type-check and build for production |
| `npm run typecheck` | Type-check only |
| `npm run preview` | Preview the production build |

<!-- IMAGE (optional): short recording with the real Gemini key, to show live AI feedback
### Live AI demo
<p align="center">
  <img src="docs/screenshots/live-ai-demo.gif" alt="A live interview scored by Gemini" width="800">
</p>
-->

---

## Deploying to Vercel

The repo is ready for Vercel as is (`vercel.json` is included). One codebase supports both modes:

| | Demo mode (default) | Live AI mode |
|---|---|---|
| What runs | Static frontend; AI is simulated in the browser | Frontend + the Express API as a Vercel function (`api/index.ts`) |
| API key | None | Stored in Vercel environment variables |
| Cost / quota | Free, unlimited | Uses your Gemini free-tier quota |
| Good for | A public portfolio demo | Private use, or a short live showcase |

### Demo mode (recommended for a public link)
1. Push the repo to GitHub.
2. In [Vercel](https://vercel.com/new) → **Add New Project** → import the repo → **Deploy**.

No environment variables are needed. `VITE_AI_MODE` defaults to `mock`, and the app shows a **"Demo mode"** badge.

### Switching to live AI
In Vercel → **Project → Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `VITE_AI_MODE` | `live` |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | your key |
| `GEMINI_MODEL` | `gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite` |

Then **Deployments → ⋯ → Redeploy**. `VITE_*` values are baked in at build time, so a redeploy is required. To go back to demo mode, set `VITE_AI_MODE=mock` (or delete it) and redeploy. The key can stay; it's never sent to the browser.

> ⚠️ **A public live deployment lets anyone use your quota.** The key stays secret, but every visitor's interview counts against it, and the rate limit (20 requests/minute per IP, per server instance) is a soft limit on serverless. For a public link, keep demo mode; to show the real AI, use the GIF in this README or switch to live briefly.

Local development is unchanged: `npm run dev` still runs `server/index.ts` with your `.env`.

---

## How it works

```
Browser                                              Server (server/)
───────────────────────────────────────────          ──────────────────────────────
Web Speech API ─▶ live transcript ┐
MediaRecorder  ─▶ audio (stays in browser)           POST /api/interview/questions
AnalyserNode   ─▶ level meter     │                  POST /api/interview/evaluate
                                  ▼                  POST /api/interview/report
useReducer (session)  ◀── React Query ──▶  Zod validate ▶ Gemini / Claude ▶ Zod validate
localStorage (resume, history)                       rate limit · CORS · timeouts
```

**Flow:** Setup → questions generated → for each question: read aloud → record and transcribe (or type) → review and edit → AI feedback → optional follow-up → next → final report → saved to History.

---

## Technical highlights

Decisions worth calling out:

- **One API contract, two sides.** `shared/schemas.ts` holds Zod schemas used by both the browser and the server. The AI's output is validated before it reaches the UI, and saved data is validated when read back, so stale or hand-edited `localStorage` can't crash the app.
- **Server state and session state are kept apart.** React Query owns every AI call (retries only for timeouts, 429s and 5xx errors, with backoff). A reducer owns the interview flow and only receives results once a request succeeds.
- **Reusable answer component.** `AnswerBooth` handles record → transcribe → review → submit, and is used for both main questions and follow-ups. Keying it per attempt guarantees the microphone, audio context and object URLs are released.
- **Follow-ups without backend changes.** The follow-up is turned into a full `Question` in the browser, validated with the shared schema, and scored by the existing `/evaluate` route. In the final report it's combined with its parent question (25% weight) to stay within the API's 10-item limit.
- **Resilient persistence.** In-progress sessions auto-save (minus audio), so a refresh resumes where you left off. History is capped at 30 entries, upserted by id, and the app works even when storage is blocked.
- **Honest speaking metrics.** Pace and filler words come from what the speech recogniser actually heard, not from edited or pasted text, so a short recording followed by a pasted answer can't report "1780 wpm".
- **Live transcription that keeps going.** Chrome stops recognition after silence, even in continuous mode; the hook restarts it while the user is still answering.
- **Accessibility.** Focus moves to each new question and to "Next" after scoring; the chart works by keyboard; live regions announce feedback; there's a skip link; reduced-motion preferences are respected; dialogs use native `<dialog>`.
- **Hand-built SVG chart.** Drawn at the real pixel width so text stays readable on phones, with hover and keyboard tooltips. Chart colours were checked for contrast in both themes.
- **Prompt-injection hardening.** Candidate answers and job descriptions are wrapped in tags that the system prompt treats as data, never as instructions.

---

## Project structure

```
├── vercel.json               # Vercel build, /api rewrite, function timeout, security headers
├── api/
│   └── index.ts              # Vercel serverless entry: exports the Express app
├── shared/
│   └── schemas.ts            # Zod API contract shared by client and server
├── server/
│   ├── app.ts                # Express routes, validation, rate limiting, CORS, error handling
│   ├── index.ts              # Local dev entry: app.listen()
│   ├── ai.ts                 # Gemini / Claude providers, model fallback, JSON extraction and retry
│   └── prompts.ts            # Prompt builders (questions, evaluation, report)
└── src/
    ├── components/
    │   ├── SetupScreen.tsx     # Interview setup, presets, resume banner
    │   ├── InterviewScreen.tsx # Question flow, follow-ups, End-interview dialog
    │   ├── AnswerBooth.tsx     # Record → transcribe → review → submit (reused)
    │   ├── FeedbackPanel.tsx   # Per-answer score, rubric and feedback
    │   ├── ReportScreen.tsx    # Live report (with audio replay)
    │   ├── ReportView.tsx      # Report layout shared with History
    │   ├── HistoryScreen.tsx   # Past interviews, stats and filters
    │   └── ScoreTrend.tsx      # SVG score-over-time chart
    ├── hooks/                # Speech recognition, synthesis, audio recorder, API mutations
    ├── state/                # Session reducer, history store, preferences
    ├── lib/                  # AI service (live / mock), HTTP client, storage helpers
    └── utils/                # Speech metrics, follow-ups, report export
```

---

## Privacy and security

- **Your API key stays on the server.** The browser only talks to `/api`. Never put the key in a `VITE_*` variable, because those are bundled into the client JavaScript.
- **Audio stays in your browser.** Recordings are never uploaded or saved; only text is sent to the AI.
- **Heads-up on live transcription:** Chrome and Edge's speech recognition sends audio to the browser vendor's cloud service. Typing your answer avoids this.
- **History stays in your browser** (`localStorage`). Nothing is stored on a server.
- **Server protections:** request validation, a per-IP rate limit (20 requests/minute), a CORS allow-list, request timeouts, and generic error messages (upstream details are logged on the server only).

---

## Browser support

| Browser | Recording | Live transcription | Read aloud |
|---|---|---|---|
| Chrome / Edge (desktop) | ✅ | ✅ | ✅ |
| Safari | ✅ | ⚠️ partial | ✅ |
| Firefox | ✅ | ❌ type or edit your answer instead | ✅ |

---

## Known limitations

- History and saved sessions live in one browser. Clearing site data or switching device loses them.
- Recordings can be replayed only during the current session, not from History.
- AI scores can vary between runs; treat them as practice guidance, not a hiring decision.
- The free Gemini tier has daily limits. Demo mode has none.

---

## Roadmap

- [ ] Unit and component tests (Vitest + React Testing Library)
- [ ] ESLint + Prettier
- [ ] Code editor for technical questions (Monaco)
- [ ] Paste or upload a resume to tailor questions
- [ ] Keep recordings in IndexedDB so they replay from History
- [ ] Redo a single question and compare scores

---

## Author

<!-- Replace with your details -->
**YOUR NAME** · [LinkedIn](https://www.linkedin.com/in/YOUR-PROFILE) · [Portfolio](https://YOUR-PORTFOLIO-URL) · [GitHub](https://github.com/YOUR-USERNAME)

<!-- LICENSE: add a LICENSE file (MIT is common for portfolio projects) and uncomment the line below.
## License
MIT. See [LICENSE](LICENSE).
-->
