# PlayLexi — Product Requirements Document (PRD)

> **Version:** 1.0
> **Last Updated:** December 21, 2025
> **Status:** Final Draft

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

The external marketing website (separate repo) has two buttons:
1. **"Get Started"** → New user flow
2. **"An Account I Already Have"** → Existing user flow

### 2.2 New User Flow

```
Marketing Site → "Get Started" → PlayLexi App
                                      ↓
                               Tutorial (3 steps)
                                      ↓
                               Placement Game
                                      ↓
                               Rank Assignment
                                      ↓
                               OAuth Sign Up (Google/Apple)
                                      ↓
                               Complete Profile
                                      ↓
                               Main App
```

#### 2.2.1 Tutorial (3 Steps)

| Step | Title | Description |
|------|-------|-------------|
| 1 | "Press Start, then listen carefully to the word" | You can replay the word as many times as you'd like. Use the definition and sentence buttons for extra clues. |
| 2 | "Use the microphone and spell the word letter by letter" | Saying the whole word will not count towards the microphone's recording, only letters. |
| 3 | "Advance through as many rounds as you can" | You start with 3 lives, and each mistake costs one life. Once you run out, the game ends. |

- Progress bar shows completion (33% → 66% → 100%)
- "Skip" link available on all steps
- "Continue" button advances, "Go back" returns to previous
- "Finish" on step 3 starts placement game

#### 2.2.2 Placement Game

- Format: Endless mode
- Hearts: 3 (same as regular Endless)
- Purpose: Determine starting rank based on highest difficulty reached
- One-time only (cannot be replayed)
- Word difficulty increases each round until all hearts lost

#### 2.2.3 Rank Assignment Screen

After placement game:
- Display: Rank badge with tier name (e.g., "You've qualified as a 'New Bee' Rank")
- Prompt: "Create an account to save your progress and continue playing for free."
- Buttons: "Sign up with Google" | "Sign up with Apple"
- Link: "Already have an account? Sign in"

#### 2.2.4 OAuth Sign Up

- Google or Apple OAuth popup appears
- No custom password storage (security measure)
- OAuth handles authentication entirely

#### 2.2.5 Complete Profile

After OAuth:
- Fields:
  - Username (must be unique)
  - Age (required)
  - Avatar (choose from 3 presets)
- Button: "Create" → Enters main app

### 2.3 Existing User Flow

```
Marketing Site → "I Have an Account" → PlayLexi App
                                            ↓
                                      OAuth Login
                                            ↓
                                       Main App
```

- Direct to OAuth (Google/Apple)
- No tutorial, no placement game
- Straight to main app dashboard

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

#### 3.3.1 Base XP from Placement (Multiplayer)

| Placement | Base XP |
|-----------|---------|
| 1st | +50 |
| 2nd | +30 |
| 3rd | +10 |
| 4th | -10 |
| 5th | -20 |
| 6th | -30 |

#### 3.3.2 Weighted Modifiers (Mixed-Tier Lobbies)

When players of different ranks are in the same lobby:

| Scenario | Modifier |
|----------|----------|
| You're the **lowest rank** in lobby | Gains +25-50%, losses reduced 25-50% |
| You're the **highest rank** in lobby | Gains -25%, losses +25-50% |
| Lobby is **same tier** | No modifier (1x) |

**Rationale:** Protects underdogs, prevents high-rank players from farming easy wins.

#### 3.3.3 XP Consistency

The same XP system applies to:
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

### 4.1 Single Player

#### 4.1.1 Endless Mode

| Attribute | Value |
|-----------|-------|
| Objective | Advance through as many rounds as possible |
| Hearts | 3 (game ends when all lost) |
| Word difficulty | Increases each round |
| Timer | Per-word, adjusts based on word difficulty (10-35 seconds) |
| Wrong answer | Lose 1 heart, move to new word (don't repeat) |

#### 4.1.2 Blitz Mode

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

---

## 5. Multiplayer

### 5.1 Multiplayer Types

| Type | Description |
|------|-------------|
| **Local** | Players in same physical location, each on their own device |
| **Online Private** | Remote players, join via room code |
| **Online Public** | Matchmaking queue, auto-matched with similar ranks |

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

- All players start with 3 hearts
- Lose heart on wrong answer
- Eliminated when all hearts lost

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

Shows player's match history:
- Rank badge + progress bar (XP to next tier)
- Table columns: Placement, Ranking, Round, Accuracy, XP Earned
- Pagination for long history
- Filter by mode/input

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
| **Hearts** | 3 red hearts above input component, disappear on mistakes |
| **Input component** | Sentence button, dictionary button, record/type area, play button |
| **Definition footer** | Shows definition when dictionary button pressed |
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

---

## 12. Technical Decisions

### 12.1 Voice Recognition

| Decision | Choice |
|----------|--------|
| Provider | OpenAI Whisper (self-hosted) |
| Mode | Strict — what Whisper hears is final |
| No editing | Players cannot correct misheard words |

**Rationale:** Allowing edits on low confidence is exploitable (mumble intentionally to get typing fallback).

### 12.2 Architecture

| Decision | Choice |
|----------|--------|
| Initial approach | In-repo API routes (monolith) |
| Future | Extract to microservice when scaling requires |

**Rationale:** "Monolith first" — ship faster, extract later when needed.

### 12.3 Authentication

| Decision | Choice |
|----------|--------|
| Providers | Google OAuth, Apple OAuth |
| No passwords | Don't store credentials |
| No switching | Can't change auth provider after signup |

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

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Crown Points** | Points earned by Royal Bees competing for Bee Keeper title |
| **Track** | A specific combination of game mode + input method (4 total) |
| **Placement Game** | One-time assessment for new users to determine starting rank |
| **Skeleton UI** | Shimmering placeholder shown while data is loading |
| **Hybrid Matchmaking** | System that expands tier range over time to reduce queue wait |

---

## Appendix B: Future Features (Out of Scope for v1)

- Guest mode for multiplayer
- 2FA authentication
- Free-text chat messaging
- Spectator mode with audio
- Account deletion
- Group chat
- Tournaments/seasons
- Achievement badges
- Daily challenges

---

*End of PRD*
