# PlayLexi — Architecture Decision Records (ADRs)

> **Last Updated:** January 24, 2026
> **Purpose:** Track significant architectural decisions made during the project.

This document is extracted from ARCHITECTURE.md Section 19 to make decisions easier to find and reference.

---

## Table of Contents

1. [ADR-001: Drizzle ORM over Prisma](#adr-001-drizzle-orm-over-prisma)
2. [ADR-002: Cloudflare Durable Objects for Real-Time](#adr-002-cloudflare-durable-objects-for-real-time)
3. [ADR-003: Wrapper Components over Extended Props](#adr-003-wrapper-components-over-extended-props)
4. [ADR-004: Single Hook for Voice Pipeline](#adr-004-single-hook-for-voice-pipeline)
5. [ADR-005: Presentational vs Smart Component Separation](#adr-005-presentational-vs-smart-component-separation)
6. [ADR-006: Strict Voice Recognition (No Edit Mode)](#adr-006-strict-voice-recognition-no-edit-mode)
7. [ADR-007: Pre-Cached Word Database](#adr-007-pre-cached-word-database)
8. [ADR-008: Hybrid Input System (Keyboard-First, Voice-Optional)](#adr-008-hybrid-input-system-keyboard-first-voice-optional)
9. [ADR-009: Google Cloud Speech-to-Text over Deepgram](#adr-009-google-cloud-speech-to-text-over-deepgram)
10. [ADR-010: Per-Letter Duration Anti-Cheat](#adr-010-per-letter-duration-anti-cheat)
11. [ADR-011: Merriam-Webster API Integration](#adr-011-merriam-webster-api-integration)
12. [ADR-012: Hidden Skill Rating System (Glicko-2)](#adr-012-hidden-skill-rating-system-glicko-2)
13. [ADR-013: Adaptive Placement Test](#adr-013-adaptive-placement-test)
14. [ADR-014: Solo vs Multiplayer Progression Systems](#adr-014-solo-vs-multiplayer-progression-systems)
15. [Template for New ADRs](#template-for-new-adrs)

---

## ADR-001: Drizzle ORM over Prisma

| Field | Value |
|-------|-------|
| **Date** | December 21, 2025 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** We need an ORM for Cloudflare D1 (SQLite) that runs on edge runtime.

**Decision:** Use Drizzle ORM instead of Prisma.

**Rationale:**
- Drizzle has native D1 driver support
- No binary dependencies (works on Cloudflare edge)
- Lighter weight, faster cold starts
- TypeScript-first with similar DX to Prisma

**Consequences:**
- Different query syntax than Prisma (SQL-like)
- Smaller ecosystem and community
- Must use Drizzle-specific migration tooling

---

## ADR-002: Cloudflare Durable Objects for Real-Time

| Field | Value |
|-------|-------|
| **Date** | December 21, 2025 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** Need WebSocket support for multiplayer games with persistent state per game room.

**Decision:** Use Cloudflare Durable Objects instead of external services (Socket.io, Pusher, Ably).

**Rationale:**
- Native Cloudflare integration (single platform)
- Each game room is a Durable Object with built-in WebSocket support
- State persists across connections (handles disconnects gracefully)
- Automatic scaling per game room
- No additional service costs

**Consequences:**
- Tied to Cloudflare platform
- Different programming model than traditional WebSocket servers
- Must handle Durable Object lifecycle (hibernation, alarms)

---

## ADR-003: Wrapper Components over Extended Props

| Field | Value |
|-------|-------|
| **Date** | December 21, 2025 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** GameTimer needs countdown logic, color states (normal → warning → critical), and ARIA labels. Should we extend the existing Progress component or create a wrapper?

**Decision:** Create domain-specific wrapper components rather than adding game-specific props to generic components.

**Rationale:**
- Generic components (Progress, Input) stay generic and reusable
- Domain logic isolated in game-specific wrappers
- Easier for junior developers to understand
- Better testability — wrapper can be tested independently
- Follows single responsibility principle

**Consequences:**
- More files in the codebase
- Must maintain wrapper when underlying component changes
- Clear separation between UI primitives and domain components

**Example:**
```tsx
// GameTimer wraps Progress
function GameTimer({ totalSeconds, remainingSeconds }: GameTimerProps) {
  const state = remainingSeconds <= 5 ? "critical" : remainingSeconds <= 10 ? "warning" : "normal"
  return <Progress value={(remainingSeconds / totalSeconds) * 100} data-state={state} />
}
```

---

## ADR-004: Single Hook for Voice Pipeline

| Field | Value |
|-------|-------|
| **Date** | December 21, 2025 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** Voice input requires: (1) microphone access, (2) audio visualization via AnalyserNode, (3) recording, (4) speech-to-text transcription. Should each concern have its own hook, or one hook that owns the entire pipeline?

**Decision:** One hook (`useSpeechRecognition`) owns the entire audio pipeline with provider abstraction; multiple components consume from it.

**Rationale:**
- Single source of truth for audio state
- VoiceWaveform and SpeechInput stay in sync automatically
- No risk of two hooks fighting over the same MediaStream
- Clear separation: hook handles logic, components handle UI
- Easier to test — mock one hook, not three
- Provider abstraction allows switching between Google Cloud Speech (~95%+ accuracy) and Web Speech API (fallback)

**Consequences:**
- Hook is larger and more complex
- Must expose multiple return values for different consumers
- VoiceWaveform becomes purely presentational (just takes AnalyserNode prop)
- SpeechInput integrates VoiceWaveform internally when `analyserNode` prop provided

**Architecture:**
```
useSpeechRecognition (owns audio pipeline + provider selection)
    │
    ├── analyserNode → SpeechInput (presentational, includes VoiceWaveform)
    │
    └── transcript, isRecording, etc. → SpeechInput props
```

---

## ADR-005: Presentational vs Smart Component Separation

| Field | Value |
|-------|-------|
| **Date** | December 21, 2025 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** Need a clear pattern for component organization that junior developers can follow.

**Decision:** Enforce strict separation between presentational and smart components based on folder location.

**Rationale:**
- Clear mental model for developers
- Presentational components are easier to test (no mocking)
- Smart components encapsulate complexity
- Follows React community best practices

**Rules:**
| Type | Location | Characteristics |
|------|----------|-----------------|
| Presentational | `components/ui/` | No hooks, no side effects, just props → UI |
| Smart | `components/game/`, etc. | Uses hooks, manages state, composes other components |

**Consequences:**
- Must think about component type before creating
- Some components may need to be split
- Clear import boundaries

---

## ADR-006: Strict Voice Recognition (No Edit Mode)

| Field | Value |
|-------|-------|
| **Date** | December 21, 2025 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** What happens when speech recognition transcribes incorrectly? Should we allow players to edit?

**Decision:** Strict mode — what the speech recognizer hears is final. No editing allowed.

**Rationale:**
- Allowing edits on low confidence is exploitable (mumble intentionally to get keyboard fallback)
- Simpler UX — no "did you mean?" flows
- Fair competition — everyone has the same rules
- Voice input is inherently a different skill than typing

**Consequences:**
- Players may lose due to transcription errors
- Must clearly communicate this in onboarding
- Keyboard alternative is always available for those who prefer it

---

## ADR-007: Pre-Cached Word Database

| Field | Value |
|-------|-------|
| **Date** | December 21, 2025 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** Merriam-Webster API has rate limits (1,000/day free tier) and requires commercial license for revenue-generating apps.

**Decision:** Pre-fetch and cache all word data during development. Zero API calls during gameplay.

**Rationale:**
- No runtime dependency on external API
- No rate limit concerns
- Faster word retrieval (database query vs API call)
- One-time commercial license negotiation, not per-request

**Consequences:**
- Must maintain word database
- Adding new words requires seeding process
- Audio files must be cached in R2
- Database grows with word count

---

## ADR-008: Hybrid Input System (Keyboard-First, Voice-Optional)

| Field | Value |
|-------|-------|
| **Date** | January 11, 2026 |
| **Status** | Proposed |
| **Deciders** | Project team |

**Context:** Letter-by-letter voice spelling ("C-A-T") has fundamental accuracy limitations:

1. **Speech Recognition Limitations:**
   - Single letters sound like common words ("R" → "are", "U" → "you")
   - Fast spellers outpace speech recognition's ability to segment letters
   - Background noise significantly impacts single-letter detection
   - Even premium providers (~95% accuracy) struggle with letter sequences

2. **Technical Constraints:**
   - Building custom speech-to-letter recognition would require:
     - ML model training ($1M+ compute, millions of hours of labeled audio)
     - Specialized inference infrastructure (GPU clusters)
     - Years of R&D (comparable to Siri/Alexa development)
   - These constraints are fundamental to ML, not solvable with code optimization

3. **User Experience Goals:**
   - Voice-first vision for accessibility and fun factor
   - Snappy, responsive gameplay
   - Accurate scoring (no frustrating false negatives)
   - Scalable to competitive/leaderboard contexts

**Decision:** Implement a hybrid input system:

1. **Keyboard as Default** — Fast, accurate, competitive-ready
2. **Voice as Optional Enhancement** — Fun, accessible, with generous matching
3. **Player Choice** — Select input mode before starting a game session

**Implementation Plan:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Game Start Screen                            │
│                                                                  │
│   Choose your input method:                                      │
│                                                                  │
│   ┌──────────────────┐    ┌──────────────────┐                  │
│   │    ⌨️ Keyboard    │    │    🎤 Voice       │                  │
│   │    (Recommended)  │    │    (Experimental) │                  │
│   │                   │    │                   │                  │
│   │  • Fast & accurate│    │  • Say letters OR │                  │
│   │  • Best for       │    │    the whole word │                  │
│   │    competitive    │    │  • More forgiving │                  │
│   └──────────────────┘    └──────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Voice Mode Behavior (Generous Matching):**

```typescript
// Accept EITHER spelled letters OR the spoken word
function validateVoiceAnswer(transcript: string, targetWord: string): boolean {
  // 1. Try letter extraction: "see ay tea" → "cat"
  const extractedLetters = extractLettersFromVoice(transcript)
  if (extractedLetters.toLowerCase() === targetWord.toLowerCase()) {
    return true
  }

  // 2. Try direct word match: "cat" → "cat"
  const normalizedTranscript = transcript.toLowerCase().trim()
  if (normalizedTranscript === targetWord.toLowerCase()) {
    return true
  }

  // 3. Fuzzy match for close pronunciations
  if (levenshteinDistance(normalizedTranscript, targetWord) <= 1) {
    return true
  }

  return false
}
```

**Keyboard Mode Behavior (Strict):**
- Standard text input
- Must type exact letters
- No fuzzy matching (strict equality)
- Suitable for leaderboards and competitive play

**Rationale:**
- Keyboard-first respects the accuracy limitations of current speech technology
- Voice-optional preserves the accessible, fun experience vision
- Generous voice matching (accept spelled OR spoken word) reduces frustration
- Clear mode separation allows fair competitive play (keyboard leaderboards)
- Scalable — can improve voice accuracy over time without breaking core game

**Consequences:**
- Two input paths to maintain and test
- Voice mode may feel "easier" (accepting whole words)
- Must clearly communicate mode differences to players
- Leaderboards may need to be segmented by input mode

**Future Enhancements:**
- Voice-only leaderboards for players who master letter spelling
- Difficulty settings for voice mode (strict vs generous)
- Voice training mode to practice letter pronunciation

---

## ADR-009: Google Cloud Speech-to-Text over Deepgram

| Field | Value |
|-------|-------|
| **Date** | January 17, 2026 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** We need a speech recognition provider that excels at letter-by-letter spelling detection AND provides word-level timestamps for anti-cheat verification.

**Alternatives Evaluated:**

| Provider | Cost/min | Letter Accuracy | Word Timing | Anti-Cheat | Verdict |
|----------|----------|-----------------|-------------|------------|---------|
| Google Cloud | $0.016 | Excellent | ✅ Yes | ✅ Yes | **Selected** |
| Deepgram | $0.0077 | Good | ✅ Yes | ✅ Yes | Too aggressive word interpretation |
| Azure Speech | $0.016 | Good | ✅ Yes | ✅ Yes | Removed after testing |
| Web Speech API | Free | Poor | ❌ No | ❌ No | Fallback only |

**Decision:** Use Google Cloud Speech-to-Text as the primary provider via a dedicated WebSocket server.

**Rationale:**
1. **Best letter recognition** — Google's `latest_short` model with speech context boosting accurately recognizes individual letters
2. **Word-level timestamps** — Enables reliable anti-cheat by measuring actual speech duration per letter
3. **gRPC streaming** — Sub-250ms latency for real-time feedback
4. **Speech context** — Phrase list boosting improves recognition of letter names ("ay", "bee", "cee")

**Consequences:**
- Requires a separate WebSocket server (Next.js App Router doesn't support WebSockets)
- Hybrid cloud architecture needed (Cloudflare Workers can't make outbound gRPC calls)
- Higher cost than Deepgram (~2x), but better accuracy justifies it
- More operational complexity (two services to deploy)

---

## ADR-010: Per-Letter Duration Anti-Cheat

| Field | Value |
|-------|-------|
| **Date** | January 17, 2026 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** Players were bypassing anti-cheat by saying words quickly. A fixed 0.8s duration threshold didn't scale with word length — "dangerous" (9 letters, 0.80s) passed while being said, not spelled.

**Decision:** Implement per-letter duration checking with a minimum threshold of **0.15 seconds per letter**.

**Empirical Data:**

| Word | Letters | Duration | Per-Letter | Result |
|------|---------|----------|------------|--------|
| "cat" (spelled) | 3 | 1.50s | 0.50s/letter | ✅ Pass |
| "garden" (spelled) | 6 | 1.80s | 0.30s/letter | ✅ Pass |
| "dangerous" (said) | 9 | 0.80s | 0.09s/letter | ❌ Reject |
| "beautiful" (said) | 9 | 0.60s | 0.07s/letter | ❌ Reject |

**Threshold Derivation:**
- Fastest observed spelling: ~0.20s/letter (very fast spellers)
- Typical saying speed: ~0.08-0.10s/letter
- Chosen threshold: **0.15s/letter** (generous buffer for fast spellers)

**Implementation:**
```typescript
const MIN_SECONDS_PER_LETTER = 0.15
const expectedMinDuration = letterCount * MIN_SECONDS_PER_LETTER
const isSingleWordTooFast = wordCount === 1 &&
  letterCount >= 3 &&
  totalDuration < expectedMinDuration
```

**Consequences:**
- More reliable detection across all word lengths
- May occasionally reject very fast legitimate spellers (rare)
- Requires final result before metrics (stopRecording is now async)

---

## ADR-011: Merriam-Webster API Integration

| Field | Value |
|-------|-------|
| **Date** | January 17, 2026 |
| **Status** | Proposed |
| **Deciders** | Project team |

**Context:** Need authoritative word data (definitions, example sentences, audio pronunciations) for the spelling game.

**Decision:** Use Merriam-Webster Learner's Dictionary API with pre-caching strategy.

**Why Learner's Dictionary (not Collegiate):**

| Feature | Collegiate | Learner's | Decision |
|---------|------------|-----------|----------|
| Target audience | Native speakers | ESL learners | Learner's (simpler definitions) |
| Example sentences | 113,000 | 160,000+ | Learner's |
| Core vocabulary flagged | No | Yes (3,000 words) | Learner's |
| Definition clarity | Technical | Simplified | Learner's (better for kids) |

**Integration Architecture:**

```
DEVELOPMENT PHASE (Seeding):
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  scripts/seed-words.ts                                           │
│         │                                                        │
│         │ 1. Query MW API (1000/day free)                        │
│         ▼                                                        │
│  Merriam-Webster Learner's API                                   │
│         │                                                        │
│         │ 2. Parse response (definition, sentences, audio URL)   │
│         ▼                                                        │
│  ┌──────────────┐    ┌──────────────┐                            │
│  │ Cloudflare   │    │ Cloudflare   │                            │
│  │ D1 (words)   │    │ R2 (audio)   │                            │
│  │              │    │              │                            │
│  │ • word       │    │ • MP3 files  │                            │
│  │ • definition │    │ • By word ID │                            │
│  │ • sentences  │    │              │                            │
│  │ • difficulty │    │              │                            │
│  └──────────────┘    └──────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

PRODUCTION PHASE (Gameplay):
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Player starts game                                              │
│         │                                                        │
│         │ Query cached data (ZERO MW API calls)                  │
│         ▼                                                        │
│  ┌──────────────┐    ┌──────────────┐                            │
│  │ Cloudflare   │    │ Cloudflare   │                            │
│  │ D1 (words)   │    │ R2 (audio)   │                            │
│  └──────────────┘    └──────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**What MW API Provides:**

| Data | Available | Notes |
|------|-----------|-------|
| Definition | ✅ Yes | Multiple senses, part of speech |
| Example sentences | ✅ Yes | 160,000+ |
| Audio pronunciation | ✅ Yes | MP3/WAV/OGG (single word only) |
| Etymology | ✅ Yes | Word origin |
| Difficulty indicator | ⚠️ Partial | Core vocabulary flagged (3,000 words) |

**What We Must Build:**

| Data | Status | Approach |
|------|--------|----------|
| Difficulty tier (1-7) | Build ourselves | Word length + syllables + frequency corpus |
| Sentence audio | Build ourselves | Browser `speechSynthesis` API or Google TTS |
| Word of the Day | Build ourselves | Maintain curated list |

**Pricing:**
- Free tier: 1,000 queries/day (sufficient for seeding)
- Commercial: Contact for quote (if >1,000/day needed)

**Consequences:**
- Must maintain word database and seeding scripts
- Audio files cached in R2 (storage cost)
- Difficulty classification is manual effort
- Branding requirement: Must display MW logo

---

## ADR-012: Hidden Skill Rating System (Glicko-2)

| Field | Value |
|-------|-------|
| **Date** | January 17, 2026 |
| **Status** | Proposed |
| **Deciders** | Project team |

**Context:** Players need appropriate difficulty matching without requiring hundreds of games to reach their true skill level. The current XP system (Section 3.3 in PRD) provides visible progression but doesn't account for skill uncertainty or adapt quickly to new players.

**Problem Statement:**
1. **Cold Start Problem**: New players must grind through easy content before reaching appropriate difficulty
2. **Fixed XP Thresholds**: +5 XP per round means ~400+ games to advance from Tier 1 to Tier 7
3. **No Skill Uncertainty**: System can't distinguish "new player at true skill" from "grinding veteran"
4. **Matchmaking Quality**: Public multiplayer needs skill-based matching, not just XP-based

**Decision:** Implement a **hidden Glicko-2 skill rating system** alongside the visible XP/tier system.

**Key Insight: Two Separate Systems**

| System | Purpose | Visibility | Used For |
|--------|---------|------------|----------|
| **XP + Tier** (existing) | Progression, rewards, bragging rights | Visible to player | Leaderboards, profile display |
| **Glicko-2 Rating** (new) | Skill estimation, difficulty matching | Hidden | Word selection, multiplayer matchmaking |

**Glicko-2 Overview:**

Glicko-2 is a rating system designed for online games that addresses Elo's limitations:

| Component | Description | Range |
|-----------|-------------|-------|
| **Rating (r)** | Estimated skill level | 1000-1900 (maps to tiers 1-7) |
| **Rating Deviation (RD)** | Uncertainty in rating | 30-350 (lower = more confident) |
| **Volatility (σ)** | How much skill tends to change | 0.03-0.10 |

**Why Glicko-2 over Elo:**
1. **Tracks Uncertainty**: New players have high RD → ratings change faster
2. **Handles Inactivity**: RD increases if player hasn't played recently
3. **Volatility Component**: Players who improve/decline rapidly are tracked
4. **Industry Standard**: Used by Lichess, FIDE online, many competitive games

**How It Works in PlayLexi:**

```
NEW PLAYER:
Rating: 1500 (middle skill)
RD: 350 (maximum uncertainty)
→ First few games change rating significantly (±100-150 points)
→ System quickly converges on true skill level

ESTABLISHED PLAYER:
Rating: 1650 (skill estimate)
RD: 60 (low uncertainty)
→ Games change rating minimally (±15-30 points)
→ Stable difficulty, occasional calibration
```

**Rating-to-Tier Mapping:**

| Tier | Name | Rating Range | Notes |
|------|------|--------------|-------|
| 1 | New Bee | 1000-1149 | Starting range for low performers |
| 2 | Bumble Bee | 1150-1299 | |
| 3 | Busy Bee | 1300-1449 | |
| 4 | Honey Bee | 1450-1599 | Default starting rating (1500) |
| 5 | Worker Bee | 1600-1749 | |
| 6 | Royal Bee | 1750-1899 | |
| 7 | Bee Keeper | 1900+ | Elite tier |

**Word Selection Algorithm:**

```typescript
function selectWordForPlayer(playerRating: number, playerRD: number): Word {
  // Map rating to difficulty tier
  const targetTier = Math.floor((playerRating - 1000) / 150) + 1
  const clampedTier = Math.max(1, Math.min(7, targetTier))

  // High RD = uncertain skill = sample from adjacent tiers for calibration
  if (playerRD > 150) {
    // Sample from ±1 tier for faster convergence
    const tierRange = [clampedTier - 1, clampedTier, clampedTier + 1]
    return getRandomWordFromTiers(tierRange.filter(t => t >= 1 && t <= 7))
  }

  // Low RD = confident = serve from target tier with occasional challenges
  return getRandomWordFromTier(clampedTier)
}
```

**Database Schema Addition:**

```typescript
// db/schema.ts - New table for skill ratings
export const userSkillRatings = sqliteTable('user_skill_ratings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  track: text('track', { enum: rankTracks }).notNull(),

  // Glicko-2 components
  rating: real('rating').notNull().default(1500),
  ratingDeviation: real('rating_deviation').notNull().default(350),
  volatility: real('volatility').notNull().default(0.06),

  // Derived tier (for quick queries)
  estimatedTier: integer('estimated_tier').notNull().default(4),

  // Tracking
  gamesPlayed: integer('games_played').notNull().default(0),
  lastPlayedAt: integer('last_played_at', { mode: 'timestamp' }),

  // Season support
  seasonId: text('season_id'),
  seasonHighestRating: real('season_highest_rating').default(1500),

  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userTrackUnique: unique().on(table.userId, table.track),
  trackRatingIdx: index('idx_skill_ratings_track_rating').on(table.track, table.rating),
}));
```

**Integration with Progression Systems:**

> **Updated per ADR-014:** Solo games no longer display XP. Glicko-2 is the primary skill system for solo mode.

The Glicko-2 system serves different purposes depending on game mode:

| Mode | Visible Progression | Hidden Progression (Glicko-2) |
|------|---------------------|-------------------------------|
| **Solo** | Personal stats (rounds, accuracy) | Word difficulty adjustment |
| **Multiplayer** | XP and Rank tier | Matchmaking + word difficulty |

**How They Coexist:**

| Event | Solo Effect | Multiplayer Effect |
|-------|-------------|-------------------|
| Correct answer | Glicko-2 rating increases | XP +5, Glicko-2 increases |
| Wrong answer | Glicko-2 rating decreases | XP unchanged, Glicko-2 decreases |
| Win 1st place | N/A | XP +50, Glicko-2 increases |
| Lose 6th place | N/A | XP -30, Glicko-2 decreases |

**System Responsibilities:**
1. **Glicko-2 (hidden)** — Word difficulty selection, multiplayer matchmaking
2. **XP (multiplayer only)** — Visible rank progression, leaderboards
3. **Personal stats (solo only)** — Rounds, accuracy, history comparison

**Consequences:**

*Positive:*
- New players quickly reach appropriate difficulty
- Skill-based matchmaking improves game quality
- System adapts to improving/declining players
- Separate concerns: XP = engagement, Glicko-2 = skill

*Negative:*
- Additional complexity (two rating systems)
- Players may be confused why word difficulty doesn't match visible tier
- Must maintain two parallel systems
- RD decay needs background job or lazy evaluation

**Files to Create:**

1. `lib/rating/glicko2.ts` — Core Glicko-2 algorithm implementation
2. `lib/rating/word-selector.ts` — Rating-aware word selection
3. `db/schema.ts` — Add `userSkillRatings` table
4. Update `lib/game-logic.ts` — Call rating updates after each answer

---

## ADR-013: Adaptive Placement Test

| Field | Value |
|-------|-------|
| **Date** | January 17, 2026 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** The original placement system used an Endless game until 3 hearts are lost, ranking based on "highest difficulty reached." This approach has issues:

1. **Slow Convergence**: Player might spell 20+ easy words before reaching challenging content
2. **High Variance**: Lucky/unlucky word selection affects placement
3. **Player Frustration**: Skilled players must slog through trivial content
4. **Inaccurate Placement**: Single failure point doesn't distinguish "almost tier 5" from "solid tier 4"

**Inspiration:** Valorant placement matches, Duolingo placement test, GRE/GMAT adaptive testing.

**Decision:** Replace the "Endless until elimination" placement with an **adaptive placement test** that uses Bayesian probability to converge on skill level in 10-15 words. **The placement test has NO hearts.**

---

### Sub-Decision: No Hearts in Placement Test

**The Question:** Should the placement test include hearts?

**Options Considered:**

| Option | Description | Verdict |
|--------|-------------|---------|
| **1. No hearts** | Pure calibration, no elimination | ✅ **Chosen** |
| 2. Hearts with elimination | Same as Endless (3 hearts, game over on depletion) | ❌ Rejected |
| 3. Hearts with regeneration | Hearts deplete but regenerate, no elimination | ❌ Rejected |
| 4. Cosmetic hearts | Hearts displayed but don't affect gameplay | ❌ Rejected |

**Why No Hearts (Option 1):**

*Game Design Perspective:*
- **Separation of concerns**: Tutorial teaches mechanics, placement measures skill
- **Full calibration data**: The Bayesian algorithm NEEDS wrong answers to find skill boundaries
- **Duolingo model**: Their placement test is explicitly different from regular lessons
- **Reduced anxiety**: "Calibration" framing is less stressful than "test you can fail"

*Engineering Perspective:*
- **No special cases**: Hearts either exist (Endless) or don't (Blitz, Placement)
- **No fake mechanics**: Regeneration doesn't exist elsewhere — introducing it creates confusion
- **Clean state machine**: Placement ends on convergence/word count, not heart depletion
- **Reusable components**: Same game UI, just without HeartsDisplay component

**Why NOT Hearts with Elimination (Option 2):**

- Cuts off calibration data (3 wrong = game over, but we need more data points)
- A skilled player with 3 unlucky words gets placed wrong
- High anxiety contradicts "finding your level" framing
- Variable length (could be 50+ words for skilled players)

**Why NOT Hearts with Regeneration (Option 3):**

- **Introduces a mechanic that doesn't exist anywhere else**
- Players would expect regeneration in Endless (it doesn't exist)
- Creates "unlearning" problem — they learn wrong behavior
- More complex implementation for zero benefit
- Violates principle: "Don't teach mechanics in onboarding that don't exist in real game"

**Why NOT Cosmetic Hearts (Option 4):**

- "Fake" hearts create trust issues when they become real
- Player thinks "I had 3 hearts and lost 4 times but didn't lose?"
- Confusing UX — hearts should mean something or not appear

**Solution for Teaching Hearts:**

Add **Tutorial Step 4** (before placement) that explicitly teaches the hearts mechanic:

> "In real games, you'll have lives. In Endless mode, you start with 3 hearts. Each mistake costs one heart. When you run out, the game ends. In Blitz mode, there's no hearts — just a 3-minute timer!"

This way:
1. Players learn hearts exist (Tutorial Step 4)
2. Placement explicitly frames itself as "calibration, not a game" (Tutorial Step 3)
3. First real Endless game → hearts feel familiar, not surprising

---

**How Adaptive Testing Works:**

```
INITIAL STATE:
Tier Probabilities: [14%, 14%, 14%, 14%, 14%, 14%, 14%]
(Equal chance of any tier)

WORD 1: Serve Tier 4 word (middle difficulty)
→ Player answers CORRECTLY
→ Update: Lower tiers become less likely, higher tiers more likely
Tier Probabilities: [5%, 8%, 12%, 18%, 22%, 20%, 15%]

WORD 2: Serve Tier 5 word (probing higher skill)
→ Player answers CORRECTLY
→ Update: High tiers become more likely
Tier Probabilities: [2%, 4%, 8%, 15%, 25%, 28%, 18%]

WORD 3: Serve Tier 6 word (testing upper bound)
→ Player answers INCORRECTLY
→ Update: Tier 6-7 become less likely, Tier 5 becomes most likely
Tier Probabilities: [2%, 3%, 6%, 18%, 45%, 20%, 6%]

... continue until confidence threshold met ...

FINAL: Tier 5 has >80% probability → Place at Tier 5
```

**Algorithm Overview:**

```typescript
interface PlacementState {
  tierProbabilities: number[]  // [T1, T2, T3, T4, T5, T6, T7] - sums to 1.0
  wordsAttempted: number
  correctByTier: Record<number, number>
  incorrectByTier: Record<number, number>
}

function getNextPlacementWord(state: PlacementState): {
  tier: number
  isComplete: boolean
  estimatedTier?: number
} {
  // Find tier with highest uncertainty (closest to 50% probability)
  const uncertainTier = findMostUncertainTier(state.tierProbabilities)

  // Check if we've converged (one tier has >80% probability)
  const maxProb = Math.max(...state.tierProbabilities)
  const isComplete = maxProb > 0.80 || state.wordsAttempted >= 15

  if (isComplete) {
    return {
      tier: uncertainTier,
      isComplete: true,
      estimatedTier: state.tierProbabilities.indexOf(maxProb) + 1
    }
  }

  return { tier: uncertainTier, isComplete: false }
}
```

**Placement Test UI Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLACEMENT TEST                                │
│                                                                  │
│   Progress: ████████░░░░░░░░ 8/15 words                          │
│                                                                  │
│   (No hearts - this is calibration, not elimination)             │
│                                                                  │
│   [Word audio plays]                                             │
│   [Input component]                                              │
│                                                                  │
│   "Don't worry about mistakes — we're finding your level!"      │
└─────────────────────────────────────────────────────────────────┘
```

**Key Differences from Original Placement:**

| Aspect | Original (Endless-based) | New (Adaptive) |
|--------|--------------------------|----------------|
| Format | Endless with 3 hearts | Fixed 10-15 words, **no hearts** |
| Hearts | 3 (elimination on depletion) | **None** (calibration mode) |
| Word selection | Progressive difficulty | Adaptive based on performance |
| End condition | All hearts lost | Probability converges or max words |
| Accuracy | "Highest tier reached" | Bayesian estimate with confidence |
| Player experience | Stressful (can fail) | Low pressure (calibration only) |
| Time | Variable (could be 50+ words) | Fixed ~5 minutes max |
| Teaches hearts? | Yes (by doing) | No (Tutorial Step 4 teaches instead) |

**Integration with Glicko-2:**

After placement test completes:

```typescript
function initializeGlicko2FromPlacement(estimatedTier: number): SkillRating {
  return {
    rating: 1000 + (estimatedTier - 1) * 150 + 75, // Midpoint of tier
    ratingDeviation: 200, // Still uncertain, but lower than complete unknown
    volatility: 0.06,
  }
}
```

**PRD Updates Made:**

The following PRD sections have been updated to reflect this decision:

1. **Section 2.2** (User Flow diagram): Changed "Tutorial (3 steps)" → "Tutorial (4 steps)"
2. **Section 2.2.1** (Tutorial): Added Step 4 to teach hearts mechanic before first real game
3. **Section 2.2.2** (Placement Test): Documented no-hearts decision with full rationale

**Consequences:**

*Positive:*
- Faster, more accurate placement (~5 minutes vs potentially 20+ minutes)
- Better player experience (no failure pressure)
- More accurate skill estimation via Bayesian inference
- Consistent experience length for all players
- No fake mechanics (hearts behave consistently across all modes)
- Clean separation: tutorial teaches, placement measures

*Negative:*
- More complex implementation than simple Endless mode
- Requires careful tuning of IRT parameters
- Tutorial now has 4 steps instead of 3 (slightly longer onboarding)
- Players don't experience hearts until first real game (mitigated by Tutorial Step 4)

**Files to Create:**

1. `lib/placement/placement-engine.ts` — Adaptive placement algorithm
2. `lib/placement/irt-model.ts` — Item Response Theory calculations
3. `components/placement/placement-progress.tsx` — Progress UI (no hearts)
4. Update `app/(focused)/onboarding/placement/page.tsx` — Use new engine

---

## ADR-014: Solo vs Multiplayer Progression Systems

| Field | Value |
|-------|-------|
| **Date** | January 24, 2026 |
| **Status** | Accepted |
| **Deciders** | Project team |

**Context:** The original design showed XP and rank progression on the solo game results screen, treating solo games like a "lighter" version of multiplayer. However, this created several problems:

1. **Anxiety without reward** — Showing XP/rank in solo creates pressure, but there's no opponent to beat (no emotional payoff)
2. **"Protect my rank" behavior** — If players could see rank progress, they might avoid playing to protect it
3. **Conflicting feedback loops** — Solo players want "Am I improving?" while competitive players want "Where do I rank?"
4. **Rank inflation risk** — If solo games added XP, everyone would eventually grind to max rank

**Decision:** Split the progression systems completely:

| Mode | XP/Rank Display | What Players See | Stakes |
|------|-----------------|------------------|--------|
| **Solo** | Hidden (not shown) | Personal stats + game history | None (practice mode) |
| **Multiplayer** | Visible, can go up/down | Rank badge + XP change + placement | Real (competitive mode) |

---

### Sub-Decision 1: Solo Results Screen

**What we show in solo mode:**

| Element | Description |
|---------|-------------|
| Rounds Completed | How far they got this game |
| Accuracy % | Correct / Total answers |
| Best Streak | Longest consecutive correct answers |
| Personal Leaderboard | This game ranked against their own history |
| Personal Best indicators | Badges for new records |

**What we DON'T show:**
- Rank badge
- XP earned
- XP progress bar
- Tier progression

**Why:** Solo is practice mode. The frame is "Am I getting better at spelling?" not "Am I climbing a ladder?" This reframe reduces anxiety and encourages daily play.

---

### Sub-Decision 2: Multiplayer XP with Real Stakes

**XP changes by placement:**

| Placement | XP Change |
|-----------|-----------|
| 1st | +50 |
| 2nd | +30 |
| 3rd | +10 |
| 4th | -10 |
| 5th | -20 |
| 6th | -30 |

**Why XP can decrease:** Without loss, rank means nothing. If everyone eventually reaches Bee Keeper through grinding, the title is worthless. Real stakes create real achievement.

**Why not solo XP loss:** In multiplayer, you lose to another human (acceptable). In solo, you lose to a word (feels unfair, like the game cheated you).

---

### Sub-Decision 3: No Tier Protection

**Rejected option:** "Tier shields" that prevent demotion once you reach a new tier.

**Why rejected:**
- Leads to rank inflation (everyone eventually at top)
- Ranks lose meaning
- Removes stakes from competitive play
- Creates "participation trophy" feeling

**What we do instead:**
- Fair matchmaking (similar tiers play together)
- Weighted modifiers (underdogs protected)
- Max loss per game is 30 XP (not catastrophic)
- Players choose when to play multiplayer (can warm up in solo)

---

### Sub-Decision 4: No Recovery Bonuses

**Rejected option:** Give bonus XP after demotion to help players recover.

**Why rejected:**
- It's a handout that inflates ranks over time
- Reduces the "cost" of demotion
- Makes the system feel dishonest
- Teaches wrong lesson (failure has no real consequence)

**What we do instead:** If you demote, earn your way back at normal rate. The demotion itself is the feedback.

---

**Design Philosophy:**

The key insight is: **Solo = self-improvement, Multiplayer = competition**.

These are fundamentally different player motivations:

| Motivation | What Player Wants | How We Deliver |
|------------|-------------------|----------------|
| Self-improvement (solo) | "Am I getting better?" | Personal stats, history comparison |
| Competition (multiplayer) | "Am I better than others?" | Rank, placement, XP stakes |

Mixing these creates cognitive dissonance. A player in solo mode seeing "You lost XP" feels punished for practicing. A player in multiplayer seeing "Everyone gets XP" feels the competition is fake.

---

**Consequences:**

*Positive:*
- Solo players practice without anxiety
- Multiplayer has genuine stakes
- Ranks maintain meaning (not everyone at top)
- Clean separation of concerns
- Encourages daily solo play (no "protect my rank" fear)

*Negative:*
- Solo progress is less "visible" (no XP bar filling up)
- Players may not understand why solo doesn't have ranks
- Two different UI paradigms for results screen

**Mitigation for negatives:**
- Personal leaderboard gives visible progress (against yourself)
- Onboarding can explain: "Solo is practice, multiplayer is ranked"
- Personal best badges still give achievement feeling

---

**PRD Sections Updated:**

1. **Section 3.3** — Complete rewrite of XP system philosophy
2. **Section 7.4** — Solo tab now shows personal stats, not XP
3. **Section 15.1** — XP thresholds clarified as multiplayer-only
4. **Section 15.2.2** — Solo XP section now explains why it's not tracked

---

## Template for New ADRs

When adding a new decision, copy this template:

```markdown
### ADR-XXX: [Title]

| Field | Value |
|-------|-------|
| **Date** | [Date] |
| **Status** | Proposed / Accepted / Deprecated / Superseded by ADR-XXX |
| **Deciders** | [Names or "Project team"] |

**Context:** [What is the issue? What forces are at play?]

**Decision:** [What is the decision?]

**Rationale:**
- [Why this decision?]
- [What alternatives were considered?]

**Consequences:**
- [What are the positive and negative implications?]
```

---

*End of Architecture Decision Records*
