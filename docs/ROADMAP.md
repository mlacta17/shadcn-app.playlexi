# PlayLexi Technical Roadmap

> **Last Updated:** February 15, 2026
> **Status:** Active Development

---

## Executive Summary

This document captures the technical roadmap, known issues, and recommendations for PlayLexi's speech recognition and input systems. It serves as a living document to ensure continuity across development sessions.

---

## Current State (January 2026)

### What's Working

| Feature | Browser | Status |
|---------|---------|--------|
| Voice mode (Google Speech) | Chrome/Firefox | ✅ Stable |
| Game sounds | Chrome/Firefox | ✅ Stable |
| Anti-cheat (spelling detection) | Chrome/Firefox | ✅ Stable |
| Waveform visualization | Chrome/Firefox | ✅ Stable |
| Typing mode | All browsers | ⚠️ Needs polish |

### Known Issues

| Issue | Browser | Severity | Root Cause |
|-------|---------|----------|------------|
| Recording causes freezing/lag | Safari | **Critical** | AudioContext conflicts, ScriptProcessorNode on main thread |
| Audio volume drops after recording | Safari | High | WebKit audio ducking (Bug 218012) |
| Accuracy worse than Chrome | Safari | High | Symptom of freezing (audio chunks dropped) |
| Recording state lags | Safari | Medium | Main thread blocked by audio processing |

---

## Safari Audio Issues: Technical Deep Dive

### Why Safari Is Different

Safari's WebKit engine handles Web Audio API differently than Chrome's Blink:

1. **ScriptProcessorNode runs on main thread** (Chrome uses AudioWorklet off-thread)
2. **Multiple AudioContexts compete for resources** (Chrome handles this gracefully)
3. **Audio ducking is automatic and persistent** (Volume drops when mic is active)
4. **Sample rate conflicts** (Safari prefers 44100Hz, Google Speech wants 16000Hz)

### What We've Tried (and learned)

| Attempt | Result | Lesson |
|---------|--------|--------|
| Web Audio API for game sounds | Caused freezing | Don't create multiple AudioContexts |
| speechSynthesis reset after recording | Made things worse | More complexity = more problems |
| Higher sample rate (44100Hz) | Untested in isolation | Could help with sample rate conflicts |
| AudioWorklet instead of ScriptProcessor | Not attempted | Potential solution for off-thread processing |

### References

- [WebKit Bug 218012: Audio Ducking](https://bugs.webkit.org/show_bug.cgi?id=218012)
- [ScriptProcessorNode Deprecation](https://developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode)
- [AudioWorklet API](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

---

## Recommended Roadmap

### Phase 1: Typing Mode First (Immediate)

**Goal:** Provide a reliable experience on ALL browsers.

**Why:** Typing mode is 100% accurate, works everywhere, and requires no browser-specific workarounds. It's also more accessible (deaf/hard-of-hearing users, quiet environments).

**Tasks:**
- [ ] Polish typing mode UI/UX to match voice mode quality
- [ ] Add user preference for default input mode
- [ ] Safari users default to typing mode
- [ ] Voice mode available but labeled "experimental" on Safari

**Definition of Done:**
- Typing mode feels as fun and responsive as voice mode
- Safari users can play the game without issues

---

### Phase 2: Stabilize Chrome Voice Mode (Short-term)

**Goal:** Ensure Chrome/Firefox voice experience remains excellent.

**Why:** Voice mode works well on Chrome. Don't regress while fixing Safari.

**Tasks:**
- [ ] Add browser detection logging for debugging
- [ ] Create automated tests for voice mode (if possible)
- [ ] Document the current working state
- [ ] Add performance monitoring (track freeze occurrences)

**Definition of Done:**
- Chrome voice mode has zero regressions
- We have visibility into any issues that arise

---

### Phase 3: Safari Voice Mode (Medium-term, Separate Branch)

**Goal:** Get voice mode working on Safari without breaking Chrome.

**Approach:**
- Create `safari-voice-fixes` branch
- All Safari experimentation happens in isolation
- Merge only when proven stable on BOTH Safari AND Chrome

**Potential Solutions to Explore:**

1. **Single AudioContext Architecture**
   - Share one AudioContext between speech recognition and game sounds
   - Requires significant refactoring

2. **AudioWorklet for Audio Processing**
   - Move audio processing off main thread
   - Modern API, may not work on older Safari versions

3. **Lower Processing Load**
   - Reduce sample rate (if Google Speech accepts it)
   - Increase chunk interval (trade latency for stability)
   - Disable waveform during recording on Safari

4. **Disable Game Sounds During Recording**
   - Simplest workaround
   - Not ideal UX but prevents AudioContext conflicts

**Definition of Done:**
- Safari voice mode works without freezing
- Chrome voice mode is unaffected
- Both are tested thoroughly before merge

---

### Phase 4: Adaptive Phonetic Learning System

> **Branch:** `feature/google-speech-api`
> **Status:** Phase 4.1 Complete, Phase 4.2 Ready for Testing
> **Last Updated:** January 18, 2026

**Goal:** Automatically improve speech recognition accuracy for users with accents or non-standard pronunciation by learning from their gameplay.

---

#### The Problem

The current system uses 366 hardcoded phonetic mappings (e.g., "tee" → "T", "oh" → "O"). This works for ~80% of users but fails for:

1. **Regional accents** - British "zed" vs American "zee"
2. **Non-native speakers** - Different vowel sounds
3. **Google Speech artifacts** - "ohs" instead of "oh", extra "s" added
4. **Unpredictable mishearings** - We can't anticipate every variation

**Example failure:**
```
User spells: "T-O"
User says: "tee oh"
Google hears: "tee ohs"  ← Unexpected artifact
System extracts: "tos"   ← Wrong!
Correct answer: "to"
Result: WRONG ❌ (frustrating for user)
```

---

#### The Solution: Three-Tier Mapping System

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: Global Defaults (SPOKEN_LETTER_NAMES)              │
│  - 366 hardcoded mappings in answer-validation.ts           │
│  - Works for ~80% of users                                  │
│  - Maintained in code                                       │
├─────────────────────────────────────────────────────────────┤
│  TIER 2: Auto-Learned Mappings (per user)                   │
│  - System learns from user's gameplay patterns              │
│  - Stored in database                                       │
│  - No user action required                                  │
├─────────────────────────────────────────────────────────────┤
│  TIER 3: Manual Calibration (optional, future)              │
│  - User explicitly corrects mappings                        │
│  - "When I say O, you hear 'ohs' - fix that"               │
│  - Only if auto-learning isn't enough                       │
└─────────────────────────────────────────────────────────────┘

Lookup order: Tier 3 → Tier 2 → Tier 1
```

---

#### How Auto-Learning Works

**Key insight:** We know the correct answer beforehand, so we can deduce unknown mappings.

```
Word to spell: "TO"
Google hears: ["tee", "ohs"]

Step 1: Look up known mappings
  - "tee" → "t" (known ✅)
  - "ohs" → ??? (unknown ❓)

Step 2: Deduce the unknown
  - Correct word = "to" (2 letters: t, o)
  - Known so far = "t" (1 letter)
  - Remaining = "o"
  - Therefore: "ohs" must equal "o"

Step 3: Store learned mapping (after 2+ occurrences)
  - { userId, heard: "ohs", intended: "o", confidence: 0.8 }

Step 4: Next time this user says "ohs"
  - System maps it to "o" automatically
  - User's answer is now correct ✅
```

**Constraints for learning:**
- Only learn when exactly ONE unknown exists (can't deduce multiple)
- Require 2+ occurrences before creating a mapping (prevents one-off errors)
- Per-user mappings only (Maria's "ohs" → "o" doesn't affect other users)

---

#### Implementation Phases

**Phase 4.1: Data Collection (Logging)** ✅ COMPLETE

Recognition event logging is now integrated into the game:

- **Database migration**: `migrations/0001_add_phonetic_learning.sql`
- **Hooks created**:
  - `hooks/use-user-id.ts` - Anonymous device ID for pre-auth logging
  - `hooks/use-phonetic-learning.ts` - Fire-and-forget logging integration
- **Game integration**: `app/(focused)/game/endless/page.tsx` now logs all voice answers
- **Learning trigger**: `triggerLearning()` called when game ends

What gets logged:
- What word the user was trying to spell
- What Google transcribed (raw)
- What letters we extracted
- Whether the answer was correct
- Rejection reason (if any)

**Anonymous Logging Design Decision:**

The `recognition_logs` table intentionally has NO foreign key constraint on `user_id`. This allows:
- Logging from anonymous users (device-based ID stored in localStorage)
- Seamless transition when auth is integrated later
- No data loss - anonymous logs can be linked to authenticated users post-auth

The `user_phonetic_mappings` table DOES have a FK constraint - mappings require authenticated users.

**Phase 4.2: Auto-Learning Engine** ✅ IMPLEMENTED (Ready for Testing)

The learning engine is implemented and ready:
- `lib/phonetic-learning/learning-engine.ts` - Inference algorithm
- `lib/phonetic-learning/mapping-store.ts` - Database operations
- **Safety mechanism**: Protected mappings prevent learning incorrect patterns
- **CRITICAL: Protect against learning incorrect mappings**

**Safety Mechanism (Implemented)**

The system includes safeguards to prevent learning WRONG mappings:

```
Problem scenario:
- User says "B" but Google mishears as "vee"
- Without safeguards: system learns "vee" → "b" (WRONG!)
- This would corrupt legitimate "V" inputs

Solution:
- All 366 global mappings are "protected"
- If a "heard" value exists in SPOKEN_LETTER_NAMES, it can NEVER be overridden
- Example: "vee" → "v" is protected, so we can't learn "vee" → "b"
```

See `lib/phonetic-learning/learning-engine.ts`:
- `isProtectedMapping()` - Checks if a "heard" value is protected
- `validatePotentialMapping()` - Full validation before creating mappings

**Phase 4.3: Manual Calibration (Future, if needed)**

Only build if auto-learning proves insufficient:
- Settings page: "Train your voice"
- User explicitly corrects problematic mappings

---

#### Database Schema

```sql
-- Recognition event logs (for pattern detection)
CREATE TABLE recognition_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  word_to_spell TEXT NOT NULL,
  google_transcript TEXT NOT NULL,
  extracted_letters TEXT NOT NULL,
  was_correct INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Learned phonetic mappings (per user)
CREATE TABLE user_phonetic_mappings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  heard TEXT NOT NULL,           -- What Google heard (e.g., "ohs")
  intended TEXT NOT NULL,        -- What it should map to (e.g., "o")
  source TEXT NOT NULL,          -- "auto_learned" or "manual"
  confidence REAL DEFAULT 1.0,   -- For auto-learned mappings
  occurrence_count INTEGER DEFAULT 1,
  times_applied INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, heard)
);
```

---

#### File Structure

```
lib/
├── phonetic-learning/
│   ├── index.ts              # Public exports
│   ├── types.ts              # TypeScript interfaces
│   ├── recognition-logger.ts # Phase 4.1: Event logging ✅
│   ├── learning-engine.ts    # Phase 4.2: Inference algorithm ✅
│   └── mapping-store.ts      # Database operations ✅
│
├── answer-validation.ts      # Will be modified to use learned mappings (Phase 4.2b)

hooks/
├── use-user-id.ts            # Anonymous device ID hook ✅
├── use-phonetic-learning.ts  # Learning integration hook ✅

app/
├── (focused)/game/endless/page.tsx     # Integrated with phonetic learning ✅

migrations/
├── 0001_add_phonetic_learning.sql  # Database tables ✅
```

---

#### Integration Points

1. **answer-validation.ts** - Merge user mappings with global defaults
2. **app/(focused)/game/endless/page.tsx** - Logs recognition events during feedback phase
3. **hooks/use-phonetic-learning.ts** - Hook that manages logging and learning triggers
4. **API routes** - Endpoints for reading/writing phonetic data:
   - `POST /api/phonetic-learning/log` - Log recognition events
   - `GET /api/phonetic-learning/mappings` - Fetch user mappings
   - `POST /api/phonetic-learning/learn` - Trigger learning analysis

#### Speech Server Architecture

The phonetic learning system integrates with the existing speech server architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL DEVELOPMENT                                               │
│                                                                  │
│  ┌─────────────┐    WebSocket     ┌──────────────────┐          │
│  │  Next.js    │ ◄──────────────► │  speech-server/  │          │
│  │  (port 3000)│  ws://localhost  │  (port 3002)     │          │
│  └─────────────┘       :3002      └────────┬─────────┘          │
│        │                                   │                     │
│        │                                   │ gRPC                │
│        ▼                                   ▼                     │
│  ┌─────────────┐              ┌──────────────────────┐          │
│  │ Phonetic    │              │ Google Cloud Speech  │          │
│  │ Learning    │              │ (streaming API)      │          │
│  │ (logs to DB)│              └──────────────────────┘          │
│  └─────────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PRODUCTION                                                      │
│                                                                  │
│  ┌─────────────┐    WebSocket     ┌──────────────────┐          │
│  │  Cloudflare │ ◄──────────────► │ speech.playlexi  │          │
│  │  Workers    │  wss://speech    │    .com          │          │
│  └─────────────┘   .playlexi.com  └────────┬─────────┘          │
│        │                                   │                     │
│        │                                   │ gRPC                │
│        ▼                                   ▼                     │
│  ┌─────────────┐              ┌──────────────────────┐          │
│  │ Phonetic    │              │ Google Cloud Speech  │          │
│  │ Learning    │              │ (streaming API)      │          │
│  │ (logs to DB)│              └──────────────────────┘          │
│  └─────────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key points:**
- Speech transcription flows through the WebSocket server (speech-server/)
- Phonetic learning logs the RESULTS of transcription (not the audio)
- Learning analysis runs async, doesn't block gameplay
- Local dev: `npm run dev:speech` starts the WebSocket server
- Production: `speech.playlexi.com` handles WebSocket connections

---

#### Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| First-attempt accuracy (all users) | ~80% | ~90% |
| Accuracy after 10 games (with learning) | ~80% | ~95% |
| User-reported phonetic issues | Common | Rare |

---

#### Decisions Made

| Decision | Rationale |
|----------|-----------|
| Auto-learn first, manual calibration later | Simpler UX, no user effort required |
| Per-user mappings (not global) | Accents vary; one user's fix might break another |
| Require 2+ occurrences to learn | Prevents learning from one-off Google errors |
| Database storage (not localStorage) | Syncs across devices, enables analytics |
| Keep existing 366 mappings as fallback | Don't break what works for 80% of users |

---

#### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Learning wrong mappings | Require multiple occurrences, confidence scoring |
| Database bloat from logs | Retention policy (delete logs older than 30 days) |
| Performance impact | Index on user_id, lazy-load mappings |
| Cheating via learned mappings | Anti-cheat runs BEFORE phonetic mapping |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-18 | Reverted Web Audio API game sounds to HTMLAudioElement | Web Audio API caused freezing in Chrome |
| 2026-01-18 | Reverted Safari-specific audio fixes | Fixes made Chrome unstable |
| 2026-01-18 | Safari voice mode deprioritized vs typing mode | Pragmatic approach: ship working game first |
| 2026-01-18 | Chose adaptive learning over static phonetic mapping | Can't predict all accent variations; system should learn |
| 2026-01-18 | Auto-learning first, manual calibration optional | Simpler UX; users shouldn't need to train the system manually |
| 2026-01-18 | Per-user mappings stored in database | Syncs across devices; enables analytics; isolates user-specific patterns |
| 2026-01-18 | Require 2+ occurrences before learning a mapping | Prevents learning from one-off Google Speech errors |
| 2026-01-18 | Keep existing 366 hardcoded mappings as Tier 1 | Works for ~80% of users; don't break what works |
| 2026-01-18 | Created feature/phonetic-calibration branch | Isolate experimental work from main branch |

---

## Principles

1. **Don't break what works.** Chrome voice mode is valuable. Protect it.
2. **Ship working software.** A game that works everywhere with typing is better than voice that only works on Chrome.
3. **Isolate experiments.** Safari fixes go in a separate branch until proven stable.
4. **Measure, don't guess.** Add logging/monitoring before making changes.
5. **Simple beats clever.** HTMLAudioElement is less cool than Web Audio API, but it works.

---

## Questions to Resolve

1. **Is typing mode currently polished enough?** Need to review and test.
2. **What Safari version(s) are users on?** Desktop, iOS, iPad?
3. **What's the target device mix?** Helps prioritize Safari effort.
4. **Is phonetic calibration worth the complexity?** Depends on target audience.

---

## Related Documents

- [PRD.md](./PRD.md) - Product requirements
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture
- [SETUP.md](./SETUP.md) - Development setup
- [speech-server/README.md](../speech-server/README.md) - Speech server documentation

---

*This document should be updated as we make progress or learn new information.*
