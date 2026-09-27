<div align="center">

<img src="apps/web/public/icon.svg" width="88" alt="AgriSense logo" />

# AgriSense

### The AI crop doctor that fits in a browser tab.

**Disease detection from a photo · Live camera scanning · Voice assistant in 26 languages · Weather & yield intelligence**

[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![License](https://img.shields.io/badge/License-MIT%2FApache--2.0-059669?style=for-the-badge)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-vitest%20passing-16A34A?style=for-the-badge&logo=vitest&logoColor=white)](apps/web)

</div>

---

> **Zero sign-up. Zero API keys. Zero cost to start.**
> Open the app, point your phone at a leaf, and get a diagnosis with a treatment plan — online or off.
> Designed for smallholder farmers, cooperatives, and agronomy teams in **21 countries**.

<div align="center">
<a href="#-quickstart"><img src="https://img.shields.io/badge/Get_started_in_60_seconds-059669?style=for-the-badge&logo=rocket&logoColor=white" alt="Quickstart" /></a>
<a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-username%2Fagrisense-platform&root-directory=apps/web"><img src="https://img.shields.io/badge/Deploy_to_Vercel_—_1_click-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Deploy to Vercel" /></a>
</div>

---

## ✨ What's inside

<table>
<tr><td width="50%">

### 🔬 Three-tier disease detection
On-device TensorFlow.js model → cloud vision AI (keyless or your key) → offline colour/texture heuristic. **It never fails silently** — every scan always produces a diagnosis with a confidence score, severity, symptoms, treatment and prevention plan.

</td><td width="50%">

### 📷 Live View scanner
Point your camera at a plant for **real-time, on-device detection** with a severity ring and scanline overlay. Fully client-side — no frames ever leave the phone.

</td></tr>
<tr><td width="50%">

### 🎙️ Voice assistant — speaks *your* language
Ask by voice or text; answers are read aloud in a **clear HD neural voice** (keyless) with automatic fallback to the browser's built-in speech. Chat answers, advisories and disease names localize to any of **26 languages**.

</td><td width="50%">

### 🖼️ AI visual guide
Generate photorealistic illustrations of any disease on any crop — or describe any scene — with the free, keyless image API. Regenerate until it matches what you see in the field.

</td></tr>
<tr><td width="50%">

### 🌦️ Weather & yield intelligence
Live conditions + 7-day agri forecast via **Open-Meteo** (no key, genuinely live), and a transparent yield estimator with a confidence band, risks and recommendations — sharpened by live weather.

</td><td width="50%">

### 🧠 Self-healing AI pool
Best-first **rotation across four independent models** on separate vendors. A failing model cools down automatically; the next one is already warm. A concurrency gate and response cache keep latency smooth when a crowd arrives.

</td></tr>
</table>

**Plus:** installable PWA with offline support · dark/light themes · your own TF.js models stay on your device · BYO API keys stored only in your browser.

---

## 🌍 Global coverage

| | Region | Code | Crops | Diseases | Languages |
|---|--------|------|:-----:|:--------:|:---------:|
| 🌏 | India | `india` | 6 | 30 | 10 |
| 🌍 | Nigeria | `nigeria` | 5 | 35 | 4 |
| 🌎 | Brazil | `brazil` | 5 | 29 | 2 |
| 🌏 | Bangladesh | `bangladesh` | 4 | 25 | 2 |
| 🌍 | Kenya | `kenya` | 4 | 19 | 2 |
| 🌏 | Pakistan | `pakistan` | 5 | 12 | 4 |
| 🌍 | Ghana | `ghana` | 4 | 11 | 3 |
| 🌍 | Tanzania | `tanzania` | 5 | 11 | 2 |
| 🌏 | Philippines | `philippines` | 4 | 10 | 3 |
| 🌎 | Canada | `canada` | 4 | 9 | 2 |
| 🌍 | Ethiopia | `ethiopia` | 4 | 9 | 3 |
| 🌎 | Mexico | `mexico` | 4 | 8 | 2 |
| 🌎 | United States | `usa` | 3 | 8 | 2 |
| 🌎 | Argentina | `argentina` | 3 | 8 | 2 |
| 🌍 | Spain | `spain` | 4 | 8 | 2 |
| 🌏 | Australia | `australia` | 4 | 7 | 1 |
| 🌍 | France | `france` | 4 | 7 | 2 |
| 🌍 | Germany | `germany` | 4 | 7 | 2 |
| 🌏 | New Zealand | `new-zealand` | 4 | 5 | 2 |
| 🌍 | United Kingdom | `uk` | 4 | 5 | 1 |
| 🌍 | Ireland | `ireland` | 3 | 6 | 2 |

**21 regions · 46 crops · 260+ diseases · 26 languages** — UI fully translated into 11 languages (English, Español, Français, Deutsch, Português, हिन्दी, বাংলা, اردو, Kiswahili, Filipino, አማርኛ) with automatic right-to-left layout for Urdu and Sindhi.

*Every region is a single YAML file in [`regions/`](regions/) — add yours and run `npm run gen:regions` inside `apps/web`.*

---

## 🚀 Quickstart

```bash
git clone https://github.com/your-username/agrisense-platform
cd agrisense-platform/apps/web
npm install
npm run dev
```

Open **http://localhost:3000** — that's the entire setup. No `.env`, no keys, no accounts.

> 💡 Want it on the public internet right now, from your own machine?
> ```bash
> cloudflared tunnel --url http://localhost:3000   # → free temporary public URL
> ```
> Or deploy it permanently (free tier) with the one-click Vercel button above — set **Root Directory** to `apps/web`.

**Production**

```bash
npm run build && npm start
```

**Quality gates**

```bash
npm run typecheck   # strict TypeScript, zero errors
npm run lint        # ESLint (next/core-web-vitals)
npm run test        # Vitest unit tests
npm run gen:regions # rebuild region data from regions/*.yaml
```

---

## ☁️ Deploy free, 24/7

| Platform | How | Cost |
|---|---|---|
| **Vercel** | One-click button above (Root Directory → `apps/web`) | Generous hobby tier |
| **Fly.io** | `cd apps/web && fly launch --copy-config --now` | Scale-to-zero |
| **Render** | New → Blueprint (uses [`render.yaml`](render.yaml)) | Free tier, sleeps when idle |
| **Railway** | Deploy from repo, root → `apps/web` (Dockerfile detected) | Trial credits |
| **Any VPS** | `docker build -t agrisense ./apps/web && docker run -d -p 80:3000 agrisense` | Your server |

`GET /api/health` is a ready-made health check for load balancers and uptime pings.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     AgriSense Web (Next.js 14)                 │
├────────────────────────────────────────────────────────────────┤
│  Frontend (React 18 · Tailwind · PWA)                          │
│  Dashboard · Detect · Live View · Assistant · Weather · Yield   │
├────────────────────────────────────────────────────────────────┤
│  API routes (Node runtime, per-IP rate limits, size caps)      │
│  /api/detect  /api/chat  /api/advisory  /api/yield  /api/weather│
├────────────────────────────────────────────────────────────────┤
│  AI Pool — best-first rotation · circuit breaker ·             │
│  concurrency gate · response cache                             │
│  ├─ openai (keyless, vision)      ← quality default            │
│  ├─ openai-fast (keyless, vision) ← fast fallback              │
│  ├─ gemini (keyless, vision)      ← independent vendor         │
│  ├─ mistral (keyless, text)       ← independent vendor         │
│  └─ BYO Gemini / Groq / OpenRouter key (stored in-browser only)│
├────────────────────────────────────────────────────────────────┤
│  In-browser ML — TensorFlow.js models (IndexedDB, offline)     │
│  Offline heuristic — colour/texture demo detector              │
├────────────────────────────────────────────────────────────────┤
│  Region engine — 21 YAML configs → regions.generated.json      │
│  Crops · diseases · treatments · languages · prompts · weather  │
└────────────────────────────────────────────────────────────────┘
```

## 📁 Monorepo layout

```
agrisense-platform/
├── apps/
│   ├── web/                 # ⭐ The shipping product — self-contained Next.js 14 app
│   ├── coop-dashboard/      # experimental scaffolding (not required)
│   └── farmer-app/          # experimental scaffolding (React Native/Expo)
├── packages/                # experimental scaffolding for a multi-tenant vision
│   ├── api-router/          # FastAPI provider router
│   ├── region-config/       # region schema + loader
│   ├── shared-sdk/          # TS SDK (client + hooks)
│   ├── edge-models/         # TFLite/CoreML training pipeline
│   └── federated-learning/
├── regions/                 # ⭐ One YAML per country — the agronomy brain
├── docs/                    # architecture specs
└── render.yaml · docker-compose.yml
```

> The monorepo scaffolding is intentionally *not* wired into the web app — `apps/web` installs and deploys standalone, so nothing experimental can break the product.

---

## ⚙️ Configuration (all optional)

Everything works with **zero** environment variables. Add keys only to unlock higher accuracy and limits:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-side Google Gemini (vision + chat) |
| `GROQ_API_KEY` | Server-side Groq (fast text chat) |
| `OPENROUTER_API_KEY` | Server-side OpenRouter (many free models) |
| `AGRISENSE_AI_PROVIDER` | Preferred provider when a server key is present |
| `POLLINATIONS_TOKEN` | Optional — raises rate limits on the keyless AI |
| `NEXT_PUBLIC_DEFAULT_LAT` / `_LON` | Default forecast location before geolocation |

Users can also paste **their own** key in Settings — it lives only in their browser's `localStorage` and is forwarded to the provider over HTTPS. It is never logged or stored server-side.

---

## 🔒 Security posture

- **Unauthenticated by design** — this is a self-host/demo tool. API routes apply per-IP rate limiting and input-size caps; put your own auth/proxy in front if you expose it at scale.
- **BYO keys** stay in the browser, travel only to this app's own API routes over HTTPS, and are never persisted server-side.
- **Your data stays yours** — uploaded models and scan history live in IndexedDB and are never uploaded to any server.

## ⚠️ Disclaimer

AgriSense is a **decision-support tool**, not a substitute for professional agronomic advice. Always confirm chemical treatments and dosages with a local agricultural extension officer.

---

## 🗺️ Vision

The web app is the shipping product today. The surrounding scaffolding sketches the next chapter — a **multi-tenant platform** with a FastAPI provider router, a regional cooperative dashboard, a React Native field app, federated model improvement, and trained edge models per region. See [docs/superpowers/specs](docs/superpowers/specs/).

## 🤝 Contributing

1. Fork → branch (`feat/amazing-thing`)
2. `npm run typecheck && npm run lint && npm run test` — keep it green
3. Conventional commits, small PRs
4. New region? Add a YAML in [`regions/`](regions/) following [`regions/kenya.yaml`](regions/kenya.yaml) as the template

## 📜 License

- **SDKs & app**: MIT
- **Server components**: Apache-2.0

---

<div align="center">

**Built with ❤️ for the people who feed the world.**

<sub>AgriSense · Free & open · works offline · no keys required</sub>

</div>
