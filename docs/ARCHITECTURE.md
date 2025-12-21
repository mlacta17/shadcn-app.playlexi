# PlayLexi — Technical Architecture

> **Version:** 1.0
> **Last Updated:** December 21, 2025
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

---

## 1. Tech Stack

### 1.1 Core Technologies

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Next.js 14+ (App Router) | Server components, API routes, built-in optimization |
| **Language** | TypeScript | Type safety, better DX, catch errors early |
| **Styling** | Tailwind CSS + CSS Variables | Already in design system, utility-first, themeable |
| **UI Components** | shadcn/ui | Already in project, accessible, customizable |
| **Database** | PostgreSQL | Relational data (users, games, friendships), proven at scale |
| **ORM** | Prisma | Type-safe queries, migrations, great DX |
| **Auth** | NextAuth.js | OAuth providers, session management |
| **Real-time** | Socket.io or Pusher | Multiplayer state sync |
| **Voice** | OpenAI Whisper (self-hosted) | High accuracy, self-hosted for cost control |
| **Hosting** | Vercel + Railway/Supabase | Easy deployment, managed Postgres |

### 1.2 Why These Choices

**Next.js App Router:**
- Server components reduce client bundle
- API routes keep backend in same repo (monolith-first)
- Great caching and ISR for leaderboards

**PostgreSQL over MongoDB:**
- Relational data: users have friends, games have players, players have ranks
- Complex queries for leaderboards, matchmaking
- ACID transactions for XP calculations

**Prisma:**
- Type safety matches TypeScript
- Migrations are version-controlled
- Query builder prevents SQL injection

---

## 2. Project Structure

```
playlexi/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth-related pages (grouped, no layout impact)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── onboarding/           # New user flow
│   │       ├── tutorial/
│   │       │   └── page.tsx
│   │       ├── placement/
│   │       │   └── page.tsx
│   │       ├── rank-result/
│   │       │   └── page.tsx
│   │       └── complete-profile/
│   │           └── page.tsx
│   │
│   ├── (main)/                   # Main app (requires auth)
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
│   ├── db.ts                     # Prisma client
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
│   ├── use-voice-recognition.ts  # Whisper integration
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
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── migrations/               # Migration files
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

**`app/(auth)/` and `app/(main)/`:**
Route groups separate auth flow from main app. Different layouts, different auth requirements.

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
│       ├── VoiceInput OR KeyboardInput
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

### 4.1 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER & AUTH
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  username      String    @unique
  bio           String?
  avatarId      Int       @default(1) // 1, 2, or 3
  age           Int
  authProvider  AuthProvider
  createdAt     DateTime  @default(now())
  lastOnline    DateTime  @default(now())

  // Settings
  theme         Theme     @default(LIGHT)
  emailSocial   Boolean   @default(true)
  emailSecurity Boolean   @default(true)
  emailMarketing Boolean  @default(false)

  // Relations
  ranks         UserRank[]
  gamesPlayed   GamePlayer[]
  sentRequests  FriendRequest[] @relation("SentRequests")
  receivedRequests FriendRequest[] @relation("ReceivedRequests")
  friends       Friendship[] @relation("UserFriends")
  friendOf      Friendship[] @relation("FriendOf")
  sentMessages  ChatMessage[] @relation("SentMessages")
  receivedMessages ChatMessage[] @relation("ReceivedMessages")
  notifications Notification[]
  reports       Report[] @relation("Reporter")
  reportedBy    Report[] @relation("Reported")
  blockedUsers  Block[] @relation("Blocker")
  blockedBy     Block[] @relation("Blocked")

  @@index([username])
  @@index([email])
}

enum AuthProvider {
  GOOGLE
  APPLE
}

enum Theme {
  LIGHT
  DARK
}

// ============================================
// RANK SYSTEM
// ============================================

model UserRank {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  track         RankTrack
  tier          RankTier  @default(NEW_BEE)
  xp            Int       @default(0)
  crownPoints   Int       @default(0) // Only for ROYAL_BEE

  updatedAt     DateTime  @updatedAt

  @@unique([userId, track])
  @@index([track, xp])
  @@index([track, crownPoints])
}

enum RankTrack {
  ENDLESS_VOICE
  ENDLESS_KEYBOARD
  BLITZ_VOICE
  BLITZ_KEYBOARD
}

enum RankTier {
  NEW_BEE
  BUMBLE_BEE
  BUSY_BEE
  HONEY_BEE
  WORKER_BEE
  ROYAL_BEE
  BEE_KEEPER
}

// ============================================
// GAMES
// ============================================

model Game {
  id            String    @id @default(cuid())
  roomCode      String?   @unique // For private games

  mode          GameMode
  inputMethod   InputMethod
  type          GameType
  status        GameStatus @default(WAITING)

  // Multiplayer settings
  hostId        String?
  maxPlayers    Int       @default(6)
  minPlayers    Int       @default(4)

  // Calculated difficulty
  averageRank   RankTier?

  createdAt     DateTime  @default(now())
  startedAt     DateTime?
  endedAt       DateTime?

  // Relations
  players       GamePlayer[]
  rounds        GameRound[]

  @@index([status, type])
  @@index([roomCode])
}

enum GameMode {
  ENDLESS
  BLITZ
}

enum InputMethod {
  VOICE
  KEYBOARD
}

enum GameType {
  SINGLE
  LOCAL_MULTI
  ONLINE_PRIVATE
  ONLINE_PUBLIC
}

enum GameStatus {
  WAITING     // Lobby, waiting for players
  STARTING    // Countdown
  IN_PROGRESS
  FINISHED
}

model GamePlayer {
  id            String    @id @default(cuid())
  gameId        String
  game          Game      @relation(fields: [gameId], references: [id], onDelete: Cascade)
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // State
  hearts        Int       @default(3)
  isEliminated  Boolean   @default(false)
  placement     Int?      // 1st, 2nd, 3rd, etc.

  // Stats
  roundsCompleted Int     @default(0)
  correctAnswers  Int     @default(0)
  wrongAnswers    Int      @default(0)

  // XP earned (calculated at end)
  xpEarned      Int?

  joinedAt      DateTime  @default(now())
  eliminatedAt  DateTime?

  @@unique([gameId, userId])
  @@index([gameId])
  @@index([userId])
}

model GameRound {
  id            String    @id @default(cuid())
  gameId        String
  game          Game      @relation(fields: [gameId], references: [id], onDelete: Cascade)

  roundNumber   Int
  wordId        String
  word          Word      @relation(fields: [wordId], references: [id])

  // For multiplayer: whose turn
  activePlayerId String?

  // Timing
  startedAt     DateTime?
  endedAt       DateTime?
  timeLimit     Int       // seconds

  // Result
  answer        String?
  isCorrect     Boolean?

  @@unique([gameId, roundNumber])
  @@index([gameId])
}

// ============================================
// WORDS
// ============================================

model Word {
  id              String    @id @default(cuid())
  word            String    @unique
  difficultyTier  Int       // 1-7
  definition      String
  exampleSentence String
  audioUrl        String
  partOfSpeech    String

  // Relations
  rounds          GameRound[]

  @@index([difficultyTier])
}

// ============================================
// SOCIAL
// ============================================

model Friendship {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation("UserFriends", fields: [userId], references: [id], onDelete: Cascade)
  friendId      String
  friend        User      @relation("FriendOf", fields: [friendId], references: [id], onDelete: Cascade)
  createdAt     DateTime  @default(now())

  @@unique([userId, friendId])
  @@index([userId])
  @@index([friendId])
}

model FriendRequest {
  id            String    @id @default(cuid())
  senderId      String
  sender        User      @relation("SentRequests", fields: [senderId], references: [id], onDelete: Cascade)
  receiverId    String
  receiver      User      @relation("ReceivedRequests", fields: [receiverId], references: [id], onDelete: Cascade)
  status        RequestStatus @default(PENDING)
  createdAt     DateTime  @default(now())
  respondedAt   DateTime?

  @@unique([senderId, receiverId])
  @@index([receiverId, status])
}

enum RequestStatus {
  PENDING
  ACCEPTED
  DECLINED
}

model ChatMessage {
  id            String    @id @default(cuid())
  senderId      String
  sender        User      @relation("SentMessages", fields: [senderId], references: [id], onDelete: Cascade)
  receiverId    String
  receiver      User      @relation("ReceivedMessages", fields: [receiverId], references: [id], onDelete: Cascade)

  messageType   PresetMessage
  createdAt     DateTime  @default(now())
  readAt        DateTime?

  @@index([senderId, receiverId])
  @@index([receiverId, readAt])
}

enum PresetMessage {
  WANT_TO_PLAY
  GOOD_GAME
  REMATCH
}

model Block {
  id            String    @id @default(cuid())
  blockerId     String
  blocker       User      @relation("Blocker", fields: [blockerId], references: [id], onDelete: Cascade)
  blockedId     String
  blocked       User      @relation("Blocked", fields: [blockedId], references: [id], onDelete: Cascade)
  createdAt     DateTime  @default(now())

  @@unique([blockerId, blockedId])
  @@index([blockerId])
}

model Report {
  id            String    @id @default(cuid())
  reporterId    String
  reporter      User      @relation("Reporter", fields: [reporterId], references: [id], onDelete: Cascade)
  reportedId    String
  reported      User      @relation("Reported", fields: [reportedId], references: [id], onDelete: Cascade)

  reason        ReportReason
  details       String?
  status        ReportStatus @default(PENDING)

  createdAt     DateTime  @default(now())
  reviewedAt    DateTime?

  @@index([status])
}

enum ReportReason {
  CHEATING
  HARASSMENT
  INAPPROPRIATE_USERNAME
  OTHER
}

enum ReportStatus {
  PENDING
  REVIEWED
  ACTIONED
  DISMISSED
}

// ============================================
// NOTIFICATIONS
// ============================================

model Notification {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  type          NotificationType
  title         String
  message       String
  link          String?   // Where to navigate on click

  readAt        DateTime?
  createdAt     DateTime  @default(now())

  @@index([userId, readAt])
}

enum NotificationType {
  FRIEND_REQUEST
  FRIEND_ACCEPTED
  GAME_INVITE
  GAME_FINISHED
}
```

### 4.2 Database Indexes Rationale

| Index | Purpose |
|-------|---------|
| `User.username` | Fast lookup for profile pages, search |
| `UserRank[track, xp]` | Leaderboard queries sorted by XP |
| `UserRank[track, crownPoints]` | Bee Keeper determination |
| `Game[status, type]` | Find active public games for matchmaking |
| `GamePlayer[gameId]` | Get all players in a game |
| `Notification[userId, readAt]` | Unread notifications count |

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
| POST | `/api/voice/transcribe` | Transcribe audio via Whisper |
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

**Socket.io** for v1 (simpler), can migrate to **Pusher** or **Ably** for scale.

### 7.2 Events

#### Server → Client

| Event | Payload | When |
|-------|---------|------|
| `player:joined` | Player info | Someone joins lobby |
| `player:left` | Player ID | Someone leaves |
| `game:starting` | Countdown | Host starts game |
| `game:started` | Initial state | Countdown finished |
| `round:start` | Word ID, time limit | New round begins |
| `turn:changed` | Player ID | Next player's turn (multiplayer) |
| `answer:submitted` | Player ID, correct/wrong | Someone answered |
| `player:eliminated` | Player ID, placement | Lost all hearts |
| `game:finished` | Final results | Game over |

#### Client → Server

| Event | Payload | When |
|-------|---------|------|
| `game:join` | Room code | Joining lobby |
| `game:leave` | - | Leaving |
| `game:ready` | - | Ready to start |
| `answer:submit` | Answer string | Submitting answer |

### 7.3 Room Structure

```
rooms/
├── lobby:{roomCode}     # Pre-game lobby
└── game:{gameId}        # Active game
```

---

## 8. Voice Recognition

### 8.1 Whisper Integration

```typescript
// lib/whisper.ts

import { exec } from 'child_process';

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  // Save buffer to temp file
  const tempPath = `/tmp/${Date.now()}.webm`;
  await fs.writeFile(tempPath, audioBuffer);

  // Run Whisper CLI
  const result = await execPromise(
    `whisper ${tempPath} --model base --language en --output_format txt`
  );

  // Clean up and return
  await fs.unlink(tempPath);
  return parseWhisperOutput(result);
}
```

### 8.2 API Route

```typescript
// app/api/voice/transcribe/route.ts

export async function POST(req: Request) {
  const formData = await req.formData();
  const audio = formData.get('audio') as Blob;

  const buffer = Buffer.from(await audio.arrayBuffer());
  const transcription = await transcribeAudio(buffer);

  return Response.json({
    text: transcription,
    // No confidence score exposed to prevent gaming
  });
}
```

### 8.3 Client Hook

```typescript
// hooks/use-voice-recognition.ts

export function useVoiceRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);

    const chunks: Blob[] = [];
    mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const result = await submitAudio(blob);
      setTranscript(result.text);
    };

    mediaRecorder.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  return { isRecording, transcript, startRecording, stopRecording };
}
```

---

## 9. Authentication

### 9.1 NextAuth Configuration

```typescript
// lib/auth.ts

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from './db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
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
    newUser: '/onboarding/complete-profile',
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

Already using CSS variables for theming. Key tokens:

```css
:root {
  --primary: #fcb040;        /* PlayLexi orange/yellow */
  --background: white;
  --foreground: #0a0a0a;
  --muted: #f5f5f5;
  --muted-foreground: #737373;
  --destructive: #dc2626;    /* Red for hearts, errors */
  /* ... existing shadcn tokens */
}

.dark {
  --background: #0a0a0a;
  --foreground: #fafafa;
  /* ... */
}
```

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
| Development | Local dev | localhost:3000 |
| Preview | PR previews | pr-{n}.playlexi.vercel.app |
| Staging | Pre-production | staging.playlexi.com |
| Production | Live | playlexi.com |

### 12.2 Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| Frontend/API | Vercel | Next.js hosting |
| Database | Railway or Supabase | PostgreSQL |
| Whisper | Self-hosted (Railway) or Replicate | Voice transcription |
| File Storage | Vercel Blob or S3 | Audio files, avatars |
| WebSocket | Upstash Redis + Socket.io | Real-time |

### 12.3 Environment Variables

```bash
# .env.example

# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
APPLE_CLIENT_ID="..."
APPLE_CLIENT_SECRET="..."

# Whisper
WHISPER_API_URL="http://localhost:9000"

# Real-time
REDIS_URL="redis://..."

# Storage
BLOB_READ_WRITE_TOKEN="..."
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

*End of Architecture Document*
