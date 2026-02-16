# PlayLexi — Product Requirements Document (PRD)

> **Version:** 2.0
> **Last Updated:** February 15, 2026
> **Status:** Living Document

---

## Table of Contents

1. [Overview](#1-overview)
2. [User Flows](#2-user-flows)
3. [Rank System](#3-rank-system)
4. [Game Modes](#4-game-modes)
5. [Multiplayer](#5-multiplayer)
6. [Word System](#6-word-system)
7. [Leaderboard](#7-leaderboard)
8. [Social Features](#8-social-features)
9. [Profile & Settings](#9-profile--settings)
10. [Notifications](#10-notifications)
11. [UI Components](#11-ui-components)
12. [Technical Decisions](#12-technical-decisions)
13. [Edge Cases & Error Handling](#13-edge-cases--error-handling)
14. [Privacy & Compliance](#14-privacy--compliance)
15. [XP Thresholds & Crown Points Details](#15-xp-thresholds--crown-points-details)

---

## 1. Overview

### 1.1 What is PlayLexi?

PlayLexi is a competitive spelling bee game where players spell words by voice or keyboard. Players compete in solo practice modes or multiplayer matches to climb ranked tiers from "New Bee" to "Bee Keeper."

### 1.2 Core Value Proposition

- **Skill-based progression:** Players are placed in appropriate difficulty tiers based on ability
- **Multiple game modes:** Endless (progression) and Blitz (speed)
- **Dual input methods:** Voice dictation and keyboard typing as separate competitive tracks
- **Social competition:** Friends, leaderboards, and the exclusive "Bee Keeper" title

### 1.3 Target Platform

- Web application (responsive, mobile-friendly)
- Hosted separately from marketing site (different repo)

---

## 2. User Flows

### 2.1 Entry Points

The app dashboard (`/`) is public — no account required to see game modes or play Daily Spell.

**Marketing Site (playlexi.com):**
| Button | Destination | Flow |
|--------|-------------|------|
| "Get Started" | `app.playlexi.com/` | Public dashboard with game carousel |
| "I Have an Account" | `app.playlexi.com/` | Opens SignInDialog modal on dashboard (existing user flow) |

**App (app.playlexi.com):**
| Element | Destination | Flow |
|---------|-------------|------|
| `/` (landing page) | Dashboard | Public — game carousel, navbar shows "Sign in" for anonymous |
| `/leaderboard` | Leaderboard | Public — viewable by everyone, auth optional |
| Daily Spell card | `/game/daily` | Playable anonymously (localStorage persistence) |
| Locked game card (e.g., Endless) | Sign-up modal | Modal with Google and Apple OAuth buttons |
| Navbar "Sign in" button | Sign-in dialog | Modal with Google and Apple OAuth buttons + "Sign up" link |
| "Sign up" link in dialog | Tutorial → `/?signIn=true` | Only shown when tutorial not complete. Routes to `/onboarding/tutorial?returnTo=/?signIn=true` (tutorial first, then back to dashboard with auto-open dialog). Hidden when tutorial is complete (OAuth buttons handle both sign-in and sign-up). |
| OAuth buttons in SignInDialog | OAuth → Dashboard | Existing user flow (sign-in and sign-up via modal) |

**Why the dashboard is public:**
- Reduces friction — users see the game immediately
- Daily Spell is playable without an account (localStorage-based)
- Locked game cards prompt sign-up when tapped (soft gate, not hard gate)
- Users only sign up when they want to unlock more content

### 2.2 New User Flow

```
Entry: Dashboard (/) → Tap a game card
                          ↓
                   Tutorial (4 steps, once only)
                          ↓
                   Game plays (Daily Spell works anonymously)
                          ↓
         ┌── Wants more → Taps locked card (e.g., Endless) ──┐
         │                                                      │
         │                Sign-up modal appears                │
         │                          ↓                          │
         │                OAuth Sign Up (Google)               │
         │                          ↓                          │
         │                Complete Profile                     │
         │                (username + avatar)                  │
         │                          ↓                          │
         │                Dashboard (all modes unlocked)       │
         └──────────────────────────────────────────────────────┘
```

**Tutorial behavior:** Shows once on first-ever game tap. Completion is stored in `localStorage("playlexi_tutorial_complete")`. If authenticated, also synced to `users.has_completed_tutorial` via `PATCH /api/users/me`.

**Cross-linking:** Login page has "New here? Get Started" link. Onboarding pages have "Already have an account? Sign in" link.

#### 2.2.1 Tutorial (4 Steps)

| Step | Title | Description |
|------|-------|-------------|
| 1 | "Press Start, then listen carefully to the word" | You can replay the word as many times as you'd like. Use the definition and sentence buttons for extra clues. |
| 2 | "Use the microphone and spell the word letter by letter" | Saying the whole word will not count towards the microphone's recording, only letters. |
| 3 | "The game adapts to your skill level" | As you play, the difficulty adjusts automatically. Words get harder as you improve — no setup needed! |
| 4 | "In real games, you'll have lives" | In Endless mode, you start with 3 hearts. Each mistake costs one heart. When you run out, the game ends. In Blitz mode, there's no hearts — just a 3-minute timer! |

- Progress bar shows completion (25% → 50% → 75% → 100%)
- "Skip" link available on all steps
- "Continue" button advances, "Go back" returns to previous
- "Finish" on step 4 navigates to `returnTo` URL (the game page the user originally tapped)
- Supports `?returnTo=/game/daily` query param so the user returns to the game after tutorial
- If authenticated, tutorial completion is also synced to the server via `PATCH /api/users/me`

**Why 4 Steps:**
1. Steps 1-2 teach the core mechanics (listen, then spell)
2. Step 3 explains adaptive difficulty (so users know why words get harder)
3. Step 4 teaches the hearts/lives mechanic before the first real game
4. This prevents confusion when players encounter hearts for the first time

#### 2.2.2 Placement Test (Reserved for Ranked/Multiplayer)

> **Status:** Not part of current onboarding. The placement test UI and logic exist at `/onboarding/placement` but are not in the sign-up flow. They will be used when ranked multiplayer is implemented. See ADR-013 in ADR.md for the Bayesian algorithm design.

**Current behavior:** New users start at Tier 1 (New Bee) with default Glicko-2 rating (1500, RD 350). The hidden skill rating adjusts automatically as they play.

#### 2.2.3 OAuth Sign Up

- Google OAuth popup (Apple OAuth planned for future)
- No custom password storage (security measure)
- OAuth handled by Better Auth library
- After OAuth, auth callback checks if `users` record exists:
  - Exists → redirect to `/` (returning user)
  - Does not exist → redirect to `/onboarding/profile` (new user)

#### 2.2.4 Complete Profile

After OAuth, new users complete a single-page profile:
- **Username** (required, must be unique, debounced validation with `GET /api/users/check-username`)
- **Age range** (optional, stored as `birthYear` for COPPA compliance)
- **Avatar selection** (choose from 3 presets: Dog, Person, Cat)
- **"Finish" button** → Creates user via `POST /api/users/complete-profile` → Redirects to dashboard

If the user completed the tutorial anonymously before signing up, the `hasCompletedTutorial` flag from localStorage is passed in the request body so the DB record is synced on creation.

### 2.3 Existing User Flow

```
Entry: Dashboard (/) → Navbar "Sign in" (opens SignInDialog modal)
                               ↓
                         OAuth Login (Google) via SignInDialog
                               ↓
                         Dashboard (all modes unlocked)
```

- Direct to OAuth via SignInDialog modal on dashboard
- No tutorial (already completed — flag in DB)
- Straight to dashboard with all game modes unlocked

**Legacy route:** `/login` redirects to `/` (deprecated).

**Detection Logic (auth callback):** After OAuth, check if `users` record exists for `auth_user.id`:
- If exists → redirect to `/` (returning user)
- If not exists → redirect to `/onboarding/profile` (new user needs to complete profile)

---

## 3. Rank System

### 3.1 Rank Tiers (7 Total)

| Tier | Name | Notes |
|------|------|-------|
| 1 | New Bee | Lowest tier, starting point for most players |
| 2 | Bumble Bee | |
| 3 | Busy Bee | |
| 4 | Honey Bee | |
| 5 | Worker Bee | |
| 6 | Royal Bee | Competes for Bee Keeper via Crown Points |
| 7 | Bee Keeper | **Exclusive** — only 1 player per track holds this title |

### 3.2 Ranking Tracks (4 Total)

Players have **separate ranks** for each combination of game mode and input method:

| Track | Game Mode | Input Method |
|-------|-----------|--------------|
| 1 | Endless | Voice |
| 2 | Endless | Keyboard |
| 3 | Blitz | Voice |
| 4 | Blitz | Keyboard |

**Rationale:** These are fundamentally different skills. A player may excel at voice Blitz but struggle with keyboard Endless. Separate tracks ensure fair competition.

### 3.3 XP System

#### 3.3.1 Design Philosophy: Solo vs Multiplayer

PlayLexi uses **different progression models** for solo and multiplayer modes:

| Mode | XP Behavior | Rank Display | Rationale |
|------|-------------|--------------|-----------|
| **Solo** | Hidden (not displayed) | Not shown | Practice mode — focus on self-improvement, not anxiety |
| **Multiplayer** | Visible, can go up/down | Prominently shown | Competitive mode — real stakes create engagement |

**Why This Split:**

1. **Solo is practice, not competition** — You're playing against words, not people. Showing rank/XP creates artificial pressure without the reward of beating an opponent.

2. **Avoid the "protect my rank" problem** — If solo XP could decrease, players would stop playing to avoid losing progress. We want daily practice, not rank anxiety.

3. **Multiplayer needs real stakes** — Competition is meaningless if everyone eventually reaches max rank. XP loss for poor placement creates genuine investment.

4. **Different feedback loops** — Solo players want "Am I improving?" (personal stats). Multiplayer players want "Where do I rank?" (XP/tier).

#### 3.3.2 Solo Mode (Practice)

In solo games, players see **personal performance stats** instead of XP:

| Metric | Description |
|--------|-------------|
| Rounds Completed | How far they got this game |
| Accuracy % | Correct answers / total answers |
| Best Streak | Longest consecutive correct answers |
| Personal Best | How this game ranks against their history |

**What happens in the background:**
- Word difficulty adjusts via hidden Glicko-2 rating (see ADR-012)
- Game history is saved for personal leaderboard
- No XP is tracked or displayed

#### 3.3.3 Multiplayer Mode (Competitive)

In multiplayer games, XP is visible and can increase OR decrease:

| Placement | XP Change |
|-----------|-----------|
| 1st | +50 |
| 2nd | +30 |
| 3rd | +10 |
| 4th | -10 |
| 5th | -20 |
| 6th | -30 |

**Note:** Total XP from a 6-player game is +30 (50+30+10-10-20-30). The system is slightly inflationary to reward participation while maintaining stakes.

#### 3.3.4 Weighted Modifiers (Mixed-Tier Lobbies)

When players of different ranks are in the same multiplayer lobby:

| Scenario | Modifier |
|----------|----------|
| You're the **lowest rank** in lobby | Gains +25-50%, losses reduced 25-50% |
| You're the **highest rank** in lobby | Gains -25%, losses +25-50% |
| Lobby is **same tier** | No modifier (1x) |

**Rationale:** Protects underdogs, prevents high-rank players from farming easy wins.

#### 3.3.5 Tier Demotion (Multiplayer Only)

Players CAN be demoted to a lower tier if they lose enough XP:

| Rule | Description |
|------|-------------|
| When it happens | XP drops below current tier threshold |
| No protection | No shields, no bonuses, no handouts |
| Recovery | Earn XP at normal rate to climb back |
| Fairness | Same rules for everyone — ranks have meaning |

**Design Rationale:** We considered "tier protection" (can't demote once reached) but rejected it:
- Leads to rank inflation (everyone eventually reaches top tiers)
- Ranks lose meaning ("Busy Bee" means nothing if you can't lose it)
- Removes stakes from competitive play

**To prevent frustration:**
- Matchmaking pairs similar-tier players (fair matches)
- Weighted modifiers protect underdogs
- A single bad game costs ~30 XP max (not catastrophic)
- Players choose when to play multiplayer (can warm up in solo first)

#### 3.3.6 XP Consistency

The same XP system applies to all multiplayer modes:
- Local multiplayer
- Online private multiplayer
- Online public multiplayer

### 3.4 Crown Points (Royal Bees Only)

Crown Points are a **separate system** from XP, only tracked for Royal Bee players competing for Bee Keeper.

| Rule | Description |
|------|-------------|
| Who earns them | Royal Bee players only |
| Direction | Only goes UP, never down |
| Earning methods | Win multiplayer games, beat other Royal Bees, long Endless streaks |
| Bee Keeper | The Royal Bee with the most Crown Points in each track |
| Tracks | 4 separate Bee Keepers (one per track) |

#### 3.4.1 Optional Inactivity Decay

To prevent Bee Keepers from going inactive:
- If no games played for 7+ days, lose small % of Crown Points
- Active players are never penalized

**Rationale:** The "stop playing to keep the crown" problem — if XP could go down, rational players would stop playing once they got Bee Keeper. Crown Points solve this.

---

## 4. Game Modes

### 4.0 Daily Spell (Implemented)

| Attribute | Value |
|-----------|-------|
| Objective | Spell all 5 daily words correctly |
| Words | 5 fixed words, same for all players each day |
| Hearts | **None** (complete all 5 regardless of mistakes) |
| Input | **Voice only** |
| Timer | Per-word timer |
| Auth required | **No** — playable anonymously |
| Attempt limit | 1 per day per user (or per visitor ID for anonymous) |

**How It Works:**
1. Each day at 00:05 UTC, a GitHub Actions cron job pre-generates puzzles 7 days ahead
2. If no puzzle exists for today, `getTodayPuzzle()` auto-generates one as a fallback
3. Players hear a word, spell it by voice, get instant correct/wrong feedback
4. After all 5 words → streak page → result page with emoji row and share button

**Anonymous Play:**
- Anonymous users get a `visitorId` stored in `localStorage("playlexi_visitor_id")`
- Results are persisted server-side keyed to this visitor ID
- If the user later signs up, they can continue with their account
- Anonymous users see a CTA: "Create an account to track your stats across devices"

**Daily Spell Routes:**
| Route | Purpose |
|-------|---------|
| `/game/daily` | Main gameplay page |
| `/game/daily/streak` | Streak display after game |
| `/game/daily/result` | Final results with score and share button |

**API Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/daily-spell?date=YYYY-MM-DD` | Get today's puzzle + check if already played |
| `POST /api/daily-spell` | Submit round result |
| `GET /api/daily-spell/stats` | Get streak and history |
| `POST /api/daily-spell/challenge` | Generate a challenge/share link |

### 4.1 Single Player

#### 4.1.1 Endless Mode (Implemented, requires auth)

| Attribute | Value |
|-----------|-------|
| Objective | Advance through as many rounds as possible |
| Hearts | 3 (game ends when all lost) |
| Word difficulty | Increases each round |
| Timer | Per-word, adjusts based on word difficulty (10-35 seconds) |
| Wrong answer | Lose 1 heart, move to new word (don't repeat) |

**Wrong Answer Behavior:** When a player spells a word incorrectly, they lose 1 heart and immediately advance to a new word. The incorrect word is not repeated. This is intentional — the goal is progression and learning, not frustration.

#### 4.1.1.1 Learning from Mistakes

When a player answers incorrectly, they see a **feedback overlay** that includes:

| Element | Description |
|---------|-------------|
| Your answer | What the player spelled (with incorrect letters highlighted in red) |
| Correct spelling | The correct word spelling (highlighted in green) |
| Visual diff | Side-by-side or inline comparison showing where they went wrong |

**Example Display:**
```
┌─────────────────────────────────────┐
│           ❌ Incorrect              │
│                                     │
│   You spelled:    RECIEVE           │
│                      ^^^            │
│   Correct:        RECEIVE           │
│                      ^^^            │
│                                     │
│   "I before E, except after C"      │
│                                     │
│        [ Continue to next word ]    │
└─────────────────────────────────────┘
```

**Rationale:** Showing the correct spelling immediately after a mistake reinforces learning. The player sees exactly where they went wrong, which improves retention more than simply saying "wrong" and moving on.

**Future Enhancement:** A "Review Mistakes" section in the results screen could show all words the player missed during that session, allowing them to study before playing again.

#### 4.1.2 Blitz Mode (Coming Soon)

| Attribute | Value |
|-----------|-------|
| Objective | Spell as many words as possible before time runs out |
| Timer | 3 minutes (countdown) |
| Hearts | None (mistakes don't eliminate) |
| Penalty | Wrong answer costs 3-5 seconds off the clock |
| Word difficulty | Stays consistent with player's rank tier |

### 4.2 Input Methods

| Method | Description |
|--------|-------------|
| **Voice** | Player spells letter-by-letter using microphone. Real-time transcription shows letters as spoken. |
| **Keyboard** | Player types letters. Visual feedback as typed. |

#### 4.2.1 Input Switching Rules

| Context | Rule |
|---------|------|
| Solo games | Can choose input method before each game |
| Multiplayer | Host chooses input method for the room; no switching mid-game |

**Rationale:** Keyboard is easier than voice. Allowing mid-game switching in multiplayer would be unfair.

### 4.3 Timer Values by Word Difficulty

| Word Tier | Base Timer | Voice Bonus | Total (Voice) |
|-----------|------------|-------------|---------------|
| Tier 1 | 10 sec | +3 sec | 13 sec |
| Tier 2 | 12 sec | +3 sec | 15 sec |
| Tier 3 | 15 sec | +3 sec | 18 sec |
| Tier 4 | 18 sec | +3 sec | 21 sec |
| Tier 5 | 22 sec | +3 sec | 25 sec |
| Tier 6 | 28 sec | +3 sec | 31 sec |
| Tier 7 | 35 sec | +3 sec | 38 sec |

**Voice Bonus Rationale:** Speaking takes longer than typing.

### 4.4 Word Auto-Play

- Word audio plays **automatically** when each round starts
- Player can replay using the play button (right side of input)
- Flow: "Ready?" → Click → "The word is [blank]" → Player spells → Result → Next round auto-plays

#### 4.4.1 Game Start Flow

When the game loads:
1. Game enters "ready" phase
2. Word audio plays automatically ("The word is [word]")
3. Brief delay (~1.5 seconds) for player to prepare
4. Timer starts and game enters "playing" phase
5. Player can use helper buttons (Play, Sentence, Dictionary) while playing

**Rationale:** Auto-playing the word on game start ensures players immediately know what to spell without needing to press a button first. This reduces friction and matches user expectations from traditional spelling bees.

---

## 5. Multiplayer

### 5.1 Multiplayer Types

| Type | Description |
|------|-------------|
| **Local** | Players in same physical location, each on their own device |
| **Online Private** | Remote players, join via room code |
| **Online Public** | Matchmaking queue, auto-matched with similar ranks |

### 5.1.1 Multiplayer Match Types (Casual vs Ranked)

Multiplayer games are divided into two match types, inspired by competitive games like Valorant:

| Match Type | Hearts | Stakes | Matchmaking | Target Audience |
|------------|--------|--------|-------------|-----------------|
| **Casual (Quick Match)** | 3 | Low — play for fun | Relaxed, friends can join | Social players, practice |
| **Ranked (Competitive)** | 1 | High — one mistake eliminates | Strict ELO-based | Competitive players |

**Casual (Quick Match):**
- Default multiplayer mode
- 3 hearts (same as solo Endless)
- Friends can join via room code or matchmaking
- Lower pressure, encourages experimentation
- Still earns XP, but with reduced stakes

**Ranked (Competitive):**
- Traditional spelling bee rules — one wrong answer = elimination
- Strictly ELO-matched opponents
- Higher XP gains/losses
- Displays rank prominently
- Unlocked after completing placement test

**Mode Selection UI:**
```
┌─────────────────────────────────────┐
│         How do you want to play?    │
│                                     │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   CASUAL    │  │   RANKED    │  │
│  │             │  │             │  │
│  │ 3 lives     │  │ 1 mistake   │  │
│  │ Play for    │  │ Climb the   │  │
│  │ fun         │  │ ladder      │  │
│  └─────────────┘  └─────────────┘  │
│                                     │
│        [ Solo Practice ]            │
└─────────────────────────────────────┘
```

**Rationale:** This hybrid approach serves both casual and competitive players:
- Casual players get a forgiving, social experience (3 hearts)
- Competitive players get authentic spelling bee stakes (1 strike)
- Players can progress from Casual → Ranked as they improve
- "I play Ranked mode" becomes a badge of honor

### 5.2 Local Multiplayer

1. Host creates room on their device
2. Host chooses: Game mode (Endless/Blitz) + Input method (Voice/Keyboard)
3. Host gets room code (e.g., "BEE42")
4. Other players join via code on their own devices (must be logged in)
5. Host sees lobby with all players (names, ranks visible)
6. Host clicks "Start" when ready
7. System calculates average rank → sets word difficulty

**Account Requirement:** All players must have accounts (for rank averaging and XP tracking). Guest mode may be added in future.

### 5.3 Online Private Multiplayer

Same as local multiplayer, but players can be anywhere. Join via room code.

### 5.4 Online Public Multiplayer

#### 5.4.1 Matchmaking Flow

1. Player clicks "Find Public Game"
2. Selects: Game mode (Endless/Blitz) + Input method (Voice/Keyboard)
3. System finds/creates lobby
4. Lobby fills up → countdown starts at minimum players
5. Game auto-starts when countdown ends

#### 5.4.2 Player Count

| Setting | Value |
|---------|-------|
| Minimum to start | 4 players |
| Maximum cap | 6 players |
| Countdown | 15 seconds (once minimum reached) |

#### 5.4.3 Hybrid Tier Matchmaking

To balance fair matches vs. queue times:

| Time in Queue | Match Range |
|---------------|-------------|
| 0-20 seconds | Same tier only |
| 20-40 seconds | ±1 tier |
| 40+ seconds | ±2 tiers |
| Hard cap | Never more than 3 tiers apart |

**Rationale:** Higher-tier players have fewer peers; expanding search prevents long waits while maintaining competitive integrity.

### 5.5 Multiplayer Gameplay

#### 5.5.1 Turn-Based Flow

- Players take turns spelling words
- All players hear the same word (but at different times)
- Word difficulty based on average rank of lobby

#### 5.5.2 Hearts

Hearts work differently based on match type:

| Match Type | Starting Hearts | Elimination Condition |
|------------|-----------------|----------------------|
| **Casual** | 3 | All hearts lost |
| **Ranked** | 1 | First wrong answer |

**Casual Mode:**
- All players start with 3 hearts
- Lose heart on wrong answer
- Eliminated when all hearts lost
- Allows comebacks and reduces frustration

**Ranked Mode:**
- All players start with 1 heart (effectively 1 strike)
- One wrong answer = immediate elimination
- Authentic spelling bee experience
- Higher tension, every word matters

#### 5.5.3 Viewing Other Players' Turns

When it's NOT your turn:

| Element | What You See |
|---------|--------------|
| Avatar | Current player's avatar above waveform |
| Hearts | Current player's remaining hearts |
| Waveform | Animates visually (no audio) |
| Input component | Disabled/grayed out |
| Timer | Counting down |
| Word audio | You do NOT hear it |

**Rationale:** Keeps everyone engaged without audio broadcasting complexity.

#### 5.5.4 Elimination Flow

When a player loses their last heart:
1. They are immediately redirected to **Results Screen**
2. Their placement is shown (e.g., "6th place" if first eliminated in 6-player game)
3. Banner: "Game still in progress..."
4. Rows above them show skeleton/shimmer (placements being decided)
5. As others eliminate, skeleton rows fill in with real data
6. When game ends, banner disappears, all rows populated

#### 5.5.5 Leaving Results Screen Early

- Player can click X to return to main app
- They receive a **notification** when game finishes
- Notification: "Your game finished! You placed 4th"
- Can view final results in Leaderboard → Solo tab

### 5.6 No Spectator Mode (v1)

Spectator mode with audio broadcasting is complex. For v1:
- Eliminated players go to results screen
- Live standings visible via skeleton UI
- Future version may add opt-in spectating

---

## 6. Word System

### 6.1 Data Source

**Merriam-Webster Dictionary API** — chosen for accuracy and trustworthiness over AI-generated content.

### 6.2 Implementation Strategy: Pre-Cached Database

**Problem:** Merriam-Webster free tier limits:
- 1,000 queries/day
- Non-commercial use only
- Commercial license required for revenue-generating apps

**Solution:** Pre-fetch and cache all word data during development.

| Approach | Description |
|----------|-------------|
| Seeding | Use API during development to build word database |
| Gameplay | Serve from own database (zero API calls) |
| Audio | Cache audio file URLs or files locally |
| Refresh | Optional nightly job to add new words |

### 6.3 Word Database Schema

```
words table:
- id
- word
- difficulty_tier (1-7)
- definition
- example_sentence
- audio_url
- part_of_speech
```

### 6.4 Word Difficulty Tiers

| Tier | Example Words | Characteristics |
|------|---------------|-----------------|
| 1 | cat, dog, sun | 3-4 letters, common, phonetic |
| 2 | house, plant, smile | 5-6 letters, common, mostly phonetic |
| 3 | garden, market, simple | 6-7 letters, some irregular spellings |
| 4 | beautiful, dangerous | 8-9 letters, silent letters, doubles |
| 5 | necessary, occurrence | 10-11 letters, commonly misspelled |
| 6 | conscientious, surveillance | 12+ letters, complex patterns |
| 7 | Championship-level words | Obscure, foreign origins |

### 6.5 Difficulty Progression by Rank

| Player Rank | Starting Tier | Progression Rate |
|-------------|---------------|------------------|
| New Bee | Tier 1 | +1 every 3 rounds |
| Bumble Bee | Tier 1-2 | +1 every 3 rounds |
| Busy Bee | Tier 2-3 | +1 every 2 rounds |
| Honey Bee | Tier 3-4 | +1 every 2 rounds |
| Worker Bee | Tier 4-5 | +1 every 2 rounds |
| Royal Bee | Tier 5-6 | +1 every round |
| Bee Keeper | Tier 6-7 | Always hardest |

### 6.6 Attribution

Merriam-Webster logo must be displayed per their branding guidelines.

---

## 7. Leaderboard

### 7.1 Navigation Tab

Leaderboard is a main navigation tab alongside Play and Profile.

### 7.2 Three Sub-Tabs

| Tab | Purpose |
|-----|---------|
| **Solo** | Personal game history |
| **Friends** | Rank comparison with friends |
| **Global** | World rankings |

### 7.3 Filters

| Filter | Options |
|--------|---------|
| Game Mode | Endless \| Blitz \| All |
| Input Method | Voice \| Keyboard \| All |

### 7.4 Solo Tab

Shows player's personal game history — **no rank or XP displayed** (see Section 3.3.1 for rationale).

**Header Stats:**
| Stat | Description |
|------|-------------|
| Total Games | Number of solo games played |
| Best Round | Highest round ever reached |
| Average Accuracy | Accuracy % across all games |

**Game History Table:**
| Column | Description |
|--------|-------------|
| Date | When the game was played (relative: "2h ago", "Yesterday") |
| Mode | Endless or Blitz |
| Round | How far they got |
| Accuracy | Correct / Total (percentage) |
| **Highlight** | Current game highlighted if viewing from results screen |

**Personal Best Indicators:**
- 🥇 New personal best (highest round ever)
- ⭐ Top 3 game (among all their games)
- 🔥 Streak badge (if they had 10+ correct in a row)

**Filters:**
- Mode: Endless | Blitz | All
- Input: Voice | Keyboard | All
- Pagination for long history

#### 7.4.1 Game Result Details

Clicking on a game in the Solo tab expands to show:

| Section | Content |
|---------|---------|
| Summary | Round reached, accuracy %, time played, best streak |
| Words Attempted | List of all words from that session |
| **Review Mistakes** | Words spelled incorrectly with comparison view |

**Review Mistakes Section:**

For each incorrect word, displays:
- The word the player attempted
- Their incorrect spelling (highlighted in red)
- The correct spelling (highlighted in green)
- Definition (for context)
- Option to hear the word pronounced

```
┌─────────────────────────────────────────────────────┐
│  📚 Review Your Mistakes (3 words)                  │
├─────────────────────────────────────────────────────┤
│  1. RECEIVE                                         │
│     You spelled: RECIEVE  ❌                        │
│     Tip: "I before E, except after C"              │
│     🔊 [ Hear word ]                                │
├─────────────────────────────────────────────────────┤
│  2. NECESSARY                                       │
│     You spelled: NECCESSARY  ❌                     │
│     Tip: One C, two S's                            │
│     🔊 [ Hear word ]                                │
├─────────────────────────────────────────────────────┤
│  3. ACCOMMODATE                                     │
│     You spelled: ACCOMODATE  ❌                     │
│     Tip: Two C's, two M's                          │
│     🔊 [ Hear word ]                                │
└─────────────────────────────────────────────────────┘
```

**Rationale:** This feature turns mistakes into learning opportunities. Players can review what went wrong after the game ends, reinforcing correct spellings through spaced repetition.

### 7.5 Friends Tab

- Same table structure as Solo
- Shows friends' stats
- Can see if you're higher/lower ranked than friends
- Search friends by name

### 7.6 Global Tab

- World rankings by XP within tier
- Ranking within same tier: Higher XP = better rank
- Tiebreaker: Accuracy %, then games played
- Pagination to see all players
- Bee Keeper highlighted at top of their track
- Search players

---

## 8. Social Features

### 8.1 Friends System

#### 8.1.1 Adding Friends

Two methods:
1. **From Leaderboard:** Click player → View profile → "Add Friend"
2. **From Profile:** Friends list widget → Search by username → Send request

#### 8.1.2 Friend Request Flow

1. User A sends request
2. User B receives notification
3. User B accepts or declines
4. If accepted, both appear in each other's Friends list

### 8.2 Chat System (v1)

#### 8.2.1 Constraints

- 1:1 only (no group chat)
- Friends only (can't message strangers)
- **Preset messages only** (no free text)

#### 8.2.2 Preset Message Options

| Message | Use Case |
|---------|----------|
| "Want to play?" | Invite friend to game |
| "Good game!" | Post-match sportsmanship |
| "Rematch?" | Quick rematch request |

**Rationale:** Avoids moderation burden, COPPA concerns, and scope creep while enabling core social coordination.

#### 8.2.3 Future Enhancements

- "Not now" response option
- Game invite button directly in chat
- Free text messaging (with moderation)

### 8.3 Block & Report

#### 8.3.1 Block

- Available on: Other player's profile, chat
- Effect: Removes from friends, hides their profile from you, they can't find you
- Confirmation required

#### 8.3.2 Report

- Available on: Profile, chat, post-game results
- Reasons: Cheating, Harassment, Inappropriate username, Other
- Optional details field
- Submitted for admin review

### 8.4 No Friend Limit

Players can have unlimited friends.

---

## 9. Profile & Settings

### 9.1 Profile Page

#### 9.1.1 Viewing Your Own Profile

| Section | Content |
|---------|---------|
| Header | Avatar, username, bio, joined date, last online, friend count |
| Actions | "Settings" button, "Share profile" button |
| Rank Cards | 4 cards (one per track) showing tier + progress |
| Match History | Table with filters, pagination |
| Friends List | Widget with search, chat buttons |

#### 9.1.2 Viewing Someone Else's Profile

| Difference | Your Profile | Their Profile |
|------------|--------------|---------------|
| Actions | Settings, Share | "Add Friend" (yellow primary button) |
| Menu | N/A | "..." with Block, Report |
| Friends List | Your friends | Not visible |

### 9.2 Settings Page

#### 9.2.1 Profile Section

| Field | Description |
|-------|-------------|
| Avatar | Choose from 3 preset options (no uploads) |
| Username | Editable, must be unique |
| Bio | Free text, shown on profile |

**No uploads rationale:** Prevents inappropriate/vulgar images.

#### 9.2.2 Privacy & Security Section

| Field | Description |
|-------|-------------|
| Connected Account | Shows "Google" or "Apple" (read-only) |
| 2FA | Future feature |
| Delete Account | Future feature |

**No auth switching:** Prevents identity confusion and security risks.

#### 9.2.3 Appearance Section

| Option | Description |
|--------|-------------|
| Light | Light theme |
| Dark | Dark theme |

#### 9.2.4 Notifications Section

| Toggle | Description |
|--------|-------------|
| Social emails | Friend requests, follows |
| Security emails | Login alerts, account activity |
| Marketing emails | New features, updates |

---

## 10. Notifications

### 10.1 In-App Notifications

Bell icon in header shows badge count.

### 10.2 Notification Types

| Trigger | Message Example |
|---------|-----------------|
| Friend request received | "John wants to be your friend" |
| Game invite | "John invited you to play" |
| Game finished | "Your game finished! You placed 4th" |
| (Future) Friend accepted | "John accepted your friend request" |

### 10.3 Email Notifications

Controlled by settings toggles (Social, Security, Marketing).

---

## 11. UI Components

### 11.1 Game Screen Components

| Component | Description |
|-----------|-------------|
| **Header** | X button, game mode label, timer progress bar |
| **Round indicator** | "Round 1", "Round 2", etc. |
| **Voice waveform** | Animated visualization, current player's avatar above (multiplayer) |
| **Hearts** | 3 red hearts **left-aligned** above input component, disappear on mistakes |
| **Input component** | Sentence button, dictionary button, record/type area, play button |
| **Helper text footer** | Shows contextual text when helper buttons are pressed (see 11.4.1) |
| **Settings button** | Bottom-right corner, floating |

### 11.2 Multiplayer-Specific Components

| Component | Description |
|-----------|-------------|
| **Player Standings sidebar** | Floating right panel, collapsible, shows all players with position/round/accuracy |
| **Current player indicator** | Avatar above waveform changes based on whose turn |

### 11.3 Input Component States

| State | Center Button | Behavior |
|-------|---------------|----------|
| Ready to record | "Record" (orange) | Tap to start |
| Recording | "Stop" (red) | Tap to submit |
| Not your turn | Disabled/grayed | Cannot interact |
| Keyboard mode | Text input | Type letters |

### 11.4 Helper Buttons

| Button | Icon | Action |
|--------|------|--------|
| Sentence | MessageSquareText | Plays example sentence using the word |
| Dictionary | BookA | Shows/plays word definition |
| Play | Volume | Replays word audio |

#### 11.4.1 Helper Button States

Helper buttons have a "pressed" state that shows feedback text below the input component:

| Button | Pressed State Text | Auto-Clear |
|--------|-------------------|------------|
| Play | "The word is being spoken..." | Yes, after ~2.5 seconds |
| Sentence | "The word is being used in a sentence..." | Yes, after ~5 seconds |
| Dictionary | Shows the word definition | No, stays visible until word changes |

**UX Behavior:**
- Only one helper can be active at a time
- Pressing a different helper cancels the previous one (prevents glitching)
- Timeouts are cleared when switching between helpers
- Helper state resets when advancing to a new word

**Implementation Notes:**
- Use a single `activeHelper` state to track which helper is pressed
- Clear any pending timeouts before setting a new helper
- Auto-clear Play/Sentence after speech duration estimate
- Definition stays visible (no auto-clear) for reference

### 11.5 Audio Feedback

#### 11.5.1 Answer Sounds

| Event | Sound | Duration |
|-------|-------|----------|
| Correct answer | `CorrectAnswerFeedback_sound.mp3` | ~1 second |
| Wrong answer | `WrongAnswerFeedback_sound.mp3` | ~1 second |

**Implementation Notes:**
- Sounds are preloaded on component mount for instant playback
- Sounds play exactly once per answer (no double-firing)
- Volume controlled by user settings (future)
- Graceful fallback if audio fails to load

#### 11.5.2 Visual Feedback Overlay

When an answer is submitted:
1. Screen flashes with feedback color (green = correct, red = wrong)
2. Sound plays simultaneously
3. Overlay auto-clears after ~400ms
4. Game advances to next phase

---

## 12. Technical Decisions

### 12.1 Voice Recognition

| Decision | Choice |
|----------|--------|
| Primary Provider | **Google Cloud Speech-to-Text** (via WebSocket server) |
| Fallback Provider | Web Speech API (browser built-in) |
| Mode | Strict — what the provider hears is final |
| No editing | Players cannot correct misheard words |

**Rationale:** Allowing edits on low confidence is exploitable (mumble intentionally to get typing fallback).

#### 12.1.0 Provider Selection

We evaluated multiple speech recognition providers for letter-by-letter spelling accuracy:

| Provider | Cost | Real-Time | Word Timing | Anti-Cheat | Decision |
|----------|------|-----------|-------------|------------|----------|
| **Google Cloud** | $0.016/min | ✅ Yes | ✅ Yes | ✅ Yes | **✅ Selected** |
| Deepgram | $0.0077/min | ✅ Yes | ✅ Yes | ✅ Yes | Considered (cheaper but less accurate for letters) |
| AssemblyAI | $0.0025/min | ✅ Yes | ✅ Yes | ✅ Yes | Considered |
| Azure Speech | $0.016/min | ✅ Yes | ✅ Yes | ✅ Yes | Removed (Google is better for letters) |
| Web Speech API | Free | ✅ Yes | ❌ No | ❌ No | **Fallback only** |

**Why Google Cloud Speech-to-Text:**
1. **Best letter recognition** — Excellent at recognizing individual letters when spoken ("A", "B", "C")
2. **Word-level timestamps** — Provides start/end times for each recognized word (critical for anti-cheat)
3. **Speech context boosting** — Boosts recognition of letter names and phonetic pronunciations
4. **Real-time streaming** — Sub-250ms latency via gRPC bidirectional streaming
5. **Reliability** — Enterprise-grade service with excellent uptime

**Cost Projection:**
| Scale | Daily Sessions | Avg Duration | Daily Cost | Monthly Cost |
|-------|----------------|--------------|------------|--------------|
| MVP (100 users) | 500 | 30 sec | ~$4 | ~$120 |
| Growth (1,000 users) | 5,000 | 30 sec | ~$40 | ~$1,200 |
| Scale (10,000 users) | 50,000 | 30 sec | ~$400 | ~$12,000 |

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Browser                                            │
│                                                                         │
│  useSpeechRecognition Hook                                              │
│         │                                                               │
│         ▼                                                               │
│  SpeechRecognitionService (lib/speech-recognition-service.ts)           │
│         │                                                               │
│         ├─────────────────────────────────────────┐                     │
│         ▼                                         ▼                     │
│  GoogleSpeechProvider (PRIMARY)           WebSpeechProvider (FALLBACK)  │
│         │                                 Browser built-in              │
│         │ WebSocket (ws://localhost:3002)                               │
│         ▼                                                               │
│  Speech Server (speech-server/index.ts)                                 │
│         │                                                               │
│         │ gRPC (bidirectional streaming)                                │
│         ▼                                                               │
│  Google Cloud Speech-to-Text API                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why a Separate WebSocket Server?**
1. **Next.js limitation**: App Router doesn't support WebSockets in route handlers
2. **Google requires gRPC**: The streaming API uses gRPC bidirectional streaming, not REST
3. **Cloudflare limitation**: Workers cannot make outbound gRPC calls (requires hybrid architecture)

**Environment Variables:**
```bash
# Google Cloud Speech-to-Text (required for primary provider)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

**Running the Speech Server:**
```bash
# Development: Run both Next.js and speech server
npm run dev:all

# Or run separately
npm run dev          # Next.js on port 3000
npm run dev:speech   # Speech server on port 3002
```

#### 12.1.1 Anti-Cheat: Spelled Letters vs Whole Word

For voice mode, players **must spell the word letter-by-letter**. Simply saying the whole word is NOT valid and will be marked as incorrect.

| Input | Word | Result | Why |
|-------|------|--------|-----|
| "C A T" | cat | ✅ Valid | Letters with pauses between them |
| "cee ay tee" | cat | ✅ Valid | Spoken letter names |
| "cat" | cat | ❌ Invalid | Said the whole word |
| "dangerous" | dangerous | ❌ Invalid | Said the whole word |

**Anti-Cheat Detection (Google Speech Provider):**

Google provides word-level timestamps from the actual audio. We use multiple signals to detect spelling vs saying:

| Signal | Spelling Pattern | Saying Pattern |
|--------|------------------|----------------|
| Word count | Multiple words (one per letter) | Single word |
| Single-letter words | High ratio (>50%) | Low ratio |
| Gaps between words | ~100-500ms pauses | No gaps |
| Duration per letter | ~0.15-0.50s per letter | <0.10s per letter |

**Per-Letter Duration Threshold:**

Based on empirical testing:
- Spelling "cat" (3 letters): ~1.5s total → 0.50s/letter ✅
- Spelling "garden" (6 letters): ~1.8s total → 0.30s/letter ✅
- Saying "dangerous" (9 letters): ~0.8s total → 0.09s/letter ❌
- Saying "beautiful" (9 letters): ~0.6s total → 0.07s/letter ❌

**Minimum threshold: 0.15 seconds per letter**
- Anything faster than this is physically impossible when spelling letter-by-letter
- Very generous to accommodate fast spellers

**Implementation:**
- `lib/providers/google-speech-provider.ts` — Multi-signal anti-cheat analysis
- `hooks/use-speech-recognition.ts` — Async stopRecording() waits for FINAL result
- `lib/answer-validation.ts` — Uses `looksLikeSpellingFromAudio` metric

**User Feedback:**
When a player says the whole word instead of spelling it:
> "Please spell the word letter by letter (e.g., 'C-A-T')"

### 12.2 Architecture

| Decision | Choice |
|----------|--------|
| Initial approach | In-repo API routes (monolith) |
| Future | Extract to microservice when scaling requires |

**Rationale:** "Monolith first" — ship faster, extract later when needed.

### 12.3 Authentication

| Decision | Choice |
|----------|--------|
| Library | **Better Auth** v1.4.x (edge-compatible OAuth) |
| Providers | Google OAuth (Apple OAuth planned) |
| No passwords | `emailAndPassword: { enabled: false }` — OAuth only |
| No switching | Can't change auth provider after signup |
| Cookie naming | Dev: `better-auth.session_token`, Prod: `__Secure-better-auth.session_token` |
| Session | 7-day expiry, cookie cache disabled |

### 12.4 Word Data

| Decision | Choice |
|----------|--------|
| Source | Merriam-Webster API |
| Strategy | Pre-cache during development |
| Live calls | None during gameplay |

### 12.5 Real-Time Multiplayer

| Decision | Choice |
|----------|--------|
| State sync | Player turn, hearts, waveform visual, timer |
| No audio broadcast | Words/voice stay private to active player |
| Elimination | Immediate redirect to results screen |

### 12.6 Skill Rating System

| Decision | Choice |
|----------|--------|
| Rating algorithm | **Glicko-2** (hidden) for skill estimation and difficulty matching |
| Visible progression | **XP + Tier** system (unchanged) for leaderboards and profiles |
| Placement | **Adaptive test** (10-15 words) using Bayesian inference |
| Word selection | Based on Glicko-2 rating, not visible XP tier |
| Matchmaking | Glicko-2 rating for skill-based pairing |

**Two Systems, Different Purposes:**

| System | Visible? | Purpose |
|--------|----------|---------|
| XP + Tier (3.3) | Yes | Progression rewards, leaderboards, bragging rights |
| Glicko-2 Rating | No | Difficulty matching, matchmaking, adaptive learning |

> **Technical Details:** See ADR-012 (Hidden Skill Rating System) and ADR-013 (Adaptive Placement Test) in ADR.md.

**Why Hidden Rating?**
- Players focus on XP progression (motivating)
- System quietly adjusts difficulty to maintain "flow state"
- Avoids anxiety from visible rating fluctuations
- Similar to how Valorant has hidden MMR separate from visible rank

---

## 13. Edge Cases & Error Handling

### 13.1 Connection & Disconnection

#### 13.1.1 Player Disconnects Mid-Game (Multiplayer)

| Scenario | Handling |
|----------|----------|
| Disconnect during own turn | Timer continues; if timer expires, auto-skip turn and lose 1 heart |
| Disconnect during other's turn | No immediate impact; rejoin window applies |
| Rejoin window | **60 seconds** to reconnect and resume |
| After 60 seconds | Player is eliminated, placed at current position |

#### 13.1.2 Host Disconnects

| Scenario | Handling |
|----------|----------|
| Host leaves lobby (pre-game) | Next player in join order becomes host |
| Host disconnects mid-game | Game continues — server manages state (not host device) |
| All players disconnect | Game ends, all players receive placement based on when they left |

**Clarification:** "Host" is a lobby management role, not the game server. Games run on Cloudflare Durable Objects, not player devices.

### 13.2 Timer Expiration

| Scenario | Handling |
|----------|----------|
| Timer runs out (Endless) | Wrong answer, lose 1 heart, move to next word |
| Timer runs out (Blitz) | Game ends, score calculated based on correct answers |
| Timer runs out during voice recording | Recording auto-stops, submitted as-is |

### 13.3 Duplicate & Invalid Submissions

| Scenario | Handling |
|----------|----------|
| Submit same answer twice rapidly | Server ignores duplicate within 2-second window |
| Submit empty answer | Treated as wrong answer |
| Submit during other player's turn | Rejected by server |
| Network delay causes late submission | Server timestamp is authoritative |

### 13.4 Concurrent Game Restriction

| Rule | Description |
|------|-------------|
| One game at a time | Player cannot join a new game while in an active game |
| What happens | "You're already in a game" message with option to return or forfeit |
| Forfeiting | Counts as elimination, receives lowest remaining placement |

**Rationale:** Prevents XP farming, simplifies state management, ensures players are engaged.

### 13.5 Account & Profile Edge Cases

| Scenario | Handling |
|----------|----------|
| Username taken | "Username already exists" — must choose different |
| Username change conflicts | Same handling — must be unique |
| Profanity in username | Blocked by filter list during creation/edit |
| OAuth token expired | Redirect to re-authenticate |
| OAuth provider unavailable | Show error, suggest trying later |

### 13.6 Voice Recognition Edge Cases

| Scenario | Handling |
|----------|----------|
| No audio detected | "We didn't hear anything. Please try again." |
| Audio too quiet | Same as above |
| Speech recognition returns gibberish | Submitted as-is (strict mode — no second chances) |
| Microphone permission denied | Prompt to enable, offer keyboard as alternative |
| Background noise interferes | Player responsible for quiet environment |

### 13.7 Game State Recovery

| Scenario | Handling |
|----------|----------|
| Browser refresh mid-game | Reconnect to active game if within rejoin window |
| App crash | Same as disconnect — rejoin window applies |
| Server restart | Durable Objects persist state; games resume automatically |

---

## 14. Privacy & Compliance

### 14.1 Data Collection

#### 14.1.1 What We Collect

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Email (from OAuth) | Account identification | Until account deletion |
| Username | Display name | Until account deletion |
| Age | Age-gating, compliance | Until account deletion |
| Game history | Stats, leaderboards | Until account deletion |
| Voice recordings | Transcription only | **Deleted immediately after transcription** |
| IP address | Security, rate limiting | 30 days |
| Device info | Debugging | 30 days |

#### 14.1.2 What We Don't Collect

- Passwords (OAuth only)
- Location data
- Contact lists
- Payment information (no monetization in v1)
- Voice recordings beyond immediate transcription

### 14.2 Voice Data Handling

| Rule | Description |
|------|-------------|
| Storage | Voice audio is **never stored** — processed in memory |
| Transmission | Encrypted via TLS (WebSocket to speech server) |
| Transcription | Google Cloud Speech-to-Text — gRPC streaming, no audio stored |
| Retention | 0 seconds — deleted immediately after transcription |

**Rationale:** Voice is sensitive biometric data. We minimize liability by not storing it.

### 14.3 GDPR Compliance (EU Users)

| Requirement | Implementation |
|-------------|----------------|
| Right to access | Export data feature (future) |
| Right to deletion | Account deletion with 7-day grace period |
| Data portability | JSON export of game history (future) |
| Consent | Clear opt-in at signup |
| Cookie consent | Banner for non-essential cookies |

### 14.4 COPPA Considerations (US Users Under 13)

| Approach | Description |
|----------|-------------|
| Age gate | Required age field during signup |
| Under 13 handling | **v1: Block signup** — "You must be 13 or older to create an account" |
| Future option | Parental consent flow with verification |
| No PII from minors | If age < 13, no account creation = no data collection |

**Rationale:** Full COPPA compliance requires parental consent verification which is complex. Blocking under-13 is simpler for v1.

### 14.5 Account Deletion

| Step | Description |
|------|-------------|
| 1. Request | User clicks "Delete Account" in Settings |
| 2. Confirmation | "This will permanently delete your account and all data. This cannot be undone." |
| 3. Grace period | **7 days** — account marked for deletion but not removed |
| 4. Cancel option | User can login within 7 days to cancel deletion |
| 5. Final deletion | After 7 days, all personal data is deleted |
| 6. Anonymization | Game history retained with anonymized player ID for leaderboard integrity |

### 14.6 Third-Party Services

| Service | Data Shared | Purpose |
|---------|-------------|---------|
| Google OAuth (via Better Auth) | Email, name | Authentication |
| Cloudflare Workers + D1 | Request data, IP, game data | Hosting, database |
| Cloudflare R2 | Audio files | Object storage for word audio |
| Railway | Audio stream (voice data) | Speech WebSocket server hosting |
| Google Cloud Speech-to-Text | Voice audio (not stored) | Real-time letter recognition |
| PostHog | Anonymous usage events | Analytics (planned) |
| Sentry | Error logs (no PII) | Error tracking (planned) |

### 14.7 Language Scope

| Version | Languages |
|---------|-----------|
| v1 | **English only** |
| Future | Spanish, French, German (potential) |

**Rationale:** Merriam-Webster is English-only. Expanding to other languages requires different dictionary APIs and localization effort.

---

## 15. XP Thresholds & Crown Points Details

> **Important:** XP and rank tiers are **only relevant for multiplayer**. Solo games do not display or track XP — see Section 3.3.1 for rationale.

### 15.1 XP Thresholds Per Tier (Multiplayer)

| Tier | Name | XP Required | XP to Next Tier |
|------|------|-------------|-----------------|
| 1 | New Bee | 0 | 500 |
| 2 | Bumble Bee | 500 | 1,000 |
| 3 | Busy Bee | 1,500 | 2,000 |
| 4 | Honey Bee | 3,500 | 3,500 |
| 5 | Worker Bee | 7,000 | 5,000 |
| 6 | Royal Bee | 12,000 | N/A (Crown Points take over) |
| 7 | Bee Keeper | N/A | Crown Points leader |

**Notes:**
- Bee Keeper is not an XP threshold — it's the Royal Bee with the most Crown Points in each track
- XP can go UP (win) or DOWN (lose) in multiplayer — see Section 3.3.5 for demotion rules
- These thresholds apply per-track (4 separate ranks for each mode/input combination)

### 15.2 XP Gain/Loss by Game Type

#### 15.2.1 Multiplayer XP (Base Values)

| Placement | XP Change |
|-----------|-----------|
| 1st | +50 |
| 2nd | +30 |
| 3rd | +10 |
| 4th | -10 |
| 5th | -20 |
| 6th | -30 |

#### 15.2.2 Solo Game XP

**Solo games do NOT display or track visible XP.** See Section 3.3.1 for the design rationale.

| What's Tracked | What's NOT Tracked |
|----------------|-------------------|
| Game history (rounds, accuracy) | Visible XP |
| Hidden Glicko-2 rating (for word difficulty) | Rank progression |
| Personal best stats | XP gains/losses |

**Why no XP in solo?**
- Solo is practice mode, not competitive mode
- Showing XP creates anxiety without the reward of beating opponents
- Players should focus on "Am I improving?" not "Am I climbing?"
- Prevents "protect my rank by not playing" behavior

### 15.3 Crown Points System (Royal Bees Only)

#### 15.3.1 Earning Crown Points

| Action | Crown Points |
|--------|--------------|
| 1st place in multiplayer | +50 CP |
| 2nd place in multiplayer | +30 CP |
| 3rd place in multiplayer | +15 CP |
| 4th place or lower | +5 CP |
| Beat another Royal Bee | +10 CP bonus |
| Endless streak (10+ rounds) | +20 CP |
| Endless streak (20+ rounds) | +40 CP |

#### 15.3.2 Crown Points Rules

| Rule | Description |
|------|-------------|
| Can go down? | **No** — Crown Points never decrease from gameplay |
| Inactivity decay | Yes — 10% loss per week if no games played for 7+ days |
| Decay cap | Minimum 0 CP (can't go negative) |
| Track separation | Crown Points are tracked separately per track |

#### 15.3.3 Bee Keeper Determination

| Rule | Description |
|------|-------------|
| How many? | 4 total (one per track) |
| Who qualifies? | The Royal Bee with the highest Crown Points in each track |
| Ties | Player who reached the CP total first wins |
| Can lose title? | Yes — if another Royal Bee surpasses your CP |
| Demotion? | If CP drops below Royal Bee threshold via decay, demote to Royal Bee |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Crown Points** | Points earned by Royal Bees competing for Bee Keeper title |
| **Track** | A specific combination of game mode + input method (4 total) |
| **Placement Test** | Adaptive assessment (~10-15 words) using Bayesian inference. Currently reserved for future ranked/multiplayer — not part of onboarding. See Section 2.2.2. |
| **Skill Rating (Hidden)** | Glicko-2 rating (1000-1900) used internally for word difficulty selection and matchmaking. Not visible to players. See ADR-012 in ADR.md. |
| **Rating Deviation (RD)** | Glicko-2 uncertainty measure (30-350). High RD = uncertain skill, ratings change more. |
| **Skeleton UI** | Shimmering placeholder shown while data is loading |
| **Hybrid Matchmaking** | System that expands tier range over time to reduce queue wait |
| **IRT (Item Response Theory)** | Statistical model used in placement test to estimate player skill based on correct/incorrect answers |

---

## Appendix B: Future Features (Out of Scope for v1)

- Apple OAuth sign-in
- Guest mode for multiplayer
- 2FA authentication
- Free-text chat messaging
- Spectator mode with audio
- Account deletion
- Group chat
- Tournaments/seasons
- Achievement badges

---

*End of PRD*
