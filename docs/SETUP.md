# PlayLexi Setup Guide

> **Last Updated:** January 17, 2026

This guide walks you through setting up PlayLexi for local development, testing, and production deployment.

## Required Accounts

You'll need accounts with the following services:

### 1. Cloudflare (Required)

**Purpose**: Hosting, database (D1), and file storage (R2)

**Create account**: https://dash.cloudflare.com/sign-up

**What you'll use**:
- **Cloudflare Workers** — Hosts the Next.js application (via OpenNext adapter)
- **D1** — Serverless SQLite database at the edge
- **R2** — Object storage for audio files (Merriam-Webster pronunciations)

**Cost**: Free tier is generous (100k requests/day, 5GB D1 storage, 10GB R2)

### 2. Google Cloud Platform (Required for Voice)

**Purpose**: Speech-to-Text API for voice recognition

**Create account**: https://console.cloud.google.com

**Setup steps**:
1. Create a new project (e.g., "playlexi")
2. Enable the **Cloud Speech-to-Text API**
3. Create a **Service Account** with Speech-to-Text permissions
4. Download the JSON key file
5. Extract these values for environment variables:
   - `GOOGLE_CLOUD_PROJECT_ID` — Your project ID
   - `GOOGLE_CLOUD_CLIENT_EMAIL` — Service account email
   - `GOOGLE_CLOUD_PRIVATE_KEY` — Private key from JSON (keep the `\n` characters)

**Cost**: $0.006 per 15 seconds of audio. First 60 minutes/month free.

### 3. Merriam-Webster (Required for Words)

**Purpose**: Dictionary API for word definitions, pronunciations, and audio

**Create account**: https://dictionaryapi.com/register/index

**Setup steps**:
1. Register for a free API key
2. Select the **Collegiate Dictionary** API
3. Copy your API key

**Cost**: Free for non-commercial use (1,000 queries/day)

---

## Local Development Setup

### Prerequisites

- Node.js 18+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- npm or pnpm
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed globally or via npx)

### 1. Clone and Install

```bash
git clone <repository-url>
cd playlexi
npm install
```

### 2. Create Environment Files

Create `.env.local` for Next.js:

```bash
# .env.local

# Google Cloud Speech-to-Text
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Merriam-Webster Dictionary API
MERRIAM_WEBSTER_API_KEY=your-api-key

# Speech server URL (local development)
NEXT_PUBLIC_SPEECH_SERVER_URL=ws://localhost:3002
```

### 3. Setup Cloudflare D1 Database

```bash
# Login to Cloudflare
npx wrangler login

# Create the D1 database
npx wrangler d1 create playlexi-db
```

Copy the `database_id` from the output and update `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "playlexi-db",
      "database_id": "YOUR_DATABASE_ID_HERE"  // <- Paste here
    }
  ]
}
```

### 4. Run Database Migrations

```bash
# Generate migrations from schema (if schema changed)
npm run db:generate

# Apply migrations to local D1
npm run db:migrate
```

### 5. Create R2 Bucket (Optional for Local)

```bash
npx wrangler r2 bucket create playlexi-assets
```

### 6. Start Development Servers

**Option 1 — Both servers together** (recommended):
```bash
npm run dev:all
```

**Option 2 — Separate terminals**:

**Terminal 1 — Next.js app**:
```bash
npm run dev
```

**Terminal 2 — Speech server** (for Google Speech-to-Text):
```bash
npm run dev:speech
```

Open http://localhost:3000 to see the app.

---

## Testing

### Run Tests

```bash
# Watch mode (re-runs on file changes)
npm test

# Single run (for CI/CD)
npm run test:run

# With coverage report
npm run test:coverage
```

### Test Structure

Tests are co-located with source files using the `.test.ts` suffix:

```
lib/
├── answer-validation.ts      # Source file
├── answer-validation.test.ts # Tests for this file
└── ...
```

### Writing Tests

We use [Vitest](https://vitest.dev/) with React Testing Library. Example:

```typescript
import { describe, it, expect } from "vitest"
import { normalizeAnswer } from "./answer-validation"

describe("normalizeAnswer", () => {
  it("converts to lowercase", () => {
    expect(normalizeAnswer("CAT")).toBe("cat")
  })

  it("removes spaces between letters", () => {
    expect(normalizeAnswer("C A T")).toBe("cat")
  })
})
```

### Current Test Coverage

| Module | Tests | Coverage |
|--------|-------|----------|
| `lib/answer-validation.ts` | 43 tests | Core game logic |

### What to Test

Priority areas for new tests:
1. **Answer validation** — Ensures correct/incorrect detection works
2. **Anti-cheat logic** — Spelled vs spoken word detection
3. **Game state management** — State transitions in hooks
4. **API routes** — Input validation, error handling

---

## Production Deployment

### 1. Deploy via Wrangler CLI

The app uses [OpenNext](https://opennext.js.org/) to deploy Next.js to Cloudflare Workers.

```bash
# Build and deploy in one command
npm run deploy
```

This will:
1. Build the Next.js app with OpenNext
2. Upload assets to Cloudflare
3. Deploy the Worker

### 2. Configure Environment Variables

Set these as secrets in Cloudflare:

```bash
# Set secrets via Wrangler
npx wrangler secret put MERRIAM_WEBSTER_API_KEY
```

Or in Cloudflare Dashboard → Workers → Your Worker → Settings → Variables.

| Variable | Value |
|----------|-------|
| `MERRIAM_WEBSTER_API_KEY` | Your MW API key |

**Note:** `NEXT_PUBLIC_SPEECH_SERVER_URL` is set in `.env.production` and embedded at build time.

### 3. D1 and R2 Bindings

Bindings are configured in `wrangler.jsonc` and automatically applied during deployment:

```jsonc
{
  "d1_databases": [{ "binding": "DB", "database_name": "playlexi-db", ... }],
  "r2_buckets": [{ "binding": "R2_ASSETS", "bucket_name": "playlexi-assets" }]
}
```

### 4. Deploy Speech Server

The speech server runs on Railway (or Cloud Run for scale).

> See [speech-server/DEPLOYMENT.md](../speech-server/DEPLOYMENT.md) for detailed instructions.

**Phase 1: Railway** (Current)
- URL: `wss://speech.playlexi.com`
- Cost: $5-50/month
- Capacity: ~3,000 concurrent connections

**Phase 2: Cloud Run** (When needed)
- Migrate when Railway hits limits or you need lower latency

### 5. Apply Production Migrations

```bash
npm run db:migrate:prod
```

### 6. Seed Production Database

```bash
npm run db:seed:prod
```

---

## Seeding Word Data

Once the database is set up, seed it with Merriam-Webster words:

```bash
# Local development
npm run db:seed

# Production
npm run db:seed:prod

# Dry run (shows what would be inserted)
npm run db:seed:dry
```

This script:
1. Fetches word definitions from Merriam-Webster API
2. Downloads pronunciation audio files
3. Uploads audio to R2
4. Inserts word records into D1

**Note**: The seeding script is rate-limited to respect MW API limits.

---

## Troubleshooting

### "D1 database not found"

Make sure you've:
1. Created the database with `wrangler d1 create`
2. Updated `wrangler.jsonc` with the correct `database_id`
3. Run migrations with `npm run db:migrate`

### "Google Speech API error"

Check that:
1. The Speech-to-Text API is enabled in GCP
2. Your service account has the correct permissions
3. The private key includes newline characters (`\n`)

### "Speech server not connecting"

Verify:
1. The speech server is running (`npm run dev:speech`)
2. `NEXT_PUBLIC_SPEECH_SERVER_URL` points to the correct URL
3. WebSocket connections aren't blocked by firewall/proxy

### "Audio files not playing"

For production:
1. Ensure R2 bucket is created and bound
2. Run the seeding script to upload audio files
3. Check R2 public access settings

For development:
- The app falls back to browser Speech Synthesis when audio files are unavailable

---

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run dev:speech` | Start speech recognition WebSocket server |
| `npm run dev:all` | Start both Next.js and speech server |
| `npm run build` | Build for production |
| `npm run deploy` | Build and deploy to Cloudflare Workers |
| `npm run preview` | Preview production build locally |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations to local D1 |
| `npm run db:migrate:prod` | Apply migrations to production D1 |
| `npm run db:seed` | Seed database with words (local) |
| `npm run db:seed:prod` | Seed database with words (production) |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Cloudflare      │ │  Speech Server   │ │  Cloudflare R2   │
│  Workers         │ │  (Railway)       │ │  (Audio Files)   │
│  (Next.js)       │ │                  │ │                  │
└────────┬─────────┘ └────────┬─────────┘ └──────────────────┘
         │                    │
         │                    │
         ▼                    ▼
┌──────────────────┐ ┌──────────────────┐
│  Cloudflare D1   │ │  Google Speech   │
│  (SQLite Edge)   │ │  API (gRPC)      │
└──────────────────┘ └──────────────────┘
```

**Current Production URLs:**
- Web App: https://app.playlexi.com
- Speech Server: wss://speech.playlexi.com

**Speech Server Platform Strategy:**
- **Phase 1 (0-1K DAU):** Railway ($5-50/month) - simple, no cold starts
- **Phase 2 (1K+ DAU):** Cloud Run ($65+/month) - auto-scaling, lower latency

---

## Cost Estimates

### Phase 1: 0-1,000 DAU (Railway)

| Service | Monthly Cost |
|---------|-------------|
| Cloudflare Workers | Free |
| Cloudflare D1 | Free (under 5GB) |
| Cloudflare R2 | ~$0.50 (10GB storage) |
| Google Speech-to-Text | ~$20-50 (depending on usage) |
| Merriam-Webster API | Free (non-commercial) |
| Speech Server (Railway) | $5-50 |

**Total**: ~$25-100/month for 1,000 DAU

### Phase 2: 1,000-10,000 DAU (Cloud Run)

| Service | Monthly Cost |
|---------|-------------|
| Cloudflare Workers | Free |
| Cloudflare D1 | ~$5-20 |
| Cloudflare R2 | ~$1-5 |
| Google Speech-to-Text | ~$50-400 |
| Merriam-Webster API | Free (non-commercial) |
| Speech Server (Cloud Run) | $65-200 |

**Total**: ~$120-625/month for 1,000-10,000 DAU

### Cost Optimization Notes

- Words are pre-cached (zero runtime MW API calls)
- Audio files are served from R2 (cheap object storage)
- Google Speech only used during active voice input
- Speech server scales with actual usage
