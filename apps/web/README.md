# 🌱 AgriSense Web

**Free, offline-friendly AI crop assistant that runs in any browser.** Detect
plant diseases from a photo or a live camera, chat with a voice agronomy
assistant, check a live agri-forecast, and estimate yield — with **no sign-up
and no API key required**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/agrisense-platform&root-directory=apps/web)

> Works **100% free**: keyless AI (via [Pollinations](https://pollinations.ai))
> plus an offline demo detector and optional on-device models. Paste your own
> free Gemini/Groq/OpenRouter key in **Settings** for higher accuracy and limits.

## ✨ Features

- **Disease detection** (`/detect`) — three-tier, auto-selected: your own
  in-browser TensorFlow.js model → cloud vision (keyless or your key) → an
  offline colour/texture heuristic that maps to your region's real disease list.
- **AI visual guide** (`/detect`) — generate disease illustrations from a
  photo-class prompt with the free keyless [Pollinations](https://pollinations.ai)
  image API, or describe any scene.
- **"Live View" scanner** — point your camera at a plant for real-time,
  on-device detection with a severity overlay. Runs fully offline with a model.
- **Voice assistant** (`/assistant`) — ask agronomy questions by voice or text
  and hear answers read aloud: HD neural voice (keyless) with an automatic
  fallback to the browser's built-in speech (Web Speech API).
- **Weather** (`/weather`) — live conditions + 7-day agri-forecast via
  Open-Meteo (no key, genuinely live).
- **Yield estimator** (`/yield`) — transparent agronomic range with a confidence
  band, risks and recommendations, factoring in live weather.
- **Your models** (`/models`) — upload a TF.js image classifier (`model.json` +
  weights + `labels.json`) or load one by URL; stored in IndexedDB, never uploaded.
- **Installable PWA** — add to home screen, works offline for the demo/model paths.
- **10 regions** — Bangladesh, Brazil, Ethiopia, Ghana, India, Kenya, Nigeria,
  Pakistan, Philippines, Tanzania — with localized crop/disease names, regional
  languages, and multi-language AI prompts.

## 🚀 Quickstart

```bash
git clone https://github.com/your-username/agrisense-platform
cd agrisense-platform/apps/web
npm install
npm run dev          # http://localhost:3000
```

That's it — the app is fully usable with no configuration. To build for
production:

```bash
npm run build && npm start
```

## ⚙️ Configuration (all optional)

Everything works with **zero** environment variables. Add keys only to unlock
higher-accuracy cloud AI. Copy `.env.example` to `.env.local`:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side [Google Gemini](https://aistudio.google.com/app/apikey) (vision + chat). |
| `GROQ_API_KEY` | Server-side [Groq](https://console.groq.com/keys) (fast text chat). |
| `OPENROUTER_API_KEY` | Server-side [OpenRouter](https://openrouter.ai/keys) (many free models). |
| `AGRISENSE_AI_PROVIDER` | Preferred provider when a server key is present. |
| `POLLINATIONS_TOKEN` | Optional — raises anonymous rate limits on the free keyless AI. |
| `NEXT_PUBLIC_DEFAULT_LAT` / `_LON` | Default forecast location before geolocation. |

Users can also paste **their own** key in the in-app Settings — it is stored
only in their browser (localStorage) and sent over HTTPS to this app's own API
routes, never logged or persisted server-side.

## ☁️ Deploy free, 24/7

The app is a single self-contained Next.js unit (frontend + API routes), so it
deploys anywhere. Pick one:

- **Vercel** (easiest) — import the repo and set **Root Directory** to
  `apps/web`. Or use the one-click button above. Generous free hobby tier.
- **Fly.io** — scale-to-zero machines (free-friendly):
  ```bash
  cd apps/web && fly launch --copy-config --now
  ```
- **Render** — New → Blueprint on this repo (uses [`render.yaml`](../../render.yaml));
  the free web service sleeps when idle and wakes on request.
- **Railway** — New Project → Deploy from repo; set root to `apps/web` (Dockerfile detected).
- **Oracle Cloud Always Free / any VPS** — run the Docker image 24/7:
  ```bash
  docker build -t agrisense ./apps/web
  docker run -d -p 80:3000 --restart unless-stopped agrisense
  ```

`GET /api/health` is a health-check endpoint for load balancers and uptime pings.

## 🧱 Architecture

```
app/
  page.tsx  detect/  assistant/  weather/  yield/  models/  settings/
  api/{detect,chat,advisory,yield,weather,regions,health}/route.ts   # backend
components/   # Nav, LiveDetect, ChatWindow, VoiceControls, ModelManager, charts…
lib/          # inference, providers, demo, speech, models, regions, yield, storage
data/         # regions.generated.json  (built from ../../regions/*.yaml)
public/       # manifest.webmanifest, sw.js, icon.svg  (PWA)
```

- **Detection pipeline** (`lib/inference.ts`) auto-selects on-device model →
  cloud vision → offline demo, and writes results to IndexedDB history.
- **AI providers** (`lib/providers.ts`) resolve credentials from request headers
  (BYO key) → server env → free keyless Pollinations, so AI is always available.
- **Region data** is generated from YAML — regenerate after editing
  `regions/*.yaml`:
  ```bash
  npm run gen:regions
  ```
  The generated `data/regions.generated.json` is committed so cloud builds need
  no YAML step.

## 🔒 Security posture

- **API routes are unauthenticated** by design — this is a self-host/demo tool.
  They apply **per-IP rate limiting** and **input-size caps** to limit abuse. If
  you expose it publicly at scale, put it behind your own auth/proxy.
- **BYO API keys** live only in the browser's `localStorage`, are sent to this
  app's own routes over HTTPS, forwarded to the chosen provider, and **never
  logged** or stored server-side.
- Uploaded models and scan history stay in the browser (IndexedDB) and are
  never uploaded to any server.

## 🌐 Browser support & graceful degradation

Everything degrades gracefully — nothing hard-fails:

| Capability | Needs | Without it |
| --- | --- | --- |
| Live View / camera | `getUserMedia` (Chromium, HTTPS, permission) | Use photo upload instead |
| Voice input | Web Speech `SpeechRecognition` (Chrome/Edge) | Type your question |
| Voice output (TTS) | `SpeechSynthesis` | Read the answer on screen |
| Cloud AI vision/chat | keyless Pollinations or a key + network | Offline demo detector/chat |
| Weather | network (Open-Meteo) | Cached last result (PWA) |

## 📜 Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Start the dev server on :3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (next) |
| `npm run test` | Vitest unit tests |
| `npm run gen:regions` | Rebuild `data/regions.generated.json` from YAML |

## ⚠️ Disclaimer

AgriSense is a decision-support tool, not a substitute for professional
agronomic advice. Always confirm chemical treatments and dosages with a local
agricultural extension officer.

## License

[MIT](../../LICENSE) © AgriSense contributors



