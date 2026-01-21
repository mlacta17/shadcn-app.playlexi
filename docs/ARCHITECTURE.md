# PlayLexi — Technical Architecture

> **Version:** 1.8
> **Last Updated:** January 17, 2026
> **Status:** Final Draft

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Component Architecture](#3-component-architecture)
4. [Database Schema](#4-database-schema)
5. [API Routes](#5-api-routes)
6. [State Management](#6-state-management)
7. [Real-Time Architecture](#7-real-time-architecture)
8. [Voice Recognition](#8-voice-recognition)
9. [Authentication](#9-authentication)
10. [Design System](#10-design-system)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment](#12-deployment)
13. [Security Considerations](#13-security-considerations)
14. [Error Handling Strategy](#14-error-handling-strategy)
15. [Performance Guidelines](#15-performance-guidelines)
16. [Accessibility Requirements](#16-accessibility-requirements)
17. [Observability](#17-observability)
18. [Developer Guide](#18-developer-guide)
19. [Architecture Decision Records](#19-architecture-decision-records)
20. [Implementation Roadmap](#20-implementation-roadmap)

---

## 1. Tech Stack

### 1.1 Core Technologies

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Next.js 14+ (App Router) | Server components, API routes, built-in optimization |
| **Language** | TypeScript | Type safety, better DX, catch errors early |
| **Styling** | Tailwind CSS + CSS Variables | Already in design system, utility-first, themeable |
| **UI Components** | shadcn/ui | Already in project, accessible, customizable |
| **Database** | Cloudflare D1 (SQLite) | Serverless SQL, globally distributed, cost-effective |
| **ORM** | Drizzle ORM | Type-safe, lightweight, D1-compatible |
| **Auth** | Better Auth | OAuth providers (Google), session management, D1-compatible |
| **Real-time** | Cloudflare Durable Objects | Native WebSocket support, stateful game sessions |
| **Voice** | Google Cloud Speech-to-Text (via WebSocket server) | Best letter recognition, word-level timing for anti-cheat |
| **Hosting** | Cloudflare Workers (via OpenNext) | Edge deployment, cost-effective, integrated stack |
| **Storage** | Cloudflare R2 | S3-compatible, zero egress fees |
| **Analytics** | PostHog | Privacy-focused, self-hostable |
| **Error Tracking** | Sentry | Real-time error monitoring |

### 1.2 Why Cloudflare?

**Cost Efficiency:**
- Generous free tier (100k requests/day on Workers)
- Zero egress fees on R2 storage
- Pay-per-request pricing scales with usage

**Native WebSocket Support:**
- Durable Objects provide stateful WebSocket connections
- No need for separate WebSocket server (Socket.io, Pusher)
- Game state persists naturally in Durable Objects

**Edge Performance:**
- Code runs in 300+ data centers worldwide
- Low latency for global player base
- D1 read replicas for fast queries

**Integrated Stack:**
- One platform for compute, storage, database, and real-time
- Simpler deployment and monitoring
- OpenNext adapter (`@opennextjs/cloudflare`) for Next.js compatibility

### 1.3 Hybrid Cloud Architecture

PlayLexi uses a **hybrid cloud architecture** with Cloudflare as the primary platform and a separate speech recognition server.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        CLOUDFLARE EDGE                                │    │
│  │                                                                       │    │
│  │   ┌─────────────────────────────┐    ┌─────────────┐              │    │
│  │   │    Cloudflare Workers       │    │     R2      │              │    │
│  │   │    (Next.js via OpenNext)   │    │  (Assets +  │              │    │
│  │   │                             │    │   Audio)    │              │    │
│  │   └─────────────────────────────┘    └─────────────┘              │    │
│  │         │                   │                  │                      │    │
│  │         └───────────────────┼──────────────────┘                      │    │
│  │                             │                                         │    │
│  │   ┌─────────────┐    ┌─────────────┐                                  │    │
│  │   │     D1      │    │   Durable   │                                  │    │
│  │   │ (User Data) │    │   Objects   │                                  │    │
│  │   │             │    │(Multiplayer)│                                  │    │
│  │   └─────────────┘    └─────────────┘                                  │    │
│  │                                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                             │                                                 │
│                             │ WebSocket (WSS)                                 │
│                             ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    SPEECH SERVER (Railway → Cloud Run)                │    │
│  │                                                                       │    │
│  │   ┌─────────────────────────────────────────────────────────────┐    │    │
│  │   │  Phase 1: Railway           │  Phase 2: Google Cloud Run    │    │    │
│  │   │  (0-1K DAU, $5-50/mo)       │  (1K+ DAU, $65+/mo)           │    │    │
│  │   │                              │                               │    │    │
│  │   │   ┌─────────────┐            │   ┌─────────────┐             │    │    │
│  │   │   │  WebSocket  │            │   │  WebSocket  │             │    │    │
│  │   │   │   Server    │ ─────────────► │   Server    │ ──► Google  │    │    │
│  │   │   │  (Node.js)  │            │   │  (Node.js)  │     Speech  │    │    │
│  │   │   └─────────────┘            │   └─────────────┘     API     │    │    │
│  │   │                              │                               │    │    │
│  │   └──────────────────────────────┴───────────────────────────────┘    │    │
│  │                                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why Hybrid?**

| Component | Platform | Rationale |
|-----------|----------|-----------|
| Frontend (Next.js) | Cloudflare Workers | Edge deployment, global CDN |
| Database | Cloudflare D1 | Serverless SQL, integrated |
| Multiplayer | Cloudflare Durable Objects | Native WebSocket support |
| Static Assets | Cloudflare R2 | Zero egress fees |
| **Speech Recognition** | **Railway → Cloud Run** | gRPC required (Cloudflare cannot make gRPC calls) |

**Technical Limitation:**
Cloudflare Workers cannot make outbound gRPC calls, which Google Speech-to-Text requires for real-time streaming. This necessitates a separate WebSocket server.

**Speech Server Scaling Strategy (Decision: January 2025):**

| Phase | Scale | Platform | Rationale |
|-------|-------|----------|-----------|
| Phase 1 | 0-1K DAU | Railway | Simple deployment, no cold starts, $5-50/mo |
| Phase 2 | 1K-10K DAU | Cloud Run | Auto-scaling, lower latency, $65-500/mo |
| Phase 3 | 10K+ DAU | Cloud Run (scaled) | Multi-instance, $500+/mo |

**Migration triggers:** Connection errors, latency complaints, costs exceeding $50-100/mo on Railway.

**Cost Projections:**

| Users | Speech Server | Google Speech | Cloudflare | Total/month |
|-------|---------------|---------------|------------|-------------|
| 1K | Railway ~$20 | ~$40 | Free tier | ~$60 |
| 10K | Cloud Run ~$150 | ~$400 | ~$50 | ~$600 |
| 100K | Cloud Run ~$1,000 | ~$4,000 | ~$500 | ~$5,500 |

See [speech-server/DEPLOYMENT.md](../speech-server/DEPLOYMENT.md) for detailed deployment instructions.

### 1.3 Why These Choices

**Next.js App Router:**
- Server components reduce client bundle
- API routes keep backend in same repo (monolith-first)
- Great caching and ISR for leaderboards
- Works on Cloudflare via OpenNext (`@opennextjs/cloudflare`)

**D1 over PostgreSQL:**
- SQLite syntax is familiar and battle-tested
- Native Cloudflare integration (no external database provider)
- Global read replicas for low-latency queries
- Drizzle ORM provides type safety similar to Prisma

**Drizzle over Prisma:**
- Lighter weight, better edge compatibility
- Native D1 driver support
- TypeScript-first, similar DX to Prisma
- No binary dependencies (works on edge runtime)

**Durable Objects over Socket.io:**
- Native Cloudflare solution, no additional service
- Each game room is a Durable Object with WebSocket support
- State persists across connections (handles disconnects gracefully)
- Automatic scaling per game room

---

## 2. Project Structure

### 2.0 Route Group Architecture

The app uses **two route groups** based on navigation pattern, not feature domain:

| Route Group | Layout | Navigation | Use Case |
|-------------|--------|------------|----------|
| `(shell)` | `ShellNavbar` | Full nav (Play, Leaderboard, Learn) + user menu | Dashboard, lists, settings |
| `(focused)` | None (pages own nav) | `TopNavbar` with X button | Games, onboarding, wizards |

**Why this pattern?**
- Clear mental model: "Does this page need full navigation or focused experience?"
- Scalable: New pages go in the appropriate group based on UX needs
- No confusion: Naming describes the navigation pattern, not the feature

### 2.1 Current Implementation

```
playlexi/
├── app/                          # Next.js App Router
│   ├── (shell)/                  # Full navigation shell (requires auth)
│   │   ├── layout.tsx            # Renders ShellNavbar
│   │   ├── shell-navbar.tsx      # Session-aware navbar component
│   │   ├── page.tsx              # Dashboard (/)
│   │   └── leaderboard/
│   │       └── page.tsx
│   │
│   ├── (focused)/                # Focused experiences (requires auth)
│   │   ├── layout.tsx            # Minimal — pages own their TopNavbar
│   │   ├── game/
│   │   │   ├── endless/
│   │   │   │   └── page.tsx      # Endless mode gameplay
│   │   │   └── result/
│   │   │       └── page.tsx      # Game results screen
│   │   └── onboarding/
│   │       └── rank-result/
│   │           └── page.tsx      # Post-placement rank display
│   │
│   ├── login/                    # Public (no auth required)
│   │   ├── page.tsx              # OAuth login page
│   │   └── login-navbar.tsx      # Login-specific navbar
│   │
│   ├── showcase/                 # Public (dev/demo)
│   │   └── page.tsx              # Component showcase
│   │
│   ├── api/                      # API Routes (current)
│   │   ├── auth/[...all]/        # Better Auth handler
│   │   ├── words/random/         # GET random word
│   │   └── phonetic-learning/    # Voice recognition learning
│   │
│   └── layout.tsx                # Root layout (fonts, providers)
```

### 2.2 Planned Structure (Future Phases)

> **Note**: The structure below shows the full vision. Items marked with `[PLANNED]` are not yet implemented.

```
playlexi/
├── app/
│   ├── (shell)/                  # [PLANNED additions]
│   │   ├── profile/              # User profile
│   │   ├── settings/             # Account settings
│   │   ├── notifications/        # Notification center
│   │   └── learn/                # PRO learning feature
│   │
│   ├── (focused)/                # [PLANNED additions]
│   │   ├── game/blitz/           # Blitz mode
│   │   ├── onboarding/           # Full onboarding flow
│   │   │   ├── tutorial/
│   │   │   ├── placement/
│   │   │   └── complete-profile/
│   │   └── multiplayer/          # Real-time multiplayer
│   │       ├── lobby/[roomCode]/
│   │       └── game/[gameId]/
│   │
│   └── api/                      # [PLANNED additions]
│       ├── users/
│       ├── games/
│       ├── matchmaking/
│       ├── friends/
│       └── leaderboard/
```

---

> **LEGACY REFERENCE**: The detailed structure below shows the original vision document.
> Refer to Section 2.1 for current implementation and Section 2.2 for planned work.

### 2.3 Full Vision Structure (Reference Only)

```
playlexi/
├── app/                          # Next.js App Router
│   ├── (shell)/                  # Full navigation (replaces old (main))
│   │   ├── layout.tsx            # Main nav: Play, Leaderboard, Profile
│   │   ├── play/
│   │   │   ├── page.tsx          # Mode selection (Single/Multi)
│   │   │   ├── single/
│   │   │   │   ├── endless/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── blitz/
│   │   │   │       └── page.tsx
│   │   │   └── multiplayer/
│   │   │       ├── local/
│   │   │       │   └── page.tsx
│   │   │       ├── online/
│   │   │       │   ├── private/
│   │   │       │   │   └── page.tsx
│   │   │       │   └── public/
│   │   │       │       └── page.tsx
│   │   │       └── lobby/
│   │   │           └── [roomCode]/
│   │   │               └── page.tsx
│   │   │
│   │   ├── game/                 # Active game screens
│   │   │   └── [gameId]/
│   │   │       ├── page.tsx      # Game UI
│   │   │       └── results/
│   │   │           └── page.tsx
│   │   │
│   │   ├── leaderboard/
│   │   │   ├── page.tsx          # Leaderboard with tabs
│   │   │   └── layout.tsx
│   │   │
│   │   ├── profile/
│   │   │   ├── page.tsx          # Own profile
│   │   │   └── [username]/
│   │   │       └── page.tsx      # Other player's profile
│   │   │
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   │
│   │   ├── chat/
│   │   │   └── [friendId]/
│   │   │       └── page.tsx
│   │   │
│   │   └── notifications/
│   │       └── page.tsx
│   │
│   ├── api/                      # API Routes
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── users/
│   │   │   ├── route.ts          # GET users, POST create
│   │   │   ├── [userId]/
│   │   │   │   └── route.ts
│   │   │   └── search/
│   │   │       └── route.ts
│   │   ├── games/
│   │   │   ├── route.ts          # POST create game
│   │   │   └── [gameId]/
│   │   │       ├── route.ts      # GET game state
│   │   │       ├── join/
│   │   │       │   └── route.ts
│   │   │       └── submit/
│   │   │           └── route.ts  # POST submit answer
│   │   ├── matchmaking/
│   │   │   └── route.ts          # POST find match
│   │   ├── friends/
│   │   │   ├── route.ts          # GET friends, POST request
│   │   │   ├── [friendId]/
│   │   │   │   └── route.ts      # DELETE unfriend
│   │   │   └── requests/
│   │   │       └── route.ts      # GET pending, POST accept/decline
│   │   ├── leaderboard/
│   │   │   ├── global/
│   │   │   │   └── route.ts
│   │   │   ├── friends/
│   │   │   │   └── route.ts
│   │   │   └── solo/
│   │   │       └── route.ts
│   │   ├── notifications/
│   │   │   └── route.ts
│   │   ├── words/
│   │   │   └── route.ts          # GET word for round
│   │   └── voice/
│   │       └── transcribe/
│   │           └── route.ts      # POST audio → text
│   │
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing/redirect
│   └── globals.css
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── progress.tsx
│   │   ├── tabs.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   │
│   ├── game/                     # Game-specific components
│   │   ├── voice-waveform.tsx
│   │   ├── voice-input.tsx
│   │   ├── keyboard-input.tsx
│   │   ├── game-timer.tsx
│   │   ├── hearts-display.tsx
│   │   ├── round-indicator.tsx
│   │   ├── word-helpers.tsx      # Sentence, dictionary, play buttons
│   │   ├── player-standings.tsx  # Multiplayer sidebar
│   │   └── game-results.tsx
│   │
│   ├── layout/                   # Layout components
│   │   ├── navbar.tsx
│   │   ├── mobile-nav.tsx
│   │   ├── sidebar.tsx
│   │   └── footer.tsx
│   │
│   ├── profile/                  # Profile components
│   │   ├── profile-header.tsx
│   │   ├── rank-cards.tsx
│   │   ├── match-history.tsx
│   │   └── friends-list.tsx
│   │
│   ├── leaderboard/              # Leaderboard components
│   │   ├── leaderboard-tabs.tsx
│   │   ├── leaderboard-table.tsx
│   │   ├── leaderboard-filters.tsx
│   │   └── rank-badge.tsx
│   │
│   ├── onboarding/               # Onboarding components
│   │   ├── tutorial-step.tsx
│   │   ├── tutorial-card.tsx
│   │   └── placement-game.tsx
│   │
│   ├── chat/                     # Chat components
│   │   ├── chat-window.tsx
│   │   ├── preset-messages.tsx
│   │   └── chat-bubble.tsx
│   │
│   └── shared/                   # Shared/common components
│       ├── loading-skeleton.tsx
│       ├── error-boundary.tsx
│       ├── notification-bell.tsx
│       └── theme-toggle.tsx
│
├── lib/                          # Utilities and configurations
│   ├── db.ts                     # Drizzle client (D1 binding)
│   ├── auth.ts                   # NextAuth config
│   ├── icons.ts                  # Centralized icon imports
│   ├── utils.ts                  # Helper functions (cn, formatters)
│   ├── constants.ts              # App constants (tiers, timers, etc.)
│   ├── validators.ts             # Zod schemas for validation
│   └── api/                      # API client helpers
│       ├── client.ts             # Fetch wrapper
│       └── endpoints.ts          # API endpoint definitions
│
├── hooks/                        # Custom React hooks
│   ├── use-game-state.ts         # Game state management
│   ├── use-speech-recognition.ts # Google Speech integration
│   ├── use-timer.ts              # Countdown timer
│   ├── use-socket.ts             # Real-time connection
│   ├── use-audio.ts              # Audio playback
│   └── use-notifications.ts      # Notification state
│
├── stores/                       # Zustand stores (if needed)
│   ├── game-store.ts
│   ├── user-store.ts
│   └── notification-store.ts
│
├── types/                        # TypeScript types
│   ├── game.ts
│   ├── user.ts
│   ├── leaderboard.ts
│   └── api.ts
│
├── db/
│   ├── schema.ts                 # Drizzle schema (see Section 4)
│   ├── migrations/               # D1 migration files
│   ├── index.ts                  # Database client factory
│   └── seed.ts                   # Seed script (words, test data)
│
├── public/
│   ├── avatars/                  # 3 preset avatar images
│   ├── rank-badges/              # Rank tier badge images
│   ├── audio/                    # Cached word audio files
│   └── fonts/
│
├── docs/
│   ├── PRD.md                    # Product requirements
│   └── ARCHITECTURE.md           # This file
│
├── tests/                        # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example                  # Environment variables template
├── .env.local                    # Local environment (git-ignored)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

### 2.1 Folder Rationale

**`app/(shell)/` and `app/(focused)/`:**
Route groups separate pages by navigation pattern. `(shell)` pages get the full navbar with
Play/Leaderboard/Learn links and user menu. `(focused)` pages render their own TopNavbar
for immersive experiences like gameplay and onboarding wizards. Both require authentication.

**`components/` structure:**
- `ui/` — shadcn primitives, never modified directly
- `game/` — game-specific, composed from ui components
- `layout/` — structural components
- `shared/` — reusable across features

**`lib/` vs `hooks/` vs `stores/`:**
- `lib/` — pure utilities, no React
- `hooks/` — React hooks, stateful logic
- `stores/` — global state (Zustand), only if needed

**`types/`:**
Centralized TypeScript types. Shared between client and server.

---

## 3. Component Architecture

### 3.1 Component Hierarchy (Game Screen)

```
GamePage
├── GameHeader
│   ├── CloseButton
│   ├── GameModeLabel
│   └── GameTimer (progress bar)
│
├── GameContent
│   ├── RoundIndicator
│   ├── CurrentPlayerAvatar (multiplayer only)
│   ├── VoiceWaveform
│   ├── HeartsDisplay
│   └── InputComponent
│       ├── SentenceButton
│       ├── DictionaryButton
│       ├── SpeechInput OR KeyboardInput
│       ├── PlayWordButton
│       └── DefinitionFooter
│
├── PlayerStandingsSidebar (multiplayer only)
│   ├── SidebarHeader
│   │   ├── TrophyIcon
│   │   ├── Title
│   │   └── CollapseButton
│   └── PlayerList
│       └── PlayerRow (multiple)
│
└── SettingsButton (floating)
```

### 3.2 Component Props Philosophy

**Prefer composition over configuration:**

```tsx
// ❌ Bad: Too many props
<GameInput
  mode="voice"
  showSentence={true}
  showDictionary={true}
  showPlay={true}
  onRecord={...}
  onStop={...}
/>

// ✅ Good: Composition
<GameInput>
  <SentenceButton onClick={...} />
  <DictionaryButton onClick={...} />
  <VoiceRecorder onRecord={...} onStop={...} />
  <PlayWordButton onClick={...} />
</GameInput>
```

### 3.3 Server vs Client Components

| Component | Type | Rationale |
|-----------|------|-----------|
| GamePage | Client | Real-time state, audio, user interaction |
| LeaderboardPage | Server | Static data, can be cached |
| ProfilePage | Server | Mostly read-only, SSR for SEO |
| Navbar | Client | Auth state, notifications |
| RankBadge | Server | Static display |
| VoiceWaveform | Client | Animation, audio API |

---

## 4. Database Schema

### 4.1 Drizzle Schema

> **Note:** We use Drizzle ORM instead of Prisma because Drizzle is lighter weight, has native D1 (SQLite) support, and runs on Cloudflare's edge runtime without binary dependencies.

```typescript
// db/schema.ts

import { sqliteTable, text, integer, real, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================
// ENUMS (as string unions for SQLite)
// ============================================

export const authProviders = ['google', 'apple'] as const;
export const themes = ['light', 'dark'] as const;
export const rankTracks = ['endless_voice', 'endless_keyboard', 'blitz_voice', 'blitz_keyboard'] as const;
export const rankTiers = ['new_bee', 'bumble_bee', 'busy_bee', 'honey_bee', 'worker_bee', 'royal_bee', 'bee_keeper'] as const;
export const gameModes = ['endless', 'blitz'] as const;
export const inputMethods = ['voice', 'keyboard'] as const;
export const gameTypes = ['single', 'local_multi', 'online_private', 'online_public'] as const;
export const gameStatuses = ['waiting', 'starting', 'in_progress', 'finished'] as const;
export const requestStatuses = ['pending', 'accepted', 'declined'] as const;
export const presetMessages = ['want_to_play', 'good_game', 'rematch'] as const;
export const reportReasons = ['cheating', 'harassment', 'inappropriate_username', 'other'] as const;
export const reportStatuses = ['pending', 'reviewed', 'actioned', 'dismissed'] as const;
export const notificationTypes = ['friend_request', 'friend_accepted', 'game_invite', 'game_finished'] as const;

// ============================================
// USER & AUTH
// ============================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  bio: text('bio'),
  avatarId: integer('avatar_id').notNull().default(1), // 1, 2, or 3
  age: integer('age').notNull(),
  authProvider: text('auth_provider', { enum: authProviders }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastOnline: integer('last_online', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),

  // Settings
  theme: text('theme', { enum: themes }).notNull().default('light'),
  emailSocial: integer('email_social', { mode: 'boolean' }).notNull().default(true),
  emailSecurity: integer('email_security', { mode: 'boolean' }).notNull().default(true),
  emailMarketing: integer('email_marketing', { mode: 'boolean' }).notNull().default(false),

  // Account deletion
  deletionRequestedAt: integer('deletion_requested_at', { mode: 'timestamp' }),
}, (table) => ({
  usernameIdx: index('idx_users_username').on(table.username),
  emailIdx: index('idx_users_email').on(table.email),
}));

// ============================================
// RANK SYSTEM
// ============================================

export const userRanks = sqliteTable('user_ranks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  track: text('track', { enum: rankTracks }).notNull(),
  tier: text('tier', { enum: rankTiers }).notNull().default('new_bee'),
  xp: integer('xp').notNull().default(0),
  crownPoints: integer('crown_points').notNull().default(0), // Only for royal_bee
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userTrackUnique: unique().on(table.userId, table.track),
  trackXpIdx: index('idx_user_ranks_track_xp').on(table.track, table.xp),
  trackCrownPointsIdx: index('idx_user_ranks_track_crown_points').on(table.track, table.crownPoints),
}));

// ============================================
// GAMES
// ============================================

export const games = sqliteTable('games', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  roomCode: text('room_code').unique(), // For private games
  mode: text('mode', { enum: gameModes }).notNull(),
  inputMethod: text('input_method', { enum: inputMethods }).notNull(),
  type: text('type', { enum: gameTypes }).notNull(),
  status: text('status', { enum: gameStatuses }).notNull().default('waiting'),

  // Multiplayer settings
  hostId: text('host_id'),
  maxPlayers: integer('max_players').notNull().default(6),
  minPlayers: integer('min_players').notNull().default(4),

  // Calculated difficulty
  averageRank: text('average_rank', { enum: rankTiers }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
}, (table) => ({
  statusTypeIdx: index('idx_games_status_type').on(table.status, table.type),
  roomCodeIdx: index('idx_games_room_code').on(table.roomCode),
}));

export const gamePlayers = sqliteTable('game_players', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // State
  hearts: integer('hearts').notNull().default(3),
  isEliminated: integer('is_eliminated', { mode: 'boolean' }).notNull().default(false),
  placement: integer('placement'), // 1st, 2nd, 3rd, etc.

  // Stats
  roundsCompleted: integer('rounds_completed').notNull().default(0),
  correctAnswers: integer('correct_answers').notNull().default(0),
  wrongAnswers: integer('wrong_answers').notNull().default(0),

  // XP earned (calculated at end)
  xpEarned: integer('xp_earned'),

  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  eliminatedAt: integer('eliminated_at', { mode: 'timestamp' }),
}, (table) => ({
  gameUserUnique: unique().on(table.gameId, table.userId),
  gameIdIdx: index('idx_game_players_game_id').on(table.gameId),
  userIdIdx: index('idx_game_players_user_id').on(table.userId),
}));

export const gameRounds = sqliteTable('game_rounds', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  roundNumber: integer('round_number').notNull(),
  wordId: text('word_id').notNull().references(() => words.id),

  // For multiplayer: whose turn
  activePlayerId: text('active_player_id'),

  // Timing
  startedAt: integer('started_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  timeLimit: integer('time_limit').notNull(), // seconds

  // Result
  answer: text('answer'),
  isCorrect: integer('is_correct', { mode: 'boolean' }),
}, (table) => ({
  gameRoundUnique: unique().on(table.gameId, table.roundNumber),
  gameIdIdx: index('idx_game_rounds_game_id').on(table.gameId),
}));

// ============================================
// WORDS
// ============================================

export const words = sqliteTable('words', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  word: text('word').notNull().unique(),
  difficultyTier: integer('difficulty_tier').notNull(), // 1-7
  definition: text('definition').notNull(),
  exampleSentence: text('example_sentence').notNull(),
  audioUrl: text('audio_url').notNull(),
  partOfSpeech: text('part_of_speech').notNull(),
}, (table) => ({
  difficultyTierIdx: index('idx_words_difficulty_tier').on(table.difficultyTier),
}));

// ============================================
// SOCIAL
// ============================================

export const friendships = sqliteTable('friendships', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: text('friend_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userFriendUnique: unique().on(table.userId, table.friendId),
  userIdIdx: index('idx_friendships_user_id').on(table.userId),
  friendIdIdx: index('idx_friendships_friend_id').on(table.friendId),
}));

export const friendRequests = sqliteTable('friend_requests', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: text('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: requestStatuses }).notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  respondedAt: integer('responded_at', { mode: 'timestamp' }),
}, (table) => ({
  senderReceiverUnique: unique().on(table.senderId, table.receiverId),
  receiverStatusIdx: index('idx_friend_requests_receiver_status').on(table.receiverId, table.status),
}));

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: text('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messageType: text('message_type', { enum: presetMessages }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  readAt: integer('read_at', { mode: 'timestamp' }),
}, (table) => ({
  senderReceiverIdx: index('idx_chat_messages_sender_receiver').on(table.senderId, table.receiverId),
  receiverReadIdx: index('idx_chat_messages_receiver_read').on(table.receiverId, table.readAt),
}));

export const blocks = sqliteTable('blocks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  blockerId: text('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: text('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  blockerBlockedUnique: unique().on(table.blockerId, table.blockedId),
  blockerIdIdx: index('idx_blocks_blocker_id').on(table.blockerId),
}));

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  reporterId: text('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportedId: text('reported_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason', { enum: reportReasons }).notNull(),
  details: text('details'),
  status: text('status', { enum: reportStatuses }).notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
}, (table) => ({
  statusIdx: index('idx_reports_status').on(table.status),
}));

// ============================================
// NOTIFICATIONS
// ============================================

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: notificationTypes }).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  link: text('link'), // Where to navigate on click
  readAt: integer('read_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userReadIdx: index('idx_notifications_user_read').on(table.userId, table.readAt),
}));
```

### 4.2 Type Inference

Drizzle provides automatic type inference from the schema:

```typescript
// db/types.ts

import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as schema from './schema';

// Select types (for reading from DB)
export type User = InferSelectModel<typeof schema.users>;
export type UserRank = InferSelectModel<typeof schema.userRanks>;
export type Game = InferSelectModel<typeof schema.games>;
export type GamePlayer = InferSelectModel<typeof schema.gamePlayers>;
export type GameRound = InferSelectModel<typeof schema.gameRounds>;
export type Word = InferSelectModel<typeof schema.words>;
export type Friendship = InferSelectModel<typeof schema.friendships>;
export type FriendRequest = InferSelectModel<typeof schema.friendRequests>;
export type ChatMessage = InferSelectModel<typeof schema.chatMessages>;
export type Block = InferSelectModel<typeof schema.blocks>;
export type Report = InferSelectModel<typeof schema.reports>;
export type Notification = InferSelectModel<typeof schema.notifications>;

// Insert types (for writing to DB)
export type NewUser = InferInsertModel<typeof schema.users>;
export type NewUserRank = InferInsertModel<typeof schema.userRanks>;
export type NewGame = InferInsertModel<typeof schema.games>;
// ... etc
```

### 4.3 Database Client

```typescript
// db/index.ts

import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

// Usage in API route or Worker
export type Database = ReturnType<typeof createDb>;
```

### 4.4 Example Queries

```typescript
// Get user with ranks
const userWithRanks = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    ranks: true,
  },
});

// Get leaderboard for a track
const leaderboard = await db
  .select()
  .from(userRanks)
  .where(eq(userRanks.track, 'endless_voice'))
  .orderBy(desc(userRanks.xp))
  .limit(20);

// Create a new game
const [newGame] = await db
  .insert(games)
  .values({
    mode: 'endless',
    inputMethod: 'voice',
    type: 'online_public',
    hostId: userId,
  })
  .returning();
```

### 4.5 Database Indexes Rationale

| Index | Purpose |
|-------|---------|
| `users.username` | Fast lookup for profile pages, search |
| `user_ranks[track, xp]` | Leaderboard queries sorted by XP |
| `user_ranks[track, crown_points]` | Bee Keeper determination |
| `games[status, type]` | Find active public games for matchmaking |
| `game_players[game_id]` | Get all players in a game |
| `notifications[user_id, read_at]` | Unread notifications count |

### 4.6 Data Retention Strategy

Based on research of competitive games (Valorant, Chess.com, Duolingo), PlayLexi uses a **hybrid retention model** combining permanent career stats with rolling game history.

**Retention Tiers:**

| Data Type | Retention | Storage | Rationale |
|-----------|-----------|---------|-----------|
| **User profiles** | Permanent | D1 | Core identity, never expires |
| **Career stats** (total XP, games played, best scores) | Permanent | D1 | Like Chess.com - players expect lifetime stats |
| **Streaks** | Permanent | D1 | Key engagement metric (Duolingo model) |
| **Game summaries** (score, WPM, placement) | 2 years | D1 | Like Valorant match history |
| **Raw game data** (word-by-word details) | 90 days | D1 | Enough for disputes, anti-cheat review |
| **Live leaderboard** | Real-time | KV/Redis | Updated per game |
| **Weekly leaderboard** | 1 week active | D1 | Duolingo-style weekly leagues |
| **Monthly season leaderboard** | Archive after season | D1 | Competitive seasons |
| **Archived games (90+ days)** | 2+ years | R2 (cold) | Compliance, rare access |

**Storage Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA RETENTION TIERS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  HOT (0-72 hours)                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Cloudflare KV / Workers KV                                          │    │
│  │  • Live leaderboard rankings (Redis Sorted Set equivalent)           │    │
│  │  • Active session data                                               │    │
│  │  • Real-time game state                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  WARM (3-90 days)                  │                                         │
│  ┌─────────────────────────────────▼───────────────────────────────────┐    │
│  │  Cloudflare D1 (SQLite)                                              │    │
│  │  • Recent game records with full details                             │    │
│  │  • User profiles and career stats                                    │    │
│  │  • Weekly/monthly leaderboard snapshots                              │    │
│  │  • Friend relationships and notifications                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  COLD (90+ days)                   │                                         │
│  ┌─────────────────────────────────▼───────────────────────────────────┐    │
│  │  Cloudflare R2 (Object Storage)                                      │    │
│  │  • Archived game data (JSON exports)                                 │    │
│  │  • Historical leaderboard snapshots                                  │    │
│  │  • Compliance/audit data                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Seasonal Model (Inspired by Valorant/Duolingo):**

| Period | Reset | What Persists |
|--------|-------|---------------|
| **Weekly** | Every Sunday | Leaderboard position resets, XP persists |
| **Monthly Season** | 1st of month | Season rank archived, career stats persist |
| **Annual** | Never | Career stats never reset |

**Why This Model:**

1. **Engagement through resets**: Weekly leaderboard resets (like Duolingo) give new players a chance to compete
2. **Long-term investment**: Permanent career stats (like Chess.com) reward dedication
3. **Storage efficiency**: 90-day raw data retention reduces D1 costs
4. **GDPR compliance**: Clear retention periods, data export available

**Migration/Archival Process:**

```sql
-- Nightly job: Archive games older than 90 days
-- 1. Export to R2 as JSON
-- 2. Delete raw game_rounds data
-- 3. Keep game summary in games table
```

---

## 5. API Routes

### 5.1 Auth Routes

| Method | Route | Purpose |
|--------|-------|---------|
| * | `/api/auth/[...nextauth]` | NextAuth.js handler |

### 5.2 User Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/users/me` | Get current user |
| PATCH | `/api/users/me` | Update profile |
| GET | `/api/users/[userId]` | Get user by ID |
| GET | `/api/users/search?q=` | Search users by username |
| POST | `/api/users/check-username` | Check username availability |

### 5.3 Game Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/games` | Create new game |
| GET | `/api/games/[gameId]` | Get game state |
| POST | `/api/games/[gameId]/join` | Join game lobby |
| POST | `/api/games/[gameId]/start` | Start game (host only) |
| POST | `/api/games/[gameId]/submit` | Submit answer |
| POST | `/api/games/[gameId]/leave` | Leave game |

### 5.4 Matchmaking Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/matchmaking/find` | Find public match |
| DELETE | `/api/matchmaking/cancel` | Cancel matchmaking |

### 5.5 Friends Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/friends` | Get friends list |
| POST | `/api/friends/request` | Send friend request |
| GET | `/api/friends/requests` | Get pending requests |
| POST | `/api/friends/requests/[id]/accept` | Accept request |
| POST | `/api/friends/requests/[id]/decline` | Decline request |
| DELETE | `/api/friends/[friendId]` | Unfriend |

### 5.6 Leaderboard Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/leaderboard/global` | Global rankings |
| GET | `/api/leaderboard/friends` | Friends rankings |
| GET | `/api/leaderboard/solo` | Personal history |

### 5.7 Other Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/words/random` | Get word for round |
| WS | `ws://localhost:3002` | Speech recognition (Google Cloud via WebSocket) |
| GET | `/api/notifications` | Get notifications |
| PATCH | `/api/notifications/[id]/read` | Mark as read |
| POST | `/api/chat/send` | Send preset message |
| POST | `/api/reports` | Submit report |
| POST | `/api/blocks` | Block user |

---

## 6. State Management

### 6.1 Philosophy

**Server state:** React Query (TanStack Query)
**Client state:** React Context + useReducer for complex state, Zustand for global state

### 6.2 What Goes Where

| State | Location | Rationale |
|-------|----------|-----------|
| User session | NextAuth | Auth is server-managed |
| User profile | React Query | Server state, cached |
| Game state | WebSocket + Local | Real-time, optimistic updates |
| UI state (modals, etc.) | Local useState | Component-scoped |
| Theme | Context | App-wide, persisted |
| Notifications | React Query + WebSocket | Server state with real-time updates |

### 6.3 Game State Structure

```typescript
// types/game.ts

interface GameState {
  // Game info
  id: string;
  mode: 'ENDLESS' | 'BLITZ';
  inputMethod: 'VOICE' | 'KEYBOARD';
  status: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED';

  // Current round
  round: number;
  currentWord: Word | null;
  timeRemaining: number; // seconds

  // Players (multiplayer)
  players: PlayerState[];
  currentPlayerId: string | null;

  // Self
  myHearts: number;
  myAnswer: string;
  isMyTurn: boolean;
  isEliminated: boolean;

  // Results
  placement: number | null;
  xpEarned: number | null;
}

interface PlayerState {
  id: string;
  username: string;
  avatarId: number;
  hearts: number;
  isEliminated: boolean;
  roundsCompleted: number;
  accuracy: number;
  placement: number | null;
}

interface Word {
  id: string;
  audioUrl: string;
  definition: string;
  exampleSentence: string;
  difficultyTier: number;
  // Note: actual word is NOT sent to client until they need to check
}
```

---

## 7. Real-Time Architecture

### 7.1 Technology Choice

**Cloudflare Durable Objects** — native WebSocket support with persistent state per game room.

### 7.2 Durable Object Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Edge                          │
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Player 1  │     │   Player 2  │     │   Player 3  │   │
│  │  (Browser)  │     │  (Browser)  │     │  (Browser)  │   │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘   │
│         │                   │                   │           │
│         └───────────────────┼───────────────────┘           │
│                             │                               │
│                    WebSocket Connection                     │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  Durable Object │                      │
│                    │   (Game Room)   │                      │
│                    │                 │                      │
│                    │  - Game state   │                      │
│                    │  - Player list  │                      │
│                    │  - Turn order   │                      │
│                    │  - Timer logic  │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │       D1        │                      │
│                    │   (Database)    │                      │
│                    └─────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Game Room Durable Object

```typescript
// workers/game-room.ts

export class GameRoom implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, PlayerSession> = new Map();
  private gameState: GameState | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      await this.handleSession(server, url);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response('Expected WebSocket', { status: 400 });
  }

  private async handleSession(ws: WebSocket, url: URL) {
    ws.accept();

    const playerId = url.searchParams.get('playerId');
    const session: PlayerSession = { playerId, ws };
    this.sessions.set(ws, session);

    ws.addEventListener('message', (event) => {
      this.handleMessage(session, event.data);
    });

    ws.addEventListener('close', () => {
      this.sessions.delete(ws);
      this.handlePlayerDisconnect(playerId);
    });
  }

  private broadcast(message: GameEvent, exclude?: string) {
    const data = JSON.stringify(message);
    for (const [ws, session] of this.sessions) {
      if (session.playerId !== exclude) {
        ws.send(data);
      }
    }
  }
}
```

### 7.4 Events

#### Server → Client

| Event | Payload | When |
|-------|---------|------|
| `player:joined` | Player info | Someone joins lobby |
| `player:left` | Player ID | Someone leaves |
| `player:reconnected` | Player ID | Player rejoined within 60s window |
| `game:starting` | Countdown | Host starts game |
| `game:started` | Initial state | Countdown finished |
| `round:start` | Word ID, time limit | New round begins |
| `turn:changed` | Player ID | Next player's turn (multiplayer) |
| `answer:submitted` | Player ID, correct/wrong | Someone answered |
| `player:eliminated` | Player ID, placement | Lost all hearts |
| `game:finished` | Final results | Game over |
| `error` | Error message | Something went wrong |

#### Client → Server

| Event | Payload | When |
|-------|---------|------|
| `game:join` | Room code, player ID | Joining lobby |
| `game:leave` | - | Leaving |
| `game:ready` | - | Ready to start |
| `answer:submit` | Answer string | Submitting answer |
| `ping` | - | Keep-alive (every 30s) |

### 7.5 Reconnection Handling

```typescript
// Durable Object handles reconnection gracefully
private async handlePlayerDisconnect(playerId: string) {
  const player = this.gameState?.players.find(p => p.id === playerId);
  if (!player) return;

  player.disconnectedAt = Date.now();
  player.isDisconnected = true;

  // Start 60-second countdown
  this.state.storage.setAlarm(Date.now() + 60_000, {
    type: 'disconnect_timeout',
    playerId,
  });

  this.broadcast({
    type: 'player:disconnected',
    playerId,
    rejoinWindowMs: 60_000,
  });
}

async alarm() {
  const alarmData = await this.state.storage.getAlarm();
  if (alarmData?.type === 'disconnect_timeout') {
    // Player didn't rejoin in time — eliminate them
    this.eliminatePlayer(alarmData.playerId);
  }
}
```

### 7.6 Room Naming Convention

| Room Type | Durable Object Name | Example |
|-----------|--------------------| --------|
| Private lobby | `lobby:{roomCode}` | `lobby:BEE42` |
| Public matchmaking | `matchmaking:{track}:{tierRange}` | `matchmaking:ENDLESS_VOICE:1-3` |
| Active game | `game:{gameId}` | `game:clx123abc` |

---

## 8. Voice Recognition

### 8.1 Architecture Overview

The voice input system follows a **single-hook, provider-abstraction** pattern with Google Cloud Speech-to-Text as the primary provider.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BROWSER                                             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     useSpeechRecognition (Hook)                         │ │
│  │                                                                         │ │
│  │  Responsibilities:                                                      │ │
│  │  • Request microphone permission                                        │ │
│  │  • Create MediaStream + AudioContext                                    │ │
│  │  • Create AnalyserNode (for visualization)                              │ │
│  │  • Convert Float32 audio to LINEAR16                                    │ │
│  │  • Manage WebSocket connection to speech server                         │ │
│  │  • Track word timing for anti-cheat                                     │ │
│  │  • Return real-time transcript + anti-cheat metrics                     │ │
│  │                                                                         │ │
│  │  Returns: { analyserNode, isRecording, transcript, provider,            │ │
│  │            startRecording, stopRecording (async), speechDurationMs }    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │              SpeechRecognitionService (Provider Factory)                │ │
│  │                    lib/speech-recognition-service.ts                    │ │
│  │                                                                         │ │
│  │  Provider Priority:                                                     │ │
│  │  1. Google Cloud Speech-to-Text (if speech server running)              │ │
│  │  2. Web Speech API (browser fallback, no anti-cheat)                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                 ┌──────────────────┴──────────────────┐                      │
│                 ▼                                     ▼                      │
│  ┌──────────────────────────┐         ┌──────────────────────────┐          │
│  │   GoogleSpeechProvider   │         │   WebSpeechProvider      │          │
│  │   (lib/providers/        │         │   (fallback, inline)     │          │
│  │    google-speech-        │         │   - Free                 │          │
│  │    provider.ts)          │         │   - ~70-80% accuracy     │          │
│  │   - WebSocket client     │         │   - NO word timing       │          │
│  │   - LINEAR16 encoding    │         │   - NO anti-cheat        │          │
│  │   - Word timing parsing  │         └──────────────────────────┘          │
│  │   - Anti-cheat analysis  │                                               │
│  └──────────────────────────┘                                               │
│                 │                                                            │
│                 │ WebSocket (ws://localhost:3002)                            │
│                 │ - Audio: Binary frames (LINEAR16, 16kHz)                   │
│                 │ - Control: JSON messages (start/stop)                      │
│                 │ - Results: JSON (interim/final with word timing)           │
│                 ▼                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SPEECH SERVER (Node.js)                                │
│                          speech-server/                                      │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    index.ts (WebSocket Server)                          │ │
│  │                                                                         │ │
│  │  • Accepts WebSocket connections on port 3002                           │ │
│  │  • Creates gRPC streaming session per connection                        │ │
│  │  • Forwards audio to Google Speech API                                  │ │
│  │  • Streams results back to client                                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │               google-streaming.ts (gRPC Client)                         │ │
│  │                                                                         │ │
│  │  • Creates @google-cloud/speech client                                  │ │
│  │  • Bidirectional gRPC streaming                                         │ │
│  │  • Speech context: Letter names + phonetic pronunciations               │ │
│  │  • Word-level timestamps (enableWordTimeOffsets: true)                  │ │
│  │  • Model: "latest_short" with enhanced=true                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    │ gRPC (bidirectional streaming)          │
│                                    ▼                                         │
│              ┌──────────────────────────────────────┐                        │
│              │   Google Cloud Speech-to-Text API    │                        │
│              └──────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why this architecture:**

| Principle | Implementation |
|-----------|----------------|
| Single Source of Truth | Hook owns entire audio pipeline, refs track anti-cheat state |
| Provider Abstraction | Easy to switch between Google/Web Speech, add new providers |
| Separation of Concerns | Visualization (waveform) separate from transcription |
| Anti-Cheat Integrity | Server-side word timing analysis, cannot be bypassed |
| Real-Time Feedback | ~100-250ms latency via gRPC streaming |

### 8.2 Provider Selection (lib/speech-recognition-service.ts)

```typescript
// Provider types - simplified after removing Azure/Deepgram
export type SpeechProvider = "web-speech" | "google"

// Provider interface
export interface ISpeechRecognitionProvider {
  name: SpeechProvider
  isSupported: () => boolean
  start: (config: SpeechRecognitionConfig) => Promise<SpeechRecognitionSession>
}

// Async provider selection (checks Google server availability)
export async function getSpeechProviderAsync(): Promise<ISpeechRecognitionProvider>
// Returns Google if speech server is running, else Web Speech API
```

**Provider Priority:**
1. **Google Cloud Speech-to-Text** (if `npm run dev:speech` is running)
2. **Web Speech API** (free fallback, no anti-cheat)

### 8.3 Google Speech Provider (Primary)

Located at `lib/providers/google-speech-provider.ts`:

**Features:**
- Real-time streaming via WebSocket → gRPC
- Word-level timestamps (critical for anti-cheat)
- Speech context boosting for letter names
- ~100-250ms latency
- Multi-signal anti-cheat analysis

**Audio Configuration:**
```typescript
const AUDIO_CONFIG = {
  sampleRate: 16000,    // 16kHz as required by Google
  channelCount: 1,       // Mono
  chunkIntervalMs: 100,  // Send audio every 100ms for low latency
}
```

**Speech Context (in speech-server/google-streaming.ts):**
```typescript
const SPEECH_CONTEXT = {
  phrases: [
    // Individual letters
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    // Phonetic names
    "ay", "bee", "cee", "dee", "ee", "eff", "gee", "aitch",
    "eye", "jay", "kay", "ell", "em", "en", "oh", "pee",
    "cue", "are", "ess", "tee", "you", "vee",
    "double you", "double-u", "ex", "why", "zee", "zed",
  ],
  boost: 20,
}
```

### 8.4 Web Speech API Provider (Fallback)

Built into `lib/speech-recognition-service.ts` as `WebSpeechProvider`:

- **Cost**: Free
- **Accuracy**: ~70-80% (lower for letter-by-letter spelling)
- **Word Timing**: ❌ NOT supported
- **Anti-Cheat**: ❌ NOT available (no word timing data)
- **Use Case**: Development without Google credentials, offline fallback

**Warning logged when falling back:**
```
[SpeechRecognition] Google Speech server not available!
Falling back to Web Speech API. Anti-cheat word timing will NOT be available.
Run 'npm run dev:speech' to start the Google Speech server.
```

### 8.5 Anti-Cheat: Spelling vs Saying Detection

The anti-cheat system uses **multiple signals** from Google's word-level timestamps to detect if a player spelled the word or just said it.

**Signals Analyzed:**

| Signal | Spelling Pattern | Saying Pattern |
|--------|------------------|----------------|
| **Word count** | Multiple (one per letter) | Single word |
| **Single-letter word ratio** | High (>50%) | Low |
| **Gaps between words** | 80-500ms pauses | No gaps |
| **Duration per letter** | ≥0.15s/letter | <0.10s/letter |

**Implementation (in google-speech-provider.ts lines 313-457):**

```typescript
// Key thresholds (empirically derived from testing)
const MIN_SECONDS_PER_LETTER = 0.15  // Minimum time per letter for spelling

// Examples from testing:
// SPELLED words:
//   "cat" (3 letters): 1.50s → 0.50s/letter ✅
//   "garden" (6 letters): 1.80s → 0.30s/letter ✅
// SAID words (should be rejected):
//   "dangerous" (9 letters): 0.80s → 0.09s/letter ❌
//   "beautiful" (9 letters): 0.60s → 0.07s/letter ❌
```

**Verdict Logic:**
```typescript
if (wordCount === 0) {
  isSpelledOut = true  // No words detected - trust user
} else if (isSingleWordTooFast) {
  isSpelledOut = false  // Single word spoken too fast - REJECT
} else if (hasMultipleWords && (hasMostlySingleLetters || wordCountMatchesLetters)) {
  isSpelledOut = true  // Multiple words with spelling characteristics - PASS
} else if (hasMultipleWords && hasSignificantGaps) {
  isSpelledOut = true  // Multiple words with pauses - PASS
} else if (wordCount === 1 && letterCount >= 3) {
  isSpelledOut = durationPerLetter >= MIN_SECONDS_PER_LETTER  // Check timing
} else {
  isSpelledOut = true  // Default: trust user
}
```

### 8.6 useSpeechRecognition Hook

Located at `hooks/use-speech-recognition.ts`:

```typescript
export interface UseSpeechRecognitionReturn {
  isRecording: boolean
  startRecording: () => Promise<void>
  stopRecording: () => Promise<StopRecordingMetrics>  // Now async!
  transcript: string
  clearTranscript: () => void
  analyserNode: AnalyserNode | null
  isSupported: boolean
  provider: SpeechProvider | null
  error: Error | null
  speechDurationMs: number
  getCurrentSpeechDuration: () => number
  interimResultCount: number
}

export interface StopRecordingMetrics {
  durationMs: number
  interimCount: number
  letterTimings: LetterTiming[]
  averageLetterGapMs: number
  looksLikeSpelling: boolean
  // Audio-level timing (from Google - MORE RELIABLE)
  audioWordTimings: AudioWordTiming[]
  audioWordCount: number
  avgAudioGapSec: number
  looksLikeSpellingFromAudio: boolean  // PRIMARY anti-cheat signal
}
```

**Critical: Async stopRecording()**

The `stopRecording()` method is now async and waits for the FINAL result from Google before returning metrics. This is essential because word timing data only arrives with the final result.

```typescript
const cleanup = React.useCallback(async (): Promise<StopRecordingMetrics> => {
  // Stop the session - triggers Google to send FINAL result
  if (sessionRef.current) {
    sessionRef.current.stop()
  }

  // Wait for FINAL result (with 2s timeout)
  if (!finalResultReceived) {
    await new Promise<void>((resolve) => {
      finalResultResolverRef.current = resolve
      setTimeout(() => resolve(), 2000)  // Timeout
    })
  }

  // Now we have word timing data for anti-cheat
  return metrics
}, [])
```

### 8.7 UI Components (Unchanged)

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `VoiceWaveform` | `components/ui/voice-waveform.tsx` | Draw frequency bars from AnalyserNode |
| `SpeechInput` | `components/ui/speech-input.tsx` | Presentational voice input with waveform |

Both components are purely presentational and unchanged from previous implementation.

### 8.8 Speech Server

Located at `speech-server/`:

| File | Purpose |
|------|---------|
| `index.ts` | WebSocket server (port 3002), connection handling |
| `google-streaming.ts` | gRPC client, streaming session management |
| `types.ts` | TypeScript interfaces for messages |

**Running:**
```bash
# Development (both servers)
npm run dev:all

# Or separately
npm run dev          # Next.js on port 3000
npm run dev:speech   # Speech server on port 3002
```

**Environment Variables (in .env.local):**
```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### 8.9 Error Handling

| Scenario | Handling |
|----------|----------|
| Speech server not running | Fall back to Web Speech API with warning |
| WebSocket connection timeout | Error: "Is the speech server running? (npm run dev:speech)" |
| Microphone permission denied | Error passed to onError callback |
| Google API error | Error forwarded to client via WebSocket |
| No audio detected | Empty transcript returned (not an error) |

### 8.10 Production Deployment

For production, the speech server must be deployed to a platform that supports:
1. WebSocket connections
2. Outbound gRPC calls to Google

**Scaling Strategy (Decision: January 2025):**

| Phase | Scale | Platform | Monthly Cost |
|-------|-------|----------|--------------|
| Phase 1 | 0-1K DAU | Railway | $5-50 |
| Phase 2 | 1K+ DAU | Cloud Run | $65+ |

**Phase 1: Railway** (Start here)
- Simple deployment, no cold starts
- Up to ~3,000 concurrent connections

**Phase 2: Cloud Run** (When scaling requires)
- Native gRPC support (same network as Google Speech API)
- Auto-scaling based on connections
- Min instances = 1 to eliminate cold starts

See [speech-server/DEPLOYMENT.md](../speech-server/DEPLOYMENT.md) for deployment instructions.

---

## 9. Authentication

### 9.1 NextAuth Configuration

```typescript
// lib/auth.ts

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { createDb } from '@/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Note: DrizzleAdapter requires passing the db instance
  // For D1, the db is created per-request with the D1 binding
  adapter: DrizzleAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        username: user.username,
      },
    }),
  },
  pages: {
    signIn: '/login',
    newUser: '/onboarding/profile',
  },
});
```

### 9.2 Protected Routes

```typescript
// middleware.ts

export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: [
    '/play/:path*',
    '/game/:path*',
    '/leaderboard/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/chat/:path*',
  ],
};
```

---

## 10. Design System

### 10.1 Existing Components

The project already has shadcn/ui components. Use these as primitives:

- Button (variants: default, destructive, outline, ghost)
- Card
- Input
- Avatar
- Badge
- Progress
- Tabs
- Table
- Dialog
- Separator

### 10.2 Custom Components to Build

| Component | Priority | Complexity |
|-----------|----------|------------|
| VoiceWaveform | High | High |
| HeartsDisplay | High | Low |
| RankBadge | High | Low |
| PlayerStandingsSidebar | High | Medium |
| GameTimer | High | Medium |
| TutorialCard | Medium | Low |
| PresetMessagePills | Medium | Low |
| SkeletonRow | Medium | Low |

### 10.3 Theme Variables

The project uses **OKLCH color space** for perceptually uniform colors. All tokens are defined in `app/globals.css`.

**Source Files (always reference these when implementing):**
- **[STYLE_GUIDE.md](STYLE_GUIDE.md)** — Component patterns, border radius, icon imports
- **[app/globals.css](../app/globals.css)** — CSS variables, color tokens, focus rings
- **[lib/icons.ts](../lib/icons.ts)** — Centralized icon imports

**Key Color Tokens:**

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--primary` | `oklch(0.852 0.199 91.936)` | same | PlayLexi yellow |
| `--primary-hover` | `oklch(0.78 0.16 91.936)` | same | Button hover |
| `--destructive` | `oklch(0.58 0.22 27)` | `oklch(0.58 0.22 27)` | Hearts, errors |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Text |
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Page background |
| `--focus-ring-color` | `oklch(0.5 0.25 252)` | `oklch(0.6 0.25 252)` | Focus rings |

**Rule:** Never use arbitrary hex/rgb colors. Always use semantic tokens via CSS variables.

---

## 11. Testing Strategy

### 11.1 Test Types

| Type | Tool | Coverage |
|------|------|----------|
| Unit | Vitest | Utils, hooks, pure functions |
| Component | Testing Library | UI components |
| Integration | Vitest + MSW | API routes, database |
| E2E | Playwright | Critical user flows |

### 11.2 Critical Paths to Test

1. **New user onboarding:** Tutorial → Placement → Signup → Profile
2. **Game flow:** Start → Play rounds → Win/Lose → Results
3. **Multiplayer:** Create → Join → Play → Elimination → Results
4. **XP calculation:** Verify correct XP for various placements/scenarios
5. **Voice transcription:** Audio → Text accuracy

---

## 12. Deployment

### 12.1 Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| Development | Local dev | localhost:3000 (wrangler dev) |
| Preview | PR previews | pr-{n}.playlexi.pages.dev |
| Staging | Pre-production | staging.playlexi.com |
| Production | Live | playlexi.com |

### 12.2 Cloudflare Infrastructure

| Service | Cloudflare Product | Purpose |
|---------|-------------------|---------|
| Frontend/API | Workers | Next.js hosting via OpenNext (`@opennextjs/cloudflare`) |
| Database | D1 | SQLite-based serverless database |
| Real-time | Durable Objects | WebSocket connections, game state |
| File Storage | R2 | Audio files, avatars (S3-compatible) |
| KV Storage | Workers KV | Session tokens, cache |
| Queues | Queues | Background jobs (XP calculations, notifications) |

**Note:** Speech recognition runs on Google Cloud Run (see Section 1.3 Hybrid Architecture), not Workers AI.

### 12.3 Cloudflare Configuration

```jsonc
// wrangler.jsonc

{
  "name": "playlexi",
  "compatibility_date": "2024-01-01",

  // D1 Database
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "playlexi-db",
      "database_id": "xxx-xxx-xxx"
    }
  ],

  // R2 Bucket
  "r2_buckets": [
    {
      "binding": "R2_ASSETS",
      "bucket_name": "playlexi-assets"
    }
  ],

  // Durable Objects (for multiplayer)
  "durable_objects": {
    "bindings": [
      { "name": "GAME_ROOMS", "class_name": "GameRoom" },
      { "name": "MATCHMAKING", "class_name": "MatchmakingQueue" }
    ]
  },

  // KV Namespace
  "kv_namespaces": [
    {
      "binding": "SESSIONS",
      "id": "xxx-xxx-xxx"
    }
  ],

  // Environment variables
  "vars": {
    "ENVIRONMENT": "production"
  }
}
```

### 12.4 Environment Variables

```bash
# .dev.vars (local development, git-ignored)

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
APPLE_CLIENT_ID="..."
APPLE_CLIENT_SECRET="..."

# Analytics
POSTHOG_KEY="phc_..."
SENTRY_DSN="https://..."

# External Services (if needed)
MERRIAM_WEBSTER_API_KEY="..." # Only for word seeding, not runtime
```

### 12.5 Deployment Pipeline

```yaml
# .github/workflows/deploy.yml

name: Deploy to Cloudflare

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

### 12.6 Database Migrations

```bash
# Run migrations locally
wrangler d1 migrations apply playlexi-db --local

# Run migrations on production
wrangler d1 migrations apply playlexi-db --remote

# Create new migration
wrangler d1 migrations create playlexi-db "add_crown_points"
```

---

## Appendix A: File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `VoiceWaveform.tsx` |
| Hooks | camelCase with `use` prefix | `useGameState.ts` |
| Utils | camelCase | `calculateXp.ts` |
| Types | PascalCase | `GameState.ts` |
| API routes | kebab-case folders | `api/games/[gameId]/route.ts` |
| Pages | kebab-case folders | `app/play/single/endless/page.tsx` |

---

## Appendix B: Git Workflow

```
main
  └── develop
        ├── feature/game-ui
        ├── feature/multiplayer
        ├── feature/voice-recognition
        └── fix/xp-calculation
```

- `main` — production, protected
- `develop` — integration branch
- `feature/*` — new features
- `fix/*` — bug fixes

PRs require:
- Passing tests
- Code review
- No merge conflicts

---

## 13. Security Considerations

### 13.1 Authentication Security

| Concern | Mitigation |
|---------|------------|
| Session hijacking | HTTP-only, Secure, SameSite=Strict cookies |
| Token exposure | Never store tokens in localStorage; use encrypted cookies |
| OAuth vulnerabilities | Validate state parameter, use PKCE for public clients |
| Session expiry | 7-day refresh token, 15-minute access token |

### 13.2 Input Validation

```typescript
// lib/validators.ts
import { z } from 'zod';

export const usernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores')
  .refine((val) => !profanityList.includes(val.toLowerCase()), 'Username not allowed');

export const answerSchema = z
  .string()
  .max(50)
  .regex(/^[a-zA-Z]+$/, 'Letters only');

export const roomCodeSchema = z
  .string()
  .length(5)
  .regex(/^[A-Z0-9]+$/, 'Invalid room code');
```

### 13.3 API Security

| Protection | Implementation |
|------------|----------------|
| Rate limiting | Cloudflare rate limiting rules (100 req/min per IP) |
| CORS | Strict origin whitelist (playlexi.com only) |
| CSRF | Double-submit cookie pattern |
| SQL injection | Drizzle ORM parameterized queries |
| XSS | React auto-escaping, CSP headers |

### 13.4 Content Security Policy

```typescript
// middleware.ts
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.posthog.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://playlexi.r2.cloudflarestorage.com;
  font-src 'self';
  connect-src 'self' https://*.cloudflare.com wss://*.cloudflare.com https://posthog.com;
  media-src 'self' https://playlexi.r2.cloudflarestorage.com;
  frame-ancestors 'none';
`;
```

### 13.5 Game Security

| Attack Vector | Prevention |
|---------------|------------|
| Answer spoofing | Server validates answers; word not sent to client until round ends |
| Timer manipulation | Server-authoritative timers via Durable Objects |
| Multiple submissions | Deduplicate within 2-second window, reject after round ends |
| XP manipulation | All XP calculations happen server-side |
| Room code brute-force | 5-character alphanumeric = 60M+ combinations; rate limit joins |

### 13.6 Voice Data Security

| Rule | Implementation |
|------|----------------|
| No storage | Audio processed in-memory, never written to disk |
| Encryption | TLS for WebSocket + gRPC audio transmission |
| Google Cloud | Speech-to-Text API — audio streamed, not stored |
| Immediate deletion | Buffer cleared after transcription returns |

---

## 14. Error Handling Strategy

### 14.1 Error Types

```typescript
// lib/errors.ts

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'AUTH_ERROR', 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('Too many requests', 'RATE_LIMIT', 429);
  }
}

export class GameError extends AppError {
  constructor(message: string, code: string) {
    super(message, code, 400);
  }
}
```

### 14.2 API Error Responses

```typescript
// Standard error response format
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>; // For validation errors
  };
}

// Example responses
// 400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {
      "username": ["Must be at least 3 characters"]
    }
  }
}

// 401 Unauthorized
{
  "error": {
    "code": "AUTH_ERROR",
    "message": "Session expired"
  }
}

// 404 Not Found
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Game not found"
  }
}
```

### 14.3 Client-Side Error Handling

```typescript
// hooks/use-error-handler.ts

export function useErrorHandler() {
  const { toast } = useToast();

  const handleError = useCallback((error: unknown) => {
    if (error instanceof Response) {
      error.json().then((data) => {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error?.message || 'Something went wrong',
        });
      });
    } else if (error instanceof Error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }

    // Log to Sentry
    Sentry.captureException(error);
  }, [toast]);

  return { handleError };
}
```

### 14.4 Error Recovery Strategies

| Scenario | Recovery |
|----------|----------|
| WebSocket disconnect | Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s) |
| API request failure | Retry 3 times with backoff, then show error |
| Voice transcription failure | Show "We didn't hear that" message, allow retry |
| Game state desync | Request full state refresh from Durable Object |
| Database write failure | Queue for retry, notify user if persistent |

---

## 15. Performance Guidelines

### 15.1 Bundle Size Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial JS bundle | < 100KB gzipped | Lighthouse |
| First Contentful Paint | < 1.5s | Lighthouse |
| Time to Interactive | < 3s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |

### 15.2 Code Splitting Strategy

```typescript
// Dynamic imports for non-critical features
const SpeechInputWrapper = dynamic(() => import('@/components/game/speech-input-wrapper'), {
  loading: () => <SpeechInputSkeleton />,
  ssr: false, // Browser-only feature (uses Web Audio API)
});

const SettingsDialog = dynamic(() => import('@/components/settings-dialog'));
const ChatWindow = dynamic(() => import('@/components/chat/chat-window'));
```

### 15.3 Caching Strategy

| Resource | Cache Duration | Strategy |
|----------|---------------|----------|
| Static assets (JS, CSS, images) | 1 year | Immutable, content-hashed |
| Word audio files | 1 year | R2 with CDN caching |
| Leaderboard data | 5 minutes | ISR with stale-while-revalidate |
| User profile | 1 minute | React Query with background refresh |
| Game state | Real-time | No caching, WebSocket |

### 15.4 Database Query Optimization

```sql
-- Use indexes for common queries
CREATE INDEX idx_user_rank_track_xp ON user_ranks(track, xp DESC);
CREATE INDEX idx_games_status_type ON games(status, type);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at);

-- Pagination for leaderboards
SELECT * FROM user_ranks
WHERE track = ?
ORDER BY xp DESC
LIMIT 20 OFFSET ?;
```

### 15.5 Real-Time Performance

| Metric | Target |
|--------|--------|
| WebSocket message latency | < 100ms |
| Game state update frequency | 60 updates/second max |
| Reconnection time | < 2 seconds |
| Durable Object cold start | < 50ms |

---

## 16. Accessibility Requirements

### 16.1 WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | 4.5:1 minimum for text |
| Keyboard navigation | All interactive elements focusable |
| Screen reader support | Proper ARIA labels |
| Focus indicators | Visible focus rings |
| Reduced motion | Respect `prefers-reduced-motion` |

### 16.2 Game-Specific Accessibility

| Feature | Accessibility Consideration |
|---------|----------------------------|
| Voice input | Keyboard alternative always available |
| Timer | Audio cues at 10s, 5s, 1s; visual countdown |
| Waveform animation | Static fallback for reduced motion |
| Hearts display | Text alternative ("2 of 3 hearts remaining") |
| Turn indicator | Screen reader announcement ("It's your turn") |

### 16.3 ARIA Implementation

```tsx
// Example: Hearts display
<div
  role="status"
  aria-live="polite"
  aria-label={`${hearts} of 3 hearts remaining`}
>
  {[...Array(3)].map((_, i) => (
    <Heart
      key={i}
      filled={i < hearts}
      aria-hidden="true" // Visual only, status announced above
    />
  ))}
</div>

// Example: Game timer
<div
  role="timer"
  aria-live="off" // Don't announce every second
  aria-label={`${seconds} seconds remaining`}
>
  <Progress value={(seconds / maxSeconds) * 100} />
</div>
```

### 16.4 Focus Management

```typescript
// Auto-focus input when it's player's turn
useEffect(() => {
  if (isMyTurn && inputRef.current) {
    inputRef.current.focus();
    announceToScreenReader("It's your turn. Spell the word.");
  }
}, [isMyTurn]);

// Trap focus in modal dialogs
<Dialog onOpenChange={setOpen}>
  <DialogContent aria-describedby="dialog-description">
    {/* Content */}
  </DialogContent>
</Dialog>
```

### 16.5 Testing Accessibility

```typescript
// tests/accessibility.spec.ts
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('game screen has no accessibility violations', async () => {
  const { container } = render(<GameScreen />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 17. Observability

### 17.1 Analytics (PostHog)

```typescript
// lib/analytics.ts
import posthog from 'posthog-js';

export const analytics = {
  init() {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: 'https://app.posthog.com',
      capture_pageview: false, // Manual pageviews for SPA
    });
  },

  identify(userId: string, properties?: Record<string, any>) {
    posthog.identify(userId, properties);
  },

  track(event: string, properties?: Record<string, any>) {
    posthog.capture(event, properties);
  },

  page(pageName: string) {
    posthog.capture('$pageview', { page: pageName });
  },
};
```

### 17.2 Key Events to Track

| Event | Properties | Purpose |
|-------|------------|---------|
| `game_started` | mode, inputMethod, playerCount | Usage patterns |
| `game_completed` | mode, placement, duration, accuracy | Performance metrics |
| `word_attempted` | difficulty, correct, inputMethod | Word difficulty tuning |
| `voice_transcription` | success, latency | Voice feature health |
| `matchmaking_started` | track, tier | Queue analytics |
| `matchmaking_found` | waitTimeMs, tierSpread | Queue performance |

### 17.3 Error Tracking (Sentry)

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
  beforeSend(event) {
    // Don't send PII
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});

// Capture game-specific context
export function captureGameError(error: Error, gameId: string, playerId: string) {
  Sentry.withScope((scope) => {
    scope.setTag('gameId', gameId);
    scope.setTag('playerId', playerId);
    scope.setLevel('error');
    Sentry.captureException(error);
  });
}
```

### 17.4 Cloudflare Analytics

Built-in analytics for:
- Request volume and latency
- Error rates by endpoint
- Durable Object metrics
- D1 query performance

Access via Cloudflare Dashboard > Analytics.

### 17.5 Custom Dashboards

| Dashboard | Metrics |
|-----------|---------|
| Game Health | Games started, completed, error rate, avg duration |
| Voice Feature | Transcription success rate, latency p50/p95/p99 |
| Matchmaking | Queue times, tier spread, abandonment rate |
| Real-Time | WebSocket connections, message throughput, reconnects |

---

## 18. Developer Guide

### 18.1 Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/playlexi.git
cd playlexi

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials

# 4. Set up local D1 database
wrangler d1 create playlexi-db --local
wrangler d1 migrations apply playlexi-db --local

# 5. Seed the database
npm run db:seed

# 6. Start the development server
npm run dev  # Runs wrangler pages dev
```

### 18.2 Common Commands

```bash
# Development
npm run dev              # Start dev server with Wrangler
npm run build            # Build for production
npm run preview          # Preview production build locally

# Database
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Apply migrations locally
npm run db:migrate:prod  # Apply migrations to production
npm run db:seed          # Seed word database
npm run db:studio        # Open Drizzle Studio

# Testing
npm run test             # Run unit tests
npm run test:e2e         # Run Playwright tests
npm run test:coverage    # Generate coverage report

# Code Quality
npm run lint             # ESLint
npm run lint:fix         # Fix ESLint issues
npm run typecheck        # TypeScript check
npm run format           # Prettier

# Deployment
npm run deploy:preview   # Deploy to preview environment
npm run deploy:staging   # Deploy to staging
npm run deploy:prod      # Deploy to production
```

### 18.3 Project Conventions

**File naming:**
- Components: `PascalCase.tsx` (e.g., `VoiceWaveform.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-game-state.ts`)
- Utils: `kebab-case.ts` (e.g., `calculate-xp.ts`)
- Types: `kebab-case.ts` in `types/` folder

**Code style:**
- Functional components with TypeScript
- Named exports (no default exports except pages)
- Props interfaces defined inline or in same file
- Use `cn()` utility for conditional classes

**Commit messages:**
```
feat: add voice input component
fix: correct XP calculation for mixed-tier lobbies
docs: update PRD with Crown Points rules
refactor: extract game timer hook
test: add unit tests for matchmaking
chore: update dependencies
```

### 18.4 Adding a New Feature

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Update the database (if needed)**
   ```bash
   # Create migration
   wrangler d1 migrations create playlexi-db "add_feature_table"
   # Edit the migration file, then apply
   wrangler d1 migrations apply playlexi-db --local
   ```

3. **Create types**
   ```typescript
   // types/feature.ts
   export interface FeatureData {
     id: string;
     // ...
   }
   ```

4. **Add API routes**
   ```typescript
   // app/api/feature/route.ts
   export async function GET(request: Request) {
     // Implementation
   }
   ```

5. **Create components**
   ```typescript
   // components/feature/feature-component.tsx
   export function FeatureComponent({ data }: { data: FeatureData }) {
     // Implementation
   }
   ```

6. **Add tests**
   ```typescript
   // tests/unit/feature.test.ts
   // tests/e2e/feature.spec.ts
   ```

7. **Update documentation**
   - Add to PRD.md if user-facing
   - Add to ARCHITECTURE.md if technical

8. **Create PR**
   - Reference any related issues
   - Include test results
   - Request review

### 18.5 Troubleshooting

| Issue | Solution |
|-------|----------|
| Wrangler not connecting to D1 | Run `wrangler login` and check `.dev.vars` |
| WebSocket not connecting locally | Ensure Durable Objects are enabled in `wrangler.jsonc` |
| Type errors after DB change | Run `npm run db:generate` to update Drizzle types |
| Tests failing on CI | Check if migrations were applied to test database |
| Build fails on Cloudflare | Ensure all imports are edge-compatible |

### 18.6 Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

## 19. Architecture Decision Records

> **📄 Full ADRs have been moved to [ADR.md](ADR.md)**
>
> This section provides a summary of all architecture decisions. See the dedicated ADR document for full context, rationale, and consequences.

### ADR Summary

| ADR | Title | Status | Date | Summary |
|-----|-------|--------|------|---------|
| 001 | Drizzle ORM over Prisma | Accepted | Dec 2025 | Native D1 support, no binary dependencies |
| 002 | Cloudflare Durable Objects for Real-Time | Accepted | Dec 2025 | Native WebSocket support per game room |
| 003 | Wrapper Components over Extended Props | Accepted | Dec 2025 | Domain logic in wrappers, not generic components |
| 004 | Single Hook for Voice Pipeline | Accepted | Dec 2025 | `useSpeechRecognition` owns entire audio pipeline |
| 005 | Presentational vs Smart Component Separation | Accepted | Dec 2025 | `components/ui/` = presentational, `components/game/` = smart |
| 006 | Strict Voice Recognition (No Edit Mode) | Accepted | Dec 2025 | What speech recognizer hears is final |
| 007 | Pre-Cached Word Database | Accepted | Dec 2025 | Zero MW API calls during gameplay |
| 008 | Hybrid Input System | Proposed | Jan 2026 | Keyboard default, voice optional with generous matching |
| 009 | Google Cloud Speech-to-Text | Accepted | Jan 2026 | Best letter recognition, word-level timestamps |
| 010 | Per-Letter Duration Anti-Cheat | Accepted | Jan 2026 | 0.15s/letter minimum threshold |
| 011 | Merriam-Webster API Integration | Proposed | Jan 2026 | Learner's Dictionary with pre-caching |
| 012 | Hidden Skill Rating System (Glicko-2) | Proposed | Jan 2026 | Hidden rating for word selection/matchmaking |
| 013 | Adaptive Placement Test | Accepted | Jan 2026 | 10-15 word Bayesian placement, no hearts |

**→ [View full ADRs with context and rationale](ADR.md)**

<!-- Full ADR content (ADR-001 through ADR-013) moved to ADR.md -->

---

## 20. Implementation Roadmap

This section defines the phased approach for building PlayLexi. Each phase is a vertical slice — complete, testable functionality rather than building all components first, then all APIs, etc.

### 20.1 Local-First Development Strategy

**Decision:** Build with local mocks first, swap in real services later.

This approach unblocks development immediately and isolates problems. The architecture is designed so swapping from local to production requires minimal code changes.

| Service | Local Implementation | Production Implementation | When to Switch |
|---------|---------------------|---------------------------|----------------|
| **Database** | Local SQLite via `better-sqlite3` | Cloudflare D1 | After Phase 2 tested |
| **Auth** | Mock auth (hardcoded dev user) | Google + Apple OAuth | After Phase 2 tested |
| **Words** | Hardcoded seed data (50+ words) | Merriam-Webster API seeding | Before Phase 3 |
| **Voice AI** | Google Speech via local WebSocket server | Google Speech via Railway → Cloud Run | After Phase 2 tested |
| **Real-time** | Local state (no WebSocket) | Cloudflare Durable Objects | Phase 4 |

**Why this works:**
- Drizzle ORM uses the same API for SQLite and D1 — zero code changes
- Auth middleware checks `session` object — mock or real, same interface
- Voice hook returns `transcript` — source doesn't matter to components

**Post-Local Migration Checklist:**

After Phase 2 is working locally, complete these before Phase 3:

- [ ] Create Cloudflare D1 database (`wrangler d1 create playlexi-db`)
- [ ] Set up Google OAuth (Google Cloud Console → OAuth credentials)
- [ ] Set up Apple OAuth (Apple Developer account required)
- [ ] Get Merriam-Webster API key (dictionaryapi.com)
- [ ] Seed production database with real word data
- [ ] Configure `wrangler.jsonc` with D1 binding
- [ ] Deploy to Cloudflare Workers for testing

---

### 20.2 Phase Overview

| Phase | Name | Goal | Dependencies |
|-------|------|------|--------------|
| 1 | Foundation | Database, auth, basic layout | None |
| 2 | Solo Endless MVP | Playable single-player game | Phase 1 |
| 3 | Onboarding | New user flow with placement | Phase 2 |
| 4 | Multiplayer | Real-time competitive play | Phase 2 |
| 5 | Social & Polish | Friends, chat, leaderboards | Phase 4 |

### 20.3 Phase 1: Foundation (Local)

**Goal:** Project infrastructure that all features depend on. Using local mocks per Section 20.1.

| Task | Type | Details | Status |
|------|------|---------|--------|
| 1.1 | Database | Drizzle schema from Section 4, local SQLite setup | Not Started |
| 1.2 | Database | Run migrations locally, verify tables | Not Started |
| 1.3 | Database | Seed words table (50+ words across 7 tiers, hardcoded) | Not Started |
| 1.4 | Auth | Mock auth provider (hardcoded dev user, skip OAuth) | Not Started |
| 1.5 | Auth | Protected route middleware (works with mock session) | Not Started |
| 1.6 | Layout | Navbar already done ✓ | Done |
| 1.7 | Layout | Main app layout with auth gate | Not Started |
| 1.8 | API | `/api/words/random` — get word by difficulty tier | Not Started |
| 1.9 | API | `/api/users/me` — get/update current user | Not Started |

**Exit Criteria (Local):**
- [ ] Mock user can "sign in" (dev bypass)
- [ ] Protected routes redirect when not authenticated
- [ ] Can query random words by tier from local SQLite
- [ ] Database migrations run successfully locally

---

### 20.4 Phase 2: Solo Endless MVP (Local)

**Goal:** A playable single-player Endless mode game.

**Documents to Reference:**
- STYLE_GUIDE.md — UI patterns, icons, border radius
- COMPONENT_INVENTORY.md — Component specs and status
- PRD.md Section 4.1.1 — Endless mode rules

| Task | Type | Details | Status |
|------|------|---------|--------|
| 2.1 | Hook | `useSpeechRecognition` — mic access, AnalyserNode, Google/Web Speech API | ✅ Done |
| 2.1b | Service | `SpeechRecognitionService` — provider abstraction for speech-to-text | ✅ Done |
| 2.2 | Hook | `useGameTimer` — countdown with warning/critical states | ✅ Done |
| 2.2b | Hook | `useGameFeedback` — overlay state and timing | ✅ Done |
| 2.2c | Hook | `useGameSounds` — audio playback for game sounds | ✅ Done |
| 2.3 | Component | `SpeechInput` — presentational voice input with VoiceWaveform + helper buttons | ✅ Done |
| 2.4 | Component | `KeyboardInput` — text input alternative (mode="keyboard" in SpeechInput) | ✅ Done |
| 2.5 | Component | `GameTimer` — wrapper around Progress with timer logic | ✅ Done |
| 2.6 | Component | `HeartsDisplay` — 3 hearts with loss animation | ✅ Done |
| 2.6b | Component | `GameFeedbackOverlay` — correct/wrong answer flash overlay | ✅ Done |
| 2.7 | Component | `RoundIndicator` — "Round 1" badge | ✗ Removed (inline text, not a component) |
| 2.9 | API | Speech recognition via Google WebSocket server | ✅ Done (client-side) |
| 2.10 | API | `/api/games` — create solo game session | Not Started |
| 2.11 | API | `/api/games/[gameId]/submit` — submit answer, check correctness | Not Started |
| 2.12 | Page | `/play/single/endless/page.tsx` — mode selection | Not Started |
| 2.13 | Page | `/game/[gameId]/page.tsx` — game screen | Not Started |
| 2.14 | Page | `/game/[gameId]/results/page.tsx` — end screen with stats | Not Started |
| 2.15 | Logic | Game state machine (ready → playing → round → result → next/end) | Not Started |
| 2.16 | Logic | XP calculation for solo games (+5 XP per round) | Not Started |

**Exit Criteria:**
- [ ] Can start an Endless game
- [ ] Can spell words via voice OR keyboard
- [ ] Timer counts down with visual states
- [ ] Hearts decrease on wrong answers
- [ ] Game ends when hearts = 0
- [ ] Results screen shows rounds completed and XP earned

---

### 20.5 Phase 3: Onboarding

**Goal:** New users can complete tutorial, placement test, and create profile.

**Documents to Reference:**
- PRD.md Section 2.2 — New user flow details

| Task | Type | Details | Status |
|------|------|---------|--------|
| 3.1 | Component | `TutorialCard` — step card with progress bar | Not Started |
| 3.2 | Component | `TutorialStep` — individual step content | Not Started |
| 3.3 | Component | `RankBadge` — tier badge (7 variants × 2 modes) | ✅ Done |
| 3.4 | Component | `RankReveal` — animation showing earned rank | Not Started |
| 3.5 | Component | `ProfileCompletionForm` — username, age, avatar | Not Started |
| 3.6 | Page | `/onboarding/tutorial/page.tsx` — 4-step tutorial | Not Started |
| 3.7 | Page | `/onboarding/placement/page.tsx` — adaptive placement test (no hearts) | Not Started |
| 3.8 | Page | `/onboarding/rank-result/page.tsx` — rank assignment | Not Started |
| 3.9 | Page | `/onboarding/profile/page.tsx` — profile form | Not Started |
| 3.10 | Logic | Placement algorithm (Bayesian tier estimation) | Not Started |
| 3.11 | API | `/api/users/check-username` — availability check | Not Started |
| 3.12 | API | Update user profile after OAuth | Not Started |

**Exit Criteria:**
- [ ] New user sees 4-step tutorial on first visit
- [ ] Tutorial Step 4 teaches hearts mechanic
- [ ] Can skip or complete tutorial
- [ ] Placement test (no hearts) determines starting rank via Bayesian inference
- [ ] Rank reveal shows appropriate tier badge
- [ ] Profile completion validates unique username
- [ ] User lands on main app after completion

---

### 20.6 Phase 4: Multiplayer

**Goal:** Real-time multiplayer games with lobby and matchmaking.

**Documents to Reference:**
- ARCHITECTURE.md Section 7 — Durable Objects architecture
- PRD.md Section 5 — Multiplayer rules

| Task | Type | Details | Status |
|------|------|---------|--------|
| 4.1 | Infrastructure | Durable Object: `GameRoom` class | Not Started |
| 4.2 | Infrastructure | Durable Object: `MatchmakingQueue` class | Not Started |
| 4.3 | Hook | `useGameState` — WebSocket connection to Durable Object | Not Started |
| 4.4 | Hook | `useMatchmaking` — queue state, tier expansion | Not Started |
| 4.5 | Component | `PlayerStandingsSidebar` — collapsible player list | Not Started |
| 4.6 | Component | `PlayerRow` — individual player in standings | Not Started |
| 4.7 | Component | `LobbyPlayerList` — pre-game player cards | Not Started |
| 4.8 | Component | `RoomCodeDisplay` — large code with copy button | Not Started |
| 4.9 | Component | `MatchmakingSpinner` — queue animation with timer | Not Started |
| 4.10 | Component | `GameCountdown` — 3-2-1 animation | Not Started |
| 4.11 | Component | `CurrentPlayerIndicator` — avatar above waveform | Not Started |
| 4.12 | Page | `/play/multiplayer/local/page.tsx` — create local room | Not Started |
| 4.13 | Page | `/play/multiplayer/online/private/page.tsx` — create private room | Not Started |
| 4.14 | Page | `/play/multiplayer/online/public/page.tsx` — matchmaking | Not Started |
| 4.15 | Page | `/play/multiplayer/lobby/[roomCode]/page.tsx` — lobby | Not Started |
| 4.16 | Logic | Turn-based game flow | Not Started |
| 4.17 | Logic | Elimination and placement | Not Started |
| 4.18 | Logic | Reconnection handling (60s window) | Not Started |
| 4.19 | Logic | XP calculation with weighted modifiers | Not Started |

**Exit Criteria:**
- [ ] Can create and join private rooms via code
- [ ] Matchmaking finds players within tier range
- [ ] Real-time turn updates via WebSocket
- [ ] Players see each other's status (hearts, rounds)
- [ ] Elimination redirects to results with live updates
- [ ] Reconnection works within 60s window

---

### 20.7 Phase 5: Social & Polish

**Goal:** Friends, chat, leaderboards, and profile features.

| Task | Type | Details | Status |
|------|------|---------|--------|
| 5.1 | Component | `FriendsList` — widget with search | Not Started |
| 5.2 | Component | `FriendRow` — avatar, name, online status | Not Started |
| 5.3 | Component | `FriendRequestCard` — accept/decline | Not Started |
| 5.4 | Component | `PresetMessagePill` — chat bubbles | Not Started |
| 5.5 | Component | `ChatWindow` — 1:1 preset message chat | Not Started |
| 5.6 | Component | `LeaderboardTable` — ranked player table | Not Started |
| 5.7 | Component | `LeaderboardFilters` — mode/input toggles | Not Started |
| 5.8 | Component | `NotificationBell` — bell with badge | Not Started |
| 5.9 | Component | `ProfileHeader` — avatar, username, stats | Not Started |
| 5.10 | Component | `RankCards` — 4 track progress cards | Not Started |
| 5.11 | Component | `MatchHistoryTable` — past games | Not Started |
| 5.12 | Page | `/leaderboard/page.tsx` — with tabs | Not Started |
| 5.13 | Page | `/profile/page.tsx` — own profile | Not Started |
| 5.14 | Page | `/profile/[username]/page.tsx` — other profiles | Not Started |
| 5.15 | Page | `/settings/page.tsx` — user settings | Not Started |
| 5.16 | Page | `/chat/[friendId]/page.tsx` — chat | Not Started |
| 5.17 | API | Friends CRUD routes | Not Started |
| 5.18 | API | Leaderboard routes (global, friends, solo) | Not Started |
| 5.19 | API | Notifications routes | Not Started |
| 5.20 | API | Chat/messaging routes | Not Started |
| 5.21 | Logic | Crown Points system (Royal Bees) | Not Started |
| 5.22 | Logic | Bee Keeper determination per track | Not Started |

**Exit Criteria:**
- [ ] Can send/accept friend requests
- [ ] Can chat with friends via preset messages
- [ ] Leaderboards show global, friends, and solo tabs
- [ ] Profile shows all 4 rank tracks
- [ ] Settings allow theme and notification preferences
- [ ] Crown Points tracked for Royal Bees

---

### 20.8 Implementation Guidelines

When starting each phase:

1. **Read the relevant docs first:**
   - Phase 1-2: ARCHITECTURE.md Sections 4, 5, 8, 10
   - Phase 2 UI: STYLE_GUIDE.md, COMPONENT_INVENTORY.md
   - Phase 4: ARCHITECTURE.md Section 7

2. **Update COMPONENT_INVENTORY.md** as you implement:
   - Mark components "In Progress" when starting
   - Mark "Done" when complete and tested

3. **Follow the design system:**
   - Icons from `lib/icons.ts` only
   - Colors from CSS variables only
   - Border radius per STYLE_GUIDE.md scale

4. **Test each phase before moving on:**
   - Manual testing of all exit criteria
   - Unit tests for hooks and utilities
   - Update this roadmap with completion status

---

### 20.9 Progress Tracking

Update this section as phases complete:

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1 - Foundation | Not Started | — | — | — |
| 2 - Solo Endless MVP | Not Started | — | — | — |
| 3 - Onboarding | Not Started | — | — | — |
| 4 - Multiplayer | Not Started | — | — | — |
| 5 - Social & Polish | Not Started | — | — | — |

---

*End of Architecture Document*
