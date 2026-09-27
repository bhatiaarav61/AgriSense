# AgriSense Platform Design Specification

**Version:** 1.0.0  
**Date:** 2024-09-24  
**Status:** Draft

---

## 1. Executive Summary

AgriSense is a multi-region, multi-tenant platform providing AI-powered crop disease detection and yield prediction for smallholder farmers, cooperatives, and agri-businesses. The platform follows an **open-core model** with MIT/Apache-2.0 licensed core components and a managed service tier.

### Key Design Principles

1. **Offline-First Edge Inference** - TensorFlow Lite models run on-device for farmers with limited connectivity
2. **Free-Tier API Orchestration** - Intelligent routing across Gemini, Groq, Hugging Face, Together.ai, OpenRouter
3. **Federated Learning** - Global model improvement from regional edge data without raw data leaving devices
4. **Region-Aware Configuration** - YAML-based per-region configs for crops, diseases, languages, providers
5. **Multi-Language Support** - 10+ languages for India, extensible to other regions

---

## 2. System Architecture

### 2.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENTS                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │  Farmer Mobile   │  │  Coop Dashboard  │  │   Third-party APIs  │   │
│  │   (React Native) │  │    (Next.js)     │  │                     │   │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬──────────┘   │
└───────────┼─────────────────────┼───────────────────────┼──────────────┘
            │                     │                       │
            ▼                     ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY / ROUTER                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Router Service                        │   │
│  │  • Request routing & load balancing                             │   │
│  │  • Rate limiting & caching (Redis)                              │   │
│  │  • Authentication & authorization                               │   │
│  │  • Region configuration management                              │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
└───────────────────────────────┼────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ Free-Tier     │    │  Data Services  │    │  Core Services   │
│ AI Providers  │    │                 │    │                  │
│               │    │ • Weather API   │    │ • Region Registry│
│ • Gemini      │    │ • Satellite API │    │ • Provider Router│
│ • Groq        │    │ • Soil Data     │    │ • Cache Manager  │
│ • HuggingFace │    │ • Market Prices │    │ • Model Registry │
│ • Together.ai │    └─────────────────┘    └──────────────────┘
│ • OpenRouter  │
└───────────────┘
```

### 2.2 Data Flow

#### Disease Detection (Farmer Flow)
```
1. Farmer opens app → Camera captures crop image
2. Image preprocessed → Resized to 224x224, normalized
3. Edge inference (TFLite) → Local prediction <100ms
4. If confidence < threshold OR critical disease:
   a. Image uploaded to API (base64)
   b. Provider Router selects best free-tier provider
   c. Cloud inference with vision model (Gemini/Groq/HF)
   d. Results merged with edge prediction
5. DiseaseResult returned → Advisory fetched → Displayed to farmer
```

#### Yield Prediction (Coop/B2B Flow)
```
1. Coop admin enters field params (crop, location, season, area)
2. API fetches:
   a. Weather forecast (Open-Meteo, 7-30 days)
   b. Satellite indices (Sentinel-2 NDVI, EVI, LAI)
   c. Historical yield data for region/crop
3. Provider Router selects yield prediction model
4. LLM generates structured prediction with confidence
5. YieldPrediction returned → Dashboard visualization
```

---

## 3. Component Specifications

### 3.1 API Router (`packages/api-router`)

**Technology:** FastAPI (Python 3.11+)

**Endpoints:**
- `POST /v1/detect` - Disease detection from image
- `POST /v1/predict-yield` - Yield prediction for field
- `POST /v1/advisory` - Treatment advisory for disease
- `GET /v1/weather` - Weather + satellite data
- `GET /v1/crops/:regionId` - Supported crops
- `GET /v1/diseases/:regionId` - Diseases (filterable by crop)

**Key Features:**
- Provider routing with scoring (availability, latency, accuracy, cost)
- Automatic fallback on rate limits/errors
- Response caching with TTL per endpoint
- Request/response normalization across providers
- Structured logging with Pino

### 3.2 Region Configuration (`packages/region-config`)

**Schema:** Zod-validated TypeScript definitions

**Per-Region Config Includes:**
- Region metadata (ISO code, timezone, languages, currency)
- Crops with local names, growing seasons, disease classes
- Diseases with symptoms, local names, treatment templates
- Weather sources (Open-Meteo, NASA POWER)
- Satellite sources (Sentinel-2, Landsat-8)
- Free-tier AI providers with model mappings
- Prompt templates per task type & language
- Edge model config (version, CDN URL, hash, thresholds)
- Caching TTLs

### 3.3 Shared SDK (`packages/shared-sdk`)

**Exports:**
- Type-safe API client (`api.ts`)
- React hooks for data fetching (`hooks.ts`)
- Utility functions (`utils.ts`)

**React Hooks:**
- `useDiseaseDetection()` - Scan + advisory flow
- `useYieldPrediction()` - Predict + weather
- `useAdvisory()` - Treatment advice
- `useWeather()` - Weather data
- `useCrops()` / `useDiseases()` - Reference data
- `useFarmerFlow()` / `useCoopFlow()` - Combined workflows

### 3.4 Farmer Mobile App (`apps/farmer-app`)

**Technology:** React Native + Expo + Expo Router

**Screens:**
- **Scan Tab** - Camera capture, edge/cloud detection, results
- **Advisory Tab** - Disease list, severity selector, treatment details
- **Crops Tab** - Crop catalog with local names, seasons, diseases
- **Settings Tab** - Region/crop selection, notifications, offline mode

**Key Features:**
- Camera with flash/flip controls
- Image resize/compression before upload
- Offline-first with cached model
- Multi-language UI (i18n ready)
- Secure storage for auth tokens

### 3.5 Cooperative Dashboard (`apps/coop-dashboard`)

**Technology:** Next.js 14 + Tailwind CSS + Recharts

**Pages:**
- **Overview** - Stats cards, disease outbreaks, yield predictions, weather, farmer activity
- **Diseases** - Detailed outbreak table with sorting, filtering, expandable details
- **Yield** - Field predictions with history charts, key drivers, risk factors
- **Farmers** - Member management, activity tracking, alert monitoring
- **Settings** - Coop config, crops, notifications

### 3.6 Edge Models (`packages/edge-models`)

**Training Pipeline:**
1. Download PlantVillage + regional datasets
2. Filter for target crops/diseases
3. Train EfficientNet-B0 / MobileNetV3 / EfficientNetV2-S
4. Quantize to INT8 TFLite + CoreML
5. Export metadata (labels, thresholds, input spec)

**Model Specs:**
- Target: <30MB, >90% top-1 on regional test set
- Inference: <100ms on Snapdragon 680 / Helio G99
- Input: 224x224 RGB, normalized [0,1]
- Output: Softmax over disease classes + healthy

### 3.7 Federated Learning (`packages/federated-learning`)

**Architecture:**
- **Server** (WebSocket) - Coordinates rounds, aggregates updates
- **Clients** (Mobile) - Local training, send weight deltas

**Protocol:**
1. Server starts round → broadcasts target version
2. Clients with sufficient data train locally (1-5 epochs)
3. Clients send compressed weight deltas + metrics
4. Server performs FedAvg weighted by sample count
5. New model version published to CDN
6. Clients notified → download updated model

---

## 4. Provider Matrix (2026)

| Provider | Type | Models | Free Tier Limits | Best For |
|----------|------|--------|------------------|----------|
| **Gemini** | Vision + Text | 1.5 Flash, 1.5 Pro | 60 RPM, 1500 RPD | Primary disease detection, advisory |
| **Groq** | Text (LLM) | Llama 3.1 70B/8B | 30 RPM, 6000 RPD | Fast advisory, yield prediction |
| **Groq** | Vision | Llama 3.2 11B Vision | 30 RPM | Disease detection backup |
| **HuggingFace** | Vision | ResNet-50, ViT, BEiT | 30 RPM, 1000 RPD | Specialized disease classifiers |
| **Together.ai** | Vision + Text | Llama 3.2 11B Vision, Llama 3.1 70B | 20 RPM, 1000 RPD | Backup for all tasks |
| **OpenRouter** | Vision + Text | Gemini Flash, Llama Vision | 20 RPM, 500 RPD | Fallback, model diversity |

### Routing Logic
```python
def select_provider(task: TaskType, region: Region) -> Provider:
    candidates = REGISTRY.providers_for(task, region)
    
    scored = []
    for p in candidates:
        score = (
            p.availability * 0.4 +
            p.latency_score * 0.3 +
            p.accuracy_score[task] * 0.2 +
            p.cost_score * 0.1
        )
        scored.append((score, p))
    
    for _, provider in sorted(scored, reverse=True):
        try:
            return provider
        except RateLimitError:
            continue
        except ProviderError:
            continue
    
    raise AllProvidersExhausted()
```

### Caching Strategy
| Endpoint | TTL | Cache Key |
|----------|-----|-----------|
| Disease Detection | 1 hour | `disease:{region}:{crop}:{image_hash}` |
| Yield Prediction | 24 hours | `yield:{field_id}:{season}` |
| Weather | 30 min | `weather:{lat}:{lon}:{days}` |
| Satellite | 12 hours | `satellite:{lat}:{lon}:{date}` |
| Advisory | 1 hour | `advisory:{disease}:{crop}:{region}:{lang}:{severity}` |

---

## 5. Region Configuration Schema

See `packages/region-config/src/schema.ts` for complete Zod schemas.

### Example: India Region (`regions/india.yaml`)

**Crops (6):** Rice, Wheat, Maize, Cotton, Sugarcane, Potato
**Diseases (21):** 3-5 per crop with local names in 10 languages
**Languages:** en, hi, ta, te, bn, mr, gu, kn, ml, pa
**Seasons:** Kharif, Rabi, Zaid
**Providers:** All 6 free-tier providers enabled

---

## 6. Data Sources (Open/Free)

| Category | Source | Access | Notes |
|----------|--------|--------|-------|
| **Training Images** | PlantVillage | GitHub | 54k+ images, 38 classes |
| **Weather** | Open-Meteo | API | No key required, 7-day forecast |
| **Weather** | NASA POWER | API | Historical + forecast, ag-specific |
| **Satellite** | Sentinel Hub | API | Sentinel-2, requires key |
| **Satellite** | Landsat | USGS | Free, 30m resolution |
| **Soil** | SoilGrids | API | Global soil properties |
| **Pests** | CABI | API | Pest distribution maps |

---

## 7. Deployment

### 7.1 Self-Hosted (Docker Compose)
```yaml
services:
  router:     # FastAPI on port 8000
  redis:      # Caching & rate limiting
  db:         # PostgreSQL 16
  dashboard:  # Next.js on port 3000
  model-server: # Nginx for model CDN
```

### 7.2 Managed Service (Cloud)

| Component | AWS | GCP | Azure |
|-----------|-----|-----|-------|
| **Router** | Cloud Run | Cloud Run | Container Apps |
| **Database** | RDS PostgreSQL | Cloud SQL | Cosmos DB (PG) |
| **Cache** | ElastiCache | Memorystore | Azure Cache |
| **CDN** | CloudFront | Cloud CDN | Azure CDN |
| **Monitoring** | CloudWatch | Cloud Monitoring | Azure Monitor |
| **Secrets** | Secrets Manager | Secret Manager | Key Vault |

---

## 8. Security

- **Authentication:** JWT tokens, short-lived (15min) + refresh tokens
- **Authorization:** Role-based (farmer, coop_admin, admin)
- **API Keys:** Stored in cloud secret managers, never in code
- **Rate Limiting:** Per-provider + per-user (Redis-backed)
- **Data Privacy:** No PII in federated learning, encrypted at rest
- **Transport:** TLS 1.3 everywhere

---

## 9. Monitoring & Observability

- **Metrics:** Prometheus + Grafana (latency, error rates, provider health)
- **Logging:** Structured JSON logs (Pino) → Cloud logging
- **Tracing:** OpenTelemetry for request flows
- **Alerts:** Provider failures, high error rates, model drift
- **Dashboards:** Farmer activity, disease trends, yield accuracy

---

## 10. Future Enhancements

1. **Market Intelligence** - Price forecasting, buyer matching
2. **Carbon Credits** - MRV for regenerative agriculture
3. **Supply Chain** - Traceability from farm to fork
4. **Insurance Integration** - Parametric crop insurance
5. **Voice Interface** - IVR for feature phones
6. **Satellite Time Series** - Historical NDVI trends per field
7. **Genomic Surveillance** - Pathogen evolution tracking

---

## Appendix: File Structure Reference

```
agrisense/
├── apps/
│   ├── farmer-app/          # React Native (Expo)
│   │   ├── app/(tabs)/      # Expo Router tabs
│   │   └── src/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── providers/
│   │       ├── services/    # edgeModel.ts
│   │       └── utils/
│   └── coop-dashboard/      # Next.js 14
│       ├── src/
│       │   ├── app/         # App Router pages
│       │   ├── components/  # Dashboard widgets
│       │   └── lib/         # Auth, theme, utils
├── packages/
│   ├── api-router/          # FastAPI service
│   │   ├── src/
│   │   │   ├── adapters/    # Provider adapters
│   │   │   └── routes/      # API endpoints
│   ├── region-config/       # Region schemas & loader
│   │   └── src/
│   │       ├── schema.ts    # Zod schemas
│   │       ├── loader.ts    # YAML loading
│   │       └── registry.ts  # Singleton registry
│   ├── shared-sdk/          # TypeScript SDK
│   │   └── src/
│   │       ├── api.ts       # API client
│   │       ├── hooks.ts     # React hooks
│   │       └── utils.ts     # Formatters, validators
│   ├── edge-models/         # Model training pipeline
│   │   └── src/train.ts     # Config + Colab generator
│   └── federated-learning/  # FL server & client
│       └── src/
│           ├── server.ts    # WebSocket coordinator
│           └── client.ts    # Edge participant
├── regions/
│   └── india.yaml           # Example region config
├── scripts/
│   ├── validate-regions.ts  # Config validator
│   └── init-db.sql          # PostgreSQL schema
└── docker-compose.yml       # Local dev stack
```

---

*This document serves as the authoritative architecture reference for AgriSense implementation.*