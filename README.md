# AgriSense: AI-Powered Crop Disease Detection & Yield Prediction Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

> **Empowering smallholder farmers, cooperatives, and agri-businesses with AI-driven crop disease detection (via smartphone camera) and yield prediction (via weather/satellite data).**

---

## ✅ Use it now — the working app is in [`apps/web`](apps/web)

The shipping product is a single, self-contained **Next.js 14 web app** you can
run in any browser and deploy free, 24/7. It needs **no sign-up and no API key**.

```bash
cd apps/web
npm install
npm run dev          # → http://localhost:3000
```

- **AI disease detection** from a photo — on-device model → cloud vision → offline demo.
- **"Live View"** real-time camera scanner.
- **Voice assistant** (speak or type; answers read aloud).
- **Live weather** (Open-Meteo, no key) and a transparent **yield estimator**.
- **Upload your own** TensorFlow.js model to diagnose fully offline.
- Installable **PWA**, dark/light themes, 10-language scaffolding.

AI is **free out of the box** via keyless [Pollinations](https://pollinations.ai)
plus an offline fallback; paste your own free Gemini/Groq/OpenRouter key in
Settings for more accuracy. Full docs, env vars and one-click deploy (Vercel,
Fly.io, Render, Railway, Oracle Cloud, Docker) are in the
**[web app README](apps/web/README.md)**.

> ℹ️ The `packages/*`, `apps/coop-dashboard` and `apps/farmer-app` folders below
> are **experimental scaffolding** for a larger multi-tenant vision and are not
> required to run the product. The rest of this document describes that vision.

---

## 🌟 Overview

AgriSense is a production-ready, multi-region, multi-tenant platform designed for agricultural stakeholders in emerging markets. It combines:

- **Edge-first disease detection** - Offline-capable TensorFlow Lite models running on-device
- **Cloud AI orchestration** - Free-tier API routing (Gemini, Groq, Hugging Face, Together.ai, OpenRouter)
- **Yield prediction** - Weather + satellite data integration with LLM-powered forecasting
- **Multi-language support** - 10+ languages for India, expandable to other regions
- **Open-source core** - MIT/Apache-2.0 licensed with managed service tier

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AgriSense Platform                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Farmer App   │  │ Coop Dash.   │  │   API Router         │  │
│  │ (React Native)│  │ (Next.js)    │  │   (FastAPI)          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           ▼                                     │
│              ┌──────────────────────────────┐                   │
│              │      Region Registry         │                   │
│              │   (YAML configs per region)  │                   │
│              └──────────────┬───────────────┘                   │
│                             ▼                                   │
│              ┌──────────────────────────────┐                   │
│              │    Provider Router           │                   │
│              │  (Gemini │ Groq │ HF │ etc)  │                   │
│              └──────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 Monorepo Structure

```
agrisense/
├── apps/
│   ├── farmer-app/          # React Native (Expo) mobile app
│   └── coop-dashboard/      # Next.js cooperative dashboard
├── packages/
│   ├── api-router/          # FastAPI backend service
│   ├── region-config/       # Region configuration schemas & loader
│   ├── shared-sdk/          # TypeScript SDK (API client + React hooks)
│   ├── edge-models/         # TFLite/CoreML model training pipeline
│   └── federated-learning/  # Federated model improvement
├── regions/
│   └── india.yaml           # Example region configuration
├── scripts/
│   └── validate-regions.ts  # Region config validator
└── docker-compose.yml       # Local development stack
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- API keys for at least one provider (Gemini, Groq, etc.)

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/agrisense.git
cd agrisense

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your API keys
```

### 2. Start Development Stack

```bash
# Start all services (API + Dashboard + Redis + Postgres)
docker-compose up -d

# Or run individually:
npm run dev:api      # API router on :8000
npm run dev:dashboard # Dashboard on :3000
npm run dev:mobile   # Expo mobile app
```

### 3. Validate Regions

```bash
npm run region:validate
```

### 4. Mobile Development

```bash
cd apps/farmer-app
npm install
npx expo start
# Scan QR with Expo Go app
```

## 🔧 Configuration

### Region Configuration

Each region is defined in a YAML file under `regions/`. See `regions/india.yaml` for a complete example with:

- **Crops & Diseases**: 6 crops, 21 diseases with local names in 10 languages
- **Weather Sources**: Open-Meteo, NASA POWER
- **Satellite Sources**: Sentinel-2, Landsat-8
- **AI Providers**: Gemini, Groq, HF, Together, OpenRouter with free-tier configs
- **Prompt Templates**: Multi-language prompts for each task type
- **Edge Model Config**: TFLite model URLs, confidence thresholds

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes* | Google Gemini API key |
| `GROQ_API_KEY` | Yes* | Groq API key |
| `HF_API_KEY` | Yes* | Hugging Face API key |
| `TOGETHER_API_KEY` | Yes* | Together.ai API key |
| `OPENROUTER_API_KEY` | Yes* | OpenRouter API key |
| `SENTINEL_HUB_API_KEY` | No | Sentinel Hub for satellite data |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |

*At least one provider key required

## 📱 API Endpoints

### Disease Detection
```
POST /v1/detect
Content-Type: multipart/form-data
- image: binary
- crop_id: string
- region_id: string
- location: {lat, lon} (optional)

Response: DiseaseResult
```

### Yield Prediction
```
POST /v1/predict-yield
Content-Type: application/json
{
  "field_id": "string",
  "crop_id": "string",
  "region_id": "string",
  "season": "string",
  "area_hectares": number,
  "planting_date": "YYYY-MM-DD",
  "location": { "lat": number, "lon": number },
  "irrigation": "rainfed|irrigated|partial"
}

Response: YieldPrediction
```

### Advisory
```
POST /v1/advisory
Content-Type: application/json
{
  "disease_id": "string",
  "crop_id": "string",
  "region_id": "string",
  "language": "en",
  "severity": "low|medium|high"
}

Response: Advisory
```

### Weather
```
GET /v1/weather?lat=28.6&lon=77.2&days=7

Response: WeatherData
```

## 🎯 Supported Regions

| Region | Code | Crops | Diseases | Languages |
|--------|------|-------|----------|-----------|
| India | `india` | 6 | 30 | 10 |
| Nigeria | `nigeria` | 5 | 35 | 4 |
| Brazil | `brazil` | 5 | 29 | 2 |
| Bangladesh | `bangladesh` | 4 | 25 | 2 |
| Kenya | `kenya` | 4 | 19 | 2 |
| Pakistan | `pakistan` | 5 | 12 | 4 |
| Ghana | `ghana` | 4 | 11 | 3 |
| Tanzania | `tanzania` | 5 | 11 | 2 |
| Philippines | `philippines` | 4 | 10 | 3 |
| Canada | `canada` | 4 | 9 | 2 |
| Ethiopia | `ethiopia` | 4 | 9 | 3 |
| Mexico | `mexico` | 4 | 8 | 2 |
| United States | `usa` | 3 | 8 | 2 |
| Argentina | `argentina` | 3 | 8 | 2 |
| Spain | `spain` | 4 | 8 | 2 |
| Australia | `australia` | 4 | 7 | 1 |
| France | `france` | 4 | 7 | 2 |
| Germany | `germany` | 4 | 7 | 2 |
| New Zealand | `new-zealand` | 4 | 5 | 2 |
| United Kingdom | `uk` | 4 | 5 | 1 |
| Ireland | `ireland` | 3 | 6 | 2 |

*Add new regions by creating YAML configs in `regions/`, then run `npm run gen:regions` in `apps/web`. The app UI itself is translated into 11 languages (English, Spanish, French, German, Portuguese, Hindi, Bengali, Urdu, Swahili, Filipino, Amharic) with all 26 region languages offered for chat answers, disease names and voice.*

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run specific package tests
npm run test:api
npm run test:region
```

## 📦 Building

```bash
# Build all packages
npm run build

# Build specific packages
npm run build:api
npm run build:dashboard
npm run build:mobile
```

## 🐳 Production Deployment

### Self-Hosted (Docker Compose)
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Managed Service (AWS/GCP/Azure)
- **Router**: Cloud Run / Cloud Functions / Container Apps (scale-to-zero)
- **Database**: Cloud SQL / RDS / Cosmos DB (PostgreSQL compatible)
- **Cache**: Redis (ElastiCache / Memorystore / Azure Cache)
- **CDN**: CloudFront / Cloud CDN / Azure CDN for edge models
- **Monitoring**: CloudWatch / Cloud Monitoring / Azure Monitor + Grafana Cloud
- **Secrets**: Secret Manager / Parameter Store / Key Vault

## 🤝 Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Follow conventional commits
4. Run tests: `npm run test`
5. Submit PR with description

### License
- **SDKs**: MIT License
- **Router/Server**: Apache-2.0 License

## 📚 Documentation

- [Architecture Spec](docs/superpowers/specs/2026-09-24-agrisense-design.md)
- [Region Config Schema](packages/region-config/src/schema.ts)
- [Provider Routing Logic](packages/api-router/src/adapters/index.ts)
- [Disease Detection Endpoint](packages/api-router/src/routes/disease.ts)
- [Yield Prediction Endpoint](packages/api-router/src/routes/yield.ts)
- [Farmer App Camera Flow](apps/farmer-app/app/(tabs)/index.tsx)
- [Coop Dashboard](apps/coop-dashboard/src/app/page.tsx)

## 🔗 Useful Resources

- [PlantVillage Dataset](https://github.com/spMohanty/PlantVillage-Dataset)
- [TensorFlow Lite Android](https://www.tensorflow.org/lite/guide/android)
- [CoreML iOS](https://developer.apple.com/documentation/coreml)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/api/js/)
- [Open-Meteo API](https://open-meteo.com/)
- [Sentinel Hub](https://www.sentinel-hub.com/)
- [Expo Updates](https://docs.expo.dev/eas-update/introduction/)
- [FastAPI](https://fastapi.tiangolo.com/)

---

Built with ❤️ for smallholder farmers worldwide