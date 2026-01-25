# PlayLexi Audio Pipeline — Setup & Operations Guide

> **Last Updated:** January 24, 2026
> **Purpose:** Complete guide for setting up and running the audio generation pipeline

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Step-by-Step Setup](#3-step-by-step-setup)
4. [Running the Pipeline](#4-running-the-pipeline)
5. [Cost Analysis](#5-cost-analysis)
6. [Scaling to Millions of Users](#6-scaling-to-millions-of-users)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Overview

PlayLexi uses a "Generate Once, Serve Forever" architecture for audio:

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUILD TIME (One-Time)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │ seed-words  │      │ Merriam-    │      │  OpenAI     │     │
│  │   .json     │──────│ Webster API │──────│  TTS API    │     │
│  │ (681 words) │      │ (Definitions│      │ (Voice)     │     │
│  └─────────────┘      │  + Audio)   │      └──────┬──────┘     │
│                       └──────┬──────┘             │             │
│                              │                    │             │
│                              ▼                    ▼             │
│                       ┌─────────────────────────────────┐      │
│                       │        Cloudflare R2            │      │
│                       │  (Audio file storage - 0 egress)│      │
│                       └─────────────────────────────────┘      │
│                                      │                          │
│                                      ▼                          │
│                       ┌─────────────────────────────────┐      │
│                       │        Cloudflare D1            │      │
│                       │  (Words table with audio URLs)  │      │
│                       └─────────────────────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    RUNTIME (Zero API Calls)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Player ──► /api/words/random ──► D1 ──► R2 (edge-cached)      │
│                                                                  │
│   Audio URLs returned:                                           │
│   ├── audioUrl          (MW pronunciation)                       │
│   ├── introAudioUrl     (TTS: "Your word is...")                │
│   ├── sentenceAudioUrl  (TTS: example sentence)                 │
│   └── definitionAudioUrl (TTS: definition)                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- Zero API costs during gameplay
- Edge-cached audio (fast globally)
- Consistent voice quality
- Works for 1 or 1,000,000 users at same cost

---

## 2. Prerequisites

### Required API Keys

| Service | Purpose | Where to Get |
|---------|---------|--------------|
| **OpenAI API** | TTS voice generation | https://platform.openai.com/api-keys |
| **Merriam-Webster Learner's** | Definitions + audio | https://dictionaryapi.com/ |
| **Merriam-Webster Collegiate** | Etymology + fallback | https://dictionaryapi.com/ |
| **Cloudflare R2** | Audio file storage | Cloudflare Dashboard → R2 |

### Getting OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Name it "PlayLexi TTS"
4. Copy immediately (shown only once)
5. **IMPORTANT:** Set up billing at https://platform.openai.com/settings/organization/billing
6. Set a spending limit ($50-100 recommended for initial setup)

### Getting Merriam-Webster API Keys

1. Go to https://dictionaryapi.com/
2. Create a free developer account
3. Register for:
   - **Learner's Dictionary** (primary)
   - **Collegiate Dictionary** (fallback)
4. Copy both API keys

### Setting Up Cloudflare R2

1. Go to Cloudflare Dashboard → R2
2. Create a bucket named `playlexi-assets`
3. Go to **Manage R2 API Tokens** → Create token
4. Select **Object Read & Write** permissions
5. Copy:
   - Access Key ID
   - Secret Access Key
   - Account ID (from dashboard URL)

---

## 3. Step-by-Step Setup

### Step 1: Configure Environment Variables

Create/update `.env.local`:

```bash
# =============================================================================
# MERRIAM-WEBSTER (Word definitions + pronunciation audio)
# =============================================================================
MERRIAM_WEBSTER_LEARNERS_KEY=your-learners-key-here
MERRIAM_WEBSTER_COLLEGIATE_KEY=your-collegiate-key-here

# =============================================================================
# OPENAI (TTS voice generation)
# =============================================================================
OPENAI_API_KEY=sk-proj-your-key-here

# =============================================================================
# CLOUDFLARE R2 (Audio file storage)
# =============================================================================
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=playlexi-assets
```

### Step 2: Run Database Migrations

```bash
# Apply all migrations (including TTS columns)
npm run db:migrate         # Local development
npm run db:migrate:prod    # Production
```

### Step 3: Seed Words from Merriam-Webster

```bash
# First, do a dry run to see what will happen
npm run db:seed:dry

# Seed to local D1 (development)
npm run db:seed

# Seed to production D1 + R2
npm run db:seed:prod
```

**What this does:**
- Reads 681 words from `data/seed-words.json`
- Fetches definitions from MW Learner's API
- Downloads pronunciation audio
- Uploads audio to R2
- Inserts words into D1

### Step 4: Generate TTS Audio

```bash
# First, estimate the cost
npm run tts:estimate

# Output example:
# ━━━ Cost Estimate ━━━
# ℹ Total characters: 183,870
# ℹ Estimated cost: $2.76

# Do a dry run
npm run tts:generate:dry

# Generate for local testing (no R2 upload)
npm run tts:generate

# Generate for production (uploads to R2)
npm run tts:generate:prod
```

**What this does:**
- Reads all words from D1
- Generates 3 audio files per word using OpenAI TTS
- Uploads to R2
- Updates D1 with audio URLs

---

## 4. Running the Pipeline

### Complete Pipeline (New Project)

```bash
# 1. Apply migrations
npm run db:migrate:prod

# 2. Seed words from Merriam-Webster
npm run db:seed:prod

# 3. Estimate TTS cost
npm run tts:estimate

# 4. Generate TTS audio
npm run tts:generate:prod
```

### Incremental Updates (Adding New Words)

1. Add words to `data/seed-words.json` under the appropriate tier
2. Run:
```bash
# Seed only new words (existing ones are skipped via INSERT OR REPLACE)
npm run db:seed:prod

# Generate TTS only for words missing TTS audio
npm run tts:generate:prod --skip-existing
```

### Regenerating Specific Tiers

```bash
# Regenerate TTS for tier 7 only
npm run tts:generate:prod --tier=7
```

### Regenerating a Single Word

```bash
npm run tts:generate:prod --word=conscientious
```

---

## 5. Cost Analysis

### Current 681 Words

| Component | Characters | Cost |
|-----------|------------|------|
| MW API | Free tier | $0 |
| TTS Intro | 13,620 | $0.20 |
| TTS Sentence | 68,100 | $1.02 |
| TTS Definition | 102,150 | $1.53 |
| **Total** | 183,870 | **$2.76** |

### Projected Scaling

| Word Count | TTS Cost | R2 Storage | Monthly |
|------------|----------|------------|---------|
| 681 | $2.76 | ~100MB | <$0.01 |
| 1,000 | $4.05 | ~150MB | <$0.01 |
| 5,000 | $20.25 | ~750MB | $0.01 |
| 10,000 | $40.50 | ~1.5GB | $0.02 |
| 50,000 | $202.50 | ~7.5GB | $0.11 |

### Monthly Operating Costs (After Initial Generation)

| Users | R2 Storage | R2 Egress | D1 Queries | Total |
|-------|------------|-----------|------------|-------|
| 1K | $0.02 | $0 | Free tier | ~$0.02 |
| 10K | $0.02 | $0 | ~$5 | ~$5 |
| 100K | $0.02 | $0 | ~$50 | ~$50 |
| 1M | $0.02 | $0 | ~$500 | ~$500 |

**Key insight:** Audio costs are one-time. Ongoing costs are only D1 queries.

---

## 6. Scaling to Millions of Users

### Architecture Principles

1. **Pre-generate everything** — No runtime TTS API calls
2. **Edge-serve audio** — R2 + Cloudflare CDN = global low latency
3. **Cache in browser** — Audio files can be cached client-side
4. **Lazy load** — Only fetch audio when player clicks play

### R2 Configuration for Scale

```jsonc
// In wrangler.jsonc, R2 is already configured:
{
  "r2_buckets": [
    {
      "binding": "R2_ASSETS",
      "bucket_name": "playlexi-assets"
    }
  ]
}
```

### CDN Caching Headers

The R2 assets should return proper cache headers. In your asset-serving route:

```typescript
// app/api/assets/[...path]/route.ts
return new Response(audioBuffer, {
  headers: {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
  },
});
```

### Client-Side Caching

Audio elements automatically cache in browser. For aggressive caching:

```typescript
// Preload audio for current word
const audio = new Audio(word.introAudioUrl);
audio.preload = 'auto';
```

### Database Indices

Already configured for scale:
- `idx_words_difficulty_tier` — Fast tier-based random selection
- `idx_words_word` — Fast word lookups

---

## 7. Troubleshooting

### "OPENAI_API_KEY is not set"

1. Check `.env.local` exists and has the key
2. Restart your terminal after adding the key
3. Verify key starts with `sk-`

### "R2 credentials not configured"

1. All 3 R2 variables must be set:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
2. Verify token has Object Read & Write permissions

### "Rate limit exceeded" (MW API)

Free tier is 1,000 queries/day. Solutions:
- Use `--limit=100` to process in batches
- Wait 24 hours for reset
- Contact MW for commercial license

### "Rate limit exceeded" (OpenAI)

OpenAI TTS allows ~50 requests/minute. The script includes 1.5s delays. If still hitting limits:
- Increase delay in `scripts/generate-tts.ts`
- Process in smaller batches with `--limit`

### Audio not playing in browser

1. Check browser console for errors
2. Verify R2 bucket has public access or proper CORS
3. Test URL directly in browser

### Missing TTS for some words

Run with `--skip-existing` to only generate missing:
```bash
npm run tts:generate:prod --skip-existing
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Apply migrations | `npm run db:migrate:prod` |
| Seed words | `npm run db:seed:prod` |
| Estimate TTS cost | `npm run tts:estimate` |
| Generate TTS | `npm run tts:generate:prod` |
| Generate TTS (dry run) | `npm run tts:generate:dry` |
| Generate single tier | `npm run tts:generate:prod --tier=3` |
| Generate single word | `npm run tts:generate:prod --word=castle` |
| Skip existing | `npm run tts:generate:prod --skip-existing` |

---

*End of Audio Pipeline Guide*
