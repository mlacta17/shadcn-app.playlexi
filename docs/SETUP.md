# PlayLexi Setup Guide

> **Last Updated:** February 13, 2026

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

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Key variables for local development:

```bash
# .env.local

# Google Cloud Speech-to-Text
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Merriam-Webster Dictionary API (two separate keys)
MERRIAM_WEBSTER_LEARNERS_KEY=your-learners-api-key
MERRIAM_WEBSTER_COLLEGIATE_KEY=your-collegiate-api-key

# Google OAuth (for authentication)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret

# Better Auth
BETTER_AUTH_SECRET=your-random-secret-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
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

> **How Local D1 Works**
>
> The local D1 database is stored in `.wrangler/state/v3/d1/`. Both `npm run dev` (via
> `initOpenNextCloudflareForDev()` in `next.config.ts`) and wrangler CLI commands
> (like `npm run db:migrate`) use the **same** local SQLite file, identified by the
> `database_id` in `wrangler.jsonc`.
>
> This means you can:
> - Run migrations with `npm run db:migrate`
> - Seed data with `npm run db:seed`
> - Then immediately use that data in `npm run dev`
>
> All commands share the same local database.

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
| `lib/answer-validation.ts` | 43 tests | Core game logic, phonetic mapping |
| `lib/api/errors.ts` | 33 tests | Error handling, API responses |
| `lib/phonetic-learning/learning-engine.ts` | 36 tests | Auto-learning inference |
| `lib/services/user-service.ts` | 15 tests | User management |
| `lib/services/game-service.ts` | 14 tests | Game sessions |
| **Total** | **141 tests** | |

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

**Cloudflare Secrets** (set via Wrangler CLI — these are NOT in any file):

```bash
# Authentication
echo "YOUR_VALUE" | npx wrangler secret put BETTER_AUTH_SECRET
echo "https://app.playlexi.com" | npx wrangler secret put BETTER_AUTH_URL
echo "YOUR_VALUE" | npx wrangler secret put GOOGLE_CLIENT_ID
echo "YOUR_VALUE" | npx wrangler secret put GOOGLE_CLIENT_SECRET

# Admin API (for cron jobs and admin endpoints)
echo "YOUR_VALUE" | npx wrangler secret put ADMIN_CLEANUP_SECRET
```

| Secret | Purpose |
|--------|---------|
| `BETTER_AUTH_SECRET` | Signs session tokens (generate with `openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | Production URL (`https://app.playlexi.com`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ADMIN_CLEANUP_SECRET` | Bearer token for admin API endpoints |

**Build-time variables** (in `.env.production`, checked into git):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://app.playlexi.com` |
| `NEXT_PUBLIC_SPEECH_SERVER_URL` | `wss://speech.playlexi.com` |

**Note:** Merriam-Webster API keys are only used at seed time (`npm run db:seed`), not at runtime. They go in `.env.local` for local development, not in Cloudflare.

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

### "D1 database not found" or "no such table"

Make sure you've:
1. Created the database with `wrangler d1 create`
2. Updated `wrangler.jsonc` with the correct `database_id`
3. Run migrations with `npm run db:migrate`
4. Seed the database with `npm run db:seed`

**If you still get errors after migrations:**

The local D1 database files are stored in `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`.
If you see multiple `.sqlite` files there, you may have orphan databases from older setups.

To fix:
```bash
# Check what files exist
ls -la .wrangler/state/v3/d1/miniflare-D1DatabaseObject/

# Remove ALL local D1 state (will need to re-run migrations)
rm -rf .wrangler/state/v3/d1

# Re-apply migrations
npm run db:migrate

# Re-seed the database
npm run db:seed
```

This ensures a clean slate with a single database file.

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

## CI/CD Pipeline

PlayLexi uses GitHub Actions for continuous integration. The pipeline runs automatically on every push.

### What CI Does

| Check | Purpose |
|-------|---------|
| **Tests** | Runs all 141 tests to catch bugs early |
| **Build** | Catches TypeScript errors, missing imports, route conflicts |
| **Migration Check** | Warns if database migrations need to be applied |

### Workflow Files

| Workflow | File | Trigger |
|----------|------|---------|
| **CI** | `.github/workflows/ci.yml` | Every push and PR to main |
| **Daily Puzzle Generation** | `.github/workflows/generate-puzzles.yml` | Daily at 00:05 UTC + manual trigger |

The puzzle generation workflow calls `POST /api/admin/generate-puzzles` to pre-generate 7 days of daily spell puzzles. Requires `PLAYLEXI_URL` and `ADMIN_CLEANUP_SECRET` GitHub secrets.

### How It Works

1. **Push code to GitHub** → CI runs automatically
2. **CI passes** → Safe to merge/deploy
3. **CI fails** → Fix the issue before merging

### Migration Check

The CI pipeline checks for pending database migrations. If you see a warning like:

```
⚠️ There are pending database migrations that need to be applied to production
```

Run this command **after merging** but **before deploying**:

```bash
npm run db:migrate:prod
```

This prevents the bug where code expects schema changes that haven't been applied yet.

### Optional: Enable Migration Check for PRs

To enable the migration check on pull requests, add these secrets in GitHub:
1. Go to your repo → Settings → Secrets and variables → Actions
2. Add `CLOUDFLARE_API_TOKEN` (create one at Cloudflare Dashboard → API Tokens)
3. Add `CLOUDFLARE_ACCOUNT_ID` (found in Cloudflare Dashboard URL)

Without these secrets, the migration check is skipped (tests and build still run).

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
| `npm run test:run` | Run tests once (141 tests) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations to local D1 |
| `npm run db:migrate:prod` | Apply migrations to production D1 |
| `npm run db:seed` | Seed database with words (local) |
| `npm run db:seed:prod` | Seed database with words (production) |
| `npm run db:seed:daily` | Generate daily spell puzzles (local, 7 days ahead) |
| `npm run db:seed:daily:prod` | Generate daily spell puzzles (production) |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |
| `npm run tts:generate` | Generate TTS audio for words (local) |
| `npm run tts:generate:prod` | Generate TTS audio (production) |
| `npm run daily:reset` | Reset today's daily spell results (local dev only) |

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

## Optional: Developer Tooling

### Figma MCP Integration (for Claude Code users)

If you use [Claude Code](https://claude.ai/code) and want to fetch designs directly from Figma during development:

#### Setup

1. **Get a Figma Personal Access Token**
   - Go to https://www.figma.com/settings
   - Scroll to **Personal access tokens**
   - Click **Generate new token**
   - Name it (e.g., "Claude Code") and copy the token

2. **Add the Figma MCP server**
   ```bash
   claude mcp add figma --scope project -- npx -y figma-developer-mcp --figma-api-key="YOUR_TOKEN"
   ```

3. **Restart Claude Code** for the MCP to take effect

#### Notes

- `.mcp.json` is gitignored — each developer needs their own token
- Tokens expire after 90 days; regenerate when needed
- This is optional tooling; the app runs fine without it

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
