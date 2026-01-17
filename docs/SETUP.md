# PlayLexi Setup Guide

This guide walks you through setting up PlayLexi for local development and production deployment.

## Required Accounts

You'll need accounts with the following services:

### 1. Cloudflare (Required)

**Purpose**: Hosting, database (D1), and file storage (R2)

**Create account**: https://dash.cloudflare.com/sign-up

**What you'll use**:
- **Cloudflare Pages** — Hosts the Next.js application
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
NEXT_PUBLIC_SPEECH_SERVER_URL=ws://localhost:3001
```

### 3. Setup Cloudflare D1 Database

```bash
# Login to Cloudflare
npx wrangler login

# Create the D1 database
npx wrangler d1 create playlexi-db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "playlexi-db"
database_id = "YOUR_DATABASE_ID_HERE"  # <- Paste here
```

### 4. Run Database Migrations

```bash
# Generate migrations from schema
npx drizzle-kit generate:sqlite

# Apply migrations to local D1
npx wrangler d1 migrations apply playlexi-db --local
```

### 5. Create R2 Bucket (Optional for Local)

```bash
npx wrangler r2 bucket create playlexi-assets
```

### 6. Start Development Servers

You need two terminals:

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

## Production Deployment

### 1. Setup Cloudflare Pages

1. Go to Cloudflare Dashboard → Pages
2. Connect your GitHub repository
3. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `.vercel/output/static` (for next-on-pages)
   - **Root directory**: `/` (leave default)

### 2. Configure Environment Variables

In Cloudflare Pages settings, add these environment variables:

| Variable | Value |
|----------|-------|
| `GOOGLE_CLOUD_PROJECT_ID` | Your GCP project ID |
| `GOOGLE_CLOUD_CLIENT_EMAIL` | Service account email |
| `GOOGLE_CLOUD_PRIVATE_KEY` | Private key (with newlines) |
| `MERRIAM_WEBSTER_API_KEY` | Your MW API key |
| `NEXT_PUBLIC_SPEECH_SERVER_URL` | Your deployed speech server URL |

### 3. Bind D1 Database

In Cloudflare Pages settings → Functions → D1 database bindings:

| Variable name | D1 database |
|---------------|-------------|
| `DB` | playlexi-db |

### 4. Bind R2 Bucket

In Cloudflare Pages settings → Functions → R2 bucket bindings:

| Variable name | R2 bucket |
|---------------|-----------|
| `ASSETS` | playlexi-assets |

### 5. Deploy Speech Server

The speech server needs to run separately (Cloudflare Workers can't make gRPC calls).

**Option A: Google Cloud Run** (Recommended)

```bash
cd speech-server

# Build and deploy
gcloud run deploy playlexi-speech \
  --source . \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=...,GOOGLE_CLOUD_CLIENT_EMAIL=...,GOOGLE_CLOUD_PRIVATE_KEY=..."
```

**Option B: Railway/Render**

Deploy the `speech-server/` directory as a Node.js app.

### 6. Apply Production Migrations

```bash
npx wrangler d1 migrations apply playlexi-db
```

---

## Seeding Word Data

Once the database is set up, seed it with Merriam-Webster words:

```bash
# Run the seeding script (creates words in D1)
npm run db:seed
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
2. Updated `wrangler.toml` with the correct `database_id`
3. Run migrations with `wrangler d1 migrations apply`

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
| `npm run build` | Build for production |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations to local D1 |
| `npm run db:seed` | Seed database with Merriam-Webster words |
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
│  Pages (Next.js) │ │  (Cloud Run)     │ │  (Audio Files)   │
└────────┬─────────┘ └────────┬─────────┘ └──────────────────┘
         │                    │
         │                    │
         ▼                    ▼
┌──────────────────┐ ┌──────────────────┐
│  Cloudflare D1   │ │  Google Speech   │
│  (SQLite Edge)   │ │  API (gRPC)      │
└──────────────────┘ └──────────────────┘
```

---

## Cost Estimates

For a small to medium deployment (~1,000 daily active users):

| Service | Monthly Cost |
|---------|-------------|
| Cloudflare Pages | Free |
| Cloudflare D1 | Free (under 5GB) |
| Cloudflare R2 | ~$0.50 (10GB storage) |
| Google Speech-to-Text | ~$20-50 (depending on usage) |
| Merriam-Webster API | Free (non-commercial) |
| Google Cloud Run | ~$5-10 (speech server) |

**Total**: ~$25-60/month for 1,000 DAU

The architecture is designed to minimize costs while maintaining performance:
- Words are pre-cached (zero runtime MW API calls)
- Audio files are served from R2 (cheap object storage)
- Google Speech only used during active voice input
