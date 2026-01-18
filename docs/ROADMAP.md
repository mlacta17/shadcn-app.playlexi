# PlayLexi Technical Roadmap

> **Last Updated:** January 18, 2026
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

### Phase 4: Phonetic Calibration (Future)

**Goal:** Improve accuracy for users with accents or non-standard pronunciation.

**Concept:** During onboarding, have users spell A-Z. Capture how Google transcribes their pronunciation of each letter. Store a mapping per user.

**Example:**
```json
{
  "userId": "abc123",
  "phoneticMap": {
    "are": "R",
    "double you": "W",
    "zed": "Z",
    "aitch": "H"
  }
}
```

**Benefits:**
- Dramatically better accuracy for accented users
- Natural fit in onboarding flow
- Could be made fun ("Teach the bee your voice!")

**Technical Considerations:**
- Database storage for user phonetic profiles
- Integration with answer-validation.ts
- Google Speech's [speech adaptation](https://cloud.google.com/speech-to-text/docs/adaptation) API

**Definition of Done:**
- Users can calibrate their pronunciation
- System uses calibration data to improve recognition
- Measurably better accuracy for non-standard accents

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-18 | Reverted Web Audio API game sounds to HTMLAudioElement | Web Audio API caused freezing in Chrome |
| 2026-01-18 | Reverted Safari-specific audio fixes | Fixes made Chrome unstable |
| 2026-01-18 | Safari voice mode deprioritized vs typing mode | Pragmatic approach: ship working game first |

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
