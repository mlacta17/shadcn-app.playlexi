# PlayLexi — Component Inventory

> **Version:** 1.1
> **Last Updated:** December 21, 2025
> **Purpose:** Track all UI components and hooks needed for PlayLexi, their design status, and implementation status.

---

## How to Use This Document

1. **Before implementing a feature**, check if all required components have designs
2. **After designing a component**, update the Design Status column
3. **After implementing a component**, update the Implementation Status column
4. **If you discover a missing component**, add it to the appropriate section

### Status Legend

| Status | Meaning |
|--------|---------|
| `Not Started` | No work begun |
| `In Progress` | Currently being worked on |
| `Ready` | Design complete, ready for implementation |
| `Done` | Fully implemented and tested |
| `Blocked` | Waiting on dependency or decision |

---

## 1. Core Game Components

These components are **blocking for MVP** — the game cannot function without them.

| Component | Description | Design Status | Implementation Status | Notes |
|-----------|-------------|---------------|----------------------|-------|
| **VoiceWaveform** | Animated audio visualization during recording | Done | Done | **Presentational only.** Canvas-based, uses AnalyserNode, has idle/active states. Located at `components/ui/voice-waveform.tsx`. Does NOT handle audio capture — that's `useSpeechRecognition` hook. |
| **HeartsDisplay** | 3 heart icons showing remaining lives | Done | Done | **Presentational.** Shows remaining hearts with shake+fade animation on loss. Uses `--destructive` color, 20px hearts, 2px gap. Located at `components/game/hearts-display.tsx`. Animation defined in `globals.css`. Respects `prefers-reduced-motion`. |
| **GameTimer** | Progress bar countdown timer | Done | Done | **Wrapper pattern.** Wraps existing `Progress` component. Uses `--primary` (yellow) for normal state, `--destructive` (red) for critical (≤5 seconds). Located at `components/game/game-timer.tsx`. Use with `useGameTimer` hook for countdown logic. |
| **SpeechInput** | Microphone recording interface | Done | Done | **Presentational component** with optional VoiceWaveform integration. Pass `analyserNode` prop to render waveform above input. Handles record/stop buttons, shows transcript, **includes helper buttons (Sentence/Dictionary/Play)**. Located at `components/ui/speech-input.tsx`. Use with `useSpeechRecognition` hook for voice capture. |
| **KeyboardInput** | Text input for typing spelling | Done | Done | **Implemented as `mode="keyboard"` in SpeechInput.** Uses hidden input with auto-focus, discriminated union types for type safety. See SpeechInput above. |
| **GameResultCard** | Final placement display after game | Not Started | Not Started | Shows rank badge, XP earned, stats |
| **GameFeedbackOverlay** | Visual feedback overlay for correct/wrong answers | Done | Done | **Presentational.** Full-screen flash overlay. Green for correct, `--destructive` for wrong. 400ms animation. Located at `components/game/game-feedback-overlay.tsx`. Use with `useGameFeedback` hook for state and `useGameSounds` hook for audio. |

---

## 2. Multiplayer Components

Required for multiplayer functionality.

| Component | Description | Design Status | Implementation Status | Notes |
|-----------|-------------|---------------|----------------------|-------|
| **PlayerStandingsSidebar** | Collapsible panel with all players | Not Started | Not Started | Desktop + mobile responsive; floating right |
| **PlayerRow** | Individual player in standings | Not Started | Not Started | Avatar, name, round, accuracy, hearts, elimination status |
| **CurrentPlayerIndicator** | Avatar above waveform showing whose turn | Not Started | Not Started | Changes based on active player |
| **LobbyPlayerList** | Pre-game player cards in lobby | Not Started | Not Started | Show ready status, host badge |
| **RoomCodeDisplay** | Large room code with copy button | Not Started | Not Started | "BEE42" style display |
| **MatchmakingSpinner** | Searching for players animation | Not Started | Not Started | Timer showing queue time, cancel button |
| **TierRangeIndicator** | Shows matchmaking tier expansion | Not Started | Not Started | Visual feedback as queue expands |
| **HostBadge** | Badge indicating lobby host | Not Started | Not Started | Small crown or star icon |
| **ReadyButton** | Toggle ready status in lobby | Not Started | Not Started | Green when ready, gray when not |
| **GameCountdown** | 3-2-1 countdown before game starts | Not Started | Not Started | Large animated numbers |

---

## 3. Rank & Progression Components

For displaying player progression.

| Component | Description | Design Status | Implementation Status | Notes |
|-----------|-------------|---------------|----------------------|-------|
| **RankBadge** | Tier badge (New Bee → Bee Keeper) | Done | Done | **Presentational.** 7 rank tiers × 2 modes = 14 SVG variants. Auto light/dark theme switching. Size presets: sm/md/lg/xl. Located at `components/game/rank-badge.tsx`. SVG files in `public/badges/` with naming `{rank}-{mode}.svg`. |
| **RankCard** | Track-specific rank display | Not Started | Not Started | Badge + progress bar + XP to next tier |
| **XPProgressBar** | Progress to next tier | Not Started | Not Started | May use existing Progress component |
| **CrownPointsDisplay** | Royal Bee CP counter | Not Started | Not Started | Crown icon + points; only for Royal Bees |
| **TierUpAnimation** | Celebration when ranking up | Not Started | Not Started | Confetti, badge reveal |
| **PlacementBadge** | 1st, 2nd, 3rd place badges | Not Started | Not Started | Gold, silver, bronze styling |

---

## 4. Leaderboard Components

For the leaderboard tab.

| Component | Description | Design Status | Implementation Status | Notes |
|-----------|-------------|---------------|----------------------|-------|
| **LeaderboardTable** | Table of ranked players with pagination | Done | Done | **Presentational.** TanStack React Table + shadcn Table. Includes rank badges (gold/silver/bronze for top 3), player avatars, round +/- delta, accuracy. Built-in pagination. Located at `components/game/leaderboard-table.tsx`. Figma: node `2435:33026`. |
| **Pagination** | Navigation for multi-page content | Done | Done | **Presentational.** Summary text, prev/next buttons, page numbers, ellipsis. Located at `components/ui/pagination.tsx`. |
| **SearchInput** | Input with search icon prefix | Done | Done | **Composite.** Pre-composed InputGroup with magnifier icon. Located at `components/ui/search-input.tsx`. |
| ~~**LeaderboardRow**~~ | Individual player row | N/A | N/A | Merged into LeaderboardTable (inline cell components) |
| ~~**LeaderboardFilters**~~ | Mode/input method filter pills | N/A | N/A | Implemented with Select component on Leaderboard page |
| ~~**LeaderboardTabs**~~ | Solo/Friends/Global tabs | N/A | N/A | Uses existing Tabs component on Leaderboard page |
| **BeeKeeperHighlight** | Special styling for Bee Keeper | Not Started | Not Started | Crown icon, gold border |
| **SkeletonRow** | Loading placeholder for results | Not Started | Not Started | Shimmer animation |

---

## 5. Social Components

For friends and chat features.

| Component | Description | Design Status | Implementation Status | Notes |
|-----------|-------------|---------------|----------------------|-------|
| **FriendsList** | Widget showing all friends | Not Started | Not Started | Search, online status |
| **FriendRow** | Individual friend in list | Not Started | Not Started | Avatar, name, online dot, chat button |
| **FriendRequestCard** | Incoming request notification | Not Started | Not Started | Accept/decline buttons |
| **PresetMessagePill** | Chat bubble for preset messages | Not Started | Not Started | "Want to play?", "GG!", "Rematch?" |
| **ChatWindow** | 1:1 chat interface | Not Started | Not Started | Simple message list |
| **OnlineIndicator** | Green dot for online status | Not Started | Not Started | Tiny colored dot |
| **AddFriendButton** | Button on other player's profile | Not Started | Not Started | Yellow primary button |
| **BlockConfirmDialog** | Confirmation before blocking | Not Started | Not Started | Warning styling |
| **ReportDialog** | Report form modal | Not Started | Not Started | Reason dropdown, details textarea |

---

## 6. Profile & Settings Components

For user profile and settings.

| Component | Description | Design Status | Implementation Status | Notes |
|-----------|-------------|---------------|----------------------|-------|
| **ProfileHeader** | Avatar, username, bio, stats | Not Started | Not Started | Edit button for own profile |
| **AvatarSelector** | 3-preset avatar picker | Not Started | Not Started | Radio group with images |
| **MatchHistoryTable** | Table of past games | Not Started | Not Started | Placement, mode, XP, accuracy |
| **SettingsSection** | Grouped settings with header | Not Started | Not Started | Collapsible sections |
| **ThemeToggle** | Light/Dark mode switch | Not Started | Not Started | May already exist |
| **NotificationToggles** | Email preference switches | Not Started | Not Started | Three toggle switches |
| **DeleteAccountButton** | Danger button with confirmation | Not Started | Not Started | Red styling, 7-day warning |
| **ConnectedAccountBadge** | Shows Google/Apple connection | Not Started | Not Started | Read-only display |

---

## 7. Onboarding Components

For new user flow.

| Component | Description | Design Status | Implementation Status | Notes |
|-----------|-------------|---------------|----------------------|-------|
| **TutorialCard** | Step card with illustration | Not Started | Not Started | Progress bar, skip link |
| **TutorialStep** | Individual step content | Not Started | Not Started | Title, description, illustration |
| **ProfileCompletionForm** | Username, age, avatar form | Not Started | Not Started | Validation, unique username check |

---

## 8. Navigation & Layout Components

Structural components.

| Component | Description | Design Status | Implementation Status | Notes |
|-----------|-------------|---------------|----------------------|-------|
| **Navbar** | Main navigation bar | Done | Done | Already exists |
| **MobileNav** | Mobile navigation menu | Done | Done | Already exists |
| **TopNavbar** | Minimal header for wizard flows | Done | Done | Close button + optional skip link. Located at `components/ui/top-navbar.tsx`. |
| **HexPattern** | Decorative hexagonal background | Done | Done | **Presentational.** SVG pattern for page/section backgrounds. Static now, structured for future dynamic theming. Located at `components/ui/hex-pattern.tsx`. Figma: node `2641:7585`. |
| **NotificationBell** | Bell icon with badge count | Not Started | Not Started | Dropdown with notification list |
| **NotificationItem** | Individual notification | Not Started | Not Started | Icon, title, timestamp, read state |
| **SettingsButton** | Floating settings button in game | Not Started | Not Started | Bottom-right corner |
| **BackButton** | Navigation back button | Not Started | Not Started | May use existing |
| **GameHeader** | Header during game | Not Started | Not Started | X button, mode label, timer |

---

## 9. Feedback & State Components

For loading, errors, and empty states.

| Component | Description | Design Status | Implementation Status | Notes |
|-----------|-------------|---------------|----------------------|-------|
| **LoadingSpinner** | General loading indicator | Not Started | Not Started | May already exist |
| **EmptyState** | When no data to display | Not Started | Not Started | Illustration + message |
| **ErrorState** | When something goes wrong | Not Started | Not Started | Retry button |
| **ConnectionLostBanner** | Reconnecting indicator | Not Started | Not Started | Toast or banner style |
| **Toast** | Notification toast | Done | Done | Already exists (shadcn) |
| **ConfirmDialog** | Generic confirmation modal | Not Started | Not Started | May use existing Dialog |

---

## 10. Existing shadcn/ui Components

Components that already exist and can be used directly or with minor customization.

| Component | From | Customization Needed |
|-----------|------|---------------------|
| Button | shadcn/ui | None — use variants |
| Card | shadcn/ui | None |
| Input | shadcn/ui | None |
| Avatar | shadcn/ui | None |
| Badge | shadcn/ui | Add rank-specific variants |
| Progress | shadcn/ui | Add timer styling variants |
| Tabs | shadcn/ui | None |
| Table | shadcn/ui | None |
| DataTable | Custom | TanStack Table wrapper following shadcn pattern. Located at `components/ui/data-table.tsx`. |
| Pagination | Custom | Composable pagination controls. Located at `components/ui/pagination.tsx`. |
| SearchInput | Custom | InputGroup with search icon. Located at `components/ui/search-input.tsx`. |
| Dialog | shadcn/ui | None |
| Sheet | shadcn/ui | For mobile sidebar |
| Separator | shadcn/ui | None |
| Skeleton | shadcn/ui | None |
| Toast | shadcn/ui | None |
| Switch | shadcn/ui | For settings toggles |
| DropdownMenu | shadcn/ui | For user menu |

---

## Component Priority Matrix

Use this to decide what to design/build first.

### P0 — MVP Blockers (Build First)

Without these, the game cannot function:

1. ~~VoiceWaveform~~ ✓ Done
2. ~~HeartsDisplay~~ ✓ Done
3. ~~SpeechInput~~ ✓ Done (includes WordHelperButtons + VoiceWaveform integration + keyboard mode)
4. ~~GameTimer~~ ✓ Done
5. ~~KeyboardInput~~ ✓ Done (implemented as `mode="keyboard"` in SpeechInput)
6. GameResultCard
7. ~~RankBadge~~ ✓ Done

### P1 — Core Experience

Needed for a complete single-player experience:

1. ~~RoundIndicator~~ ✗ Removed (just inline text, see Architecture Decision #4)
2. ~~CorrectAnswerFeedback~~ ✓ Done (now `GameFeedbackOverlay`)
3. ~~WrongAnswerFeedback~~ ✓ Done (now `GameFeedbackOverlay`)
4. TutorialCard
5. ~~PlacementGameIntro~~ ✗ Removed (tutorial step 3 explains placement, no separate intro needed per PRD)
6. ~~RankReveal~~ ✗ Removed (it's a page, not a component — see `/onboarding/rank-result/page.tsx`)
7. ProfileCompletionForm

### P2 — Multiplayer

Needed for multiplayer:

1. PlayerStandingsSidebar
2. PlayerRow
3. LobbyPlayerList
4. RoomCodeDisplay
5. MatchmakingSpinner
6. GameCountdown

### P3 — Social & Polish

Nice to have for v1:

1. FriendsList
2. PresetMessagePill
3. NotificationBell
4. ~~LeaderboardTable~~ ✓ Done
5. All remaining components

---

## 11. Custom Hooks

Hooks that manage state and side effects for components.

| Hook | Description | Implementation Status | Notes |
|------|-------------|----------------------|-------|
| **useSpeechRecognition** | Audio capture, visualization, and speech recognition | Done | Single source of truth for voice input. Returns `isRecording`, `startRecording`, `stopRecording`, `analyserNode`, `transcript`, `provider`. Located at `hooks/use-speech-recognition.ts`. Uses provider abstraction: Deepgram (~95% accuracy) with Web Speech API fallback. Service layer at `lib/speech-recognition-service.ts`. |
| **useGameTimer** | Countdown timer with state management | Done | Single source of truth for timer. Returns `totalSeconds`, `remainingSeconds`, `state`, `isRunning`, `isExpired`, `start`, `pause`, `reset`, `restart`. Located at `hooks/use-game-timer.ts`. Supports callbacks for `onTimeUp` and `onTick`. |
| **useGameFeedback** | Feedback overlay state management | Done | Owns overlay state and timing. Returns `feedbackType`, `isShowing`, `showCorrect`, `showWrong`, `clear`. Auto-clears after animation (400ms). Located at `hooks/use-game-feedback.ts`. |
| **useGameSounds** | Audio playback for game sounds | Done | Preloads and plays game sounds. Returns `playCorrect`, `playWrong`, `play`, `isReady`, `setEnabled`, `setVolume`. Graceful fallback if files missing. Located at `hooks/use-game-sounds.ts`. Expects MP3 files in `public/sounds/`. |
| **useGameState** | WebSocket connection and game state | Not Started | Connects to Durable Object, syncs player state. |
| **useMatchmaking** | Matchmaking queue state | Not Started | Handles queue join/leave, tier expansion. |

---

## Architecture Decisions

Key patterns and decisions for component implementation.

### 1. Wrapper Components over Extended Props

**Decision:** Create domain-specific wrapper components rather than adding game-specific props to generic components.

**Example:** `GameTimer` wraps `Progress` rather than adding `isTimer`, `warningThreshold` props to Progress.

**Why:**
- Generic components (Progress, Input) stay generic and reusable
- Domain logic isolated in game-specific wrappers
- Easier for junior developers to understand
- Better testability

```tsx
// GOOD: Wrapper pattern (actual implementation)
function GameTimer({ totalSeconds, remainingSeconds }: GameTimerProps) {
  const state = remainingSeconds <= 5 ? "critical" : "normal"
  return <Progress value={(remainingSeconds / totalSeconds) * 100} data-state={state} />
}

// Usage with hook
const timer = useGameTimer(15, { onTimeUp: handleTimeout })
<GameTimer totalSeconds={timer.totalSeconds} remainingSeconds={timer.remainingSeconds} />

// BAD: Bloated generic component
<Progress value={50} isTimer criticalThreshold={5} />
```

### 2. Single Hook, Integrated Components

**Decision:** One hook owns the entire audio pipeline; SpeechInput integrates VoiceWaveform directly.

**Example:** `useSpeechRecognition` provides `analyserNode`, `transcript`, `isRecording`, etc. SpeechInput accepts these as props.

**Why:**
- Single source of truth for audio state
- VoiceWaveform is optional — only renders when `analyserNode` is passed
- VoiceWaveform is automatically inactive when not recording (no stale visualization)
- Clear separation: hook handles logic, SpeechInput handles UI
- Junior developers only need to understand one component, not composition

```
useSpeechRecognition (owns audio pipeline + provider selection)
    │
    └── All values → SpeechInput (presentational, but fully featured)
                         │
                         └── analyserNode → VoiceWaveform (auto-rendered above input)
```

**Usage:**
```tsx
const { isRecording, startRecording, stopRecording, analyserNode, transcript } = useSpeechRecognition()

<SpeechInput
  state={isRecording ? "recording" : "default"}
  analyserNode={analyserNode}
  inputText={transcript}
  onRecordClick={startRecording}
  onStopClick={stopRecording}
/>
```

### 3. Presentational vs. Smart Components

| Type | Characteristics | Examples |
|------|-----------------|----------|
| **Presentational** | No hooks, no side effects, just props → UI | VoiceWaveform, HeartsDisplay, RankBadge, GameFeedbackOverlay |
| **Smart** | Uses hooks, manages state, composes other components | GameScreen, LobbyPlayerList |

**Rule:** UI components in `components/ui/` are presentational. Game components in `components/game/` can be smart.

### 4. When NOT to Create a Component

**Decision:** Don't create components for simple, static text or trivial UI elements.

**Example:** "Round 1" heading on the game screen is just two `<p>` tags — NOT a component.

```tsx
// GOOD: Inline in game page
<div className="text-center space-y-2">
  <h1 className="text-3xl font-bold">Round {currentRound}</h1>
  <p className="text-sm text-muted-foreground">Spell the word that you hear:</p>
</div>

// BAD: Over-abstracted component
<RoundIndicator round={1} />  // Does nothing but wrap two <p> tags
```

**A component earns its existence when it has:**
- State or behavior (animations, timers, interactions)
- Complex logic (conditional rendering, calculations)
- Reuse in 3+ places
- Accessibility requirements beyond basic text
- Domain-specific styling that would be verbose inline

**Signs you're over-abstracting:**
- Component file is shorter than its import statement
- Component accepts 1-2 props and just passes them to a single element
- You can explain what it renders in one short sentence
- It's only used in one place

**Why this matters:**
- Fewer files = less cognitive overhead
- Junior developers can read JSX directly instead of jumping between files
- Reduces indirection in the codebase
- Keeps the component inventory focused on meaningful abstractions

---

## Design System Notes

When designing new components, **always reference these source files**:

1. **[STYLE_GUIDE.md](../STYLE_GUIDE.md)** — Component patterns, icon imports, border radius scale
2. **[app/globals.css](../app/globals.css)** — CSS variables, color tokens, focus ring system
3. **[lib/icons.ts](../lib/icons.ts)** — Centralized icon imports (never import directly from lucide/nucleo)

### Colors (OKLCH System)

The project uses **OKLCH color space** for perceptually uniform colors. Key tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `oklch(0.852 0.199 91.936)` | PlayLexi yellow, primary buttons |
| `--primary-hover` | `oklch(0.78 0.16 91.936)` | Button hover states |
| `--destructive` | `oklch(0.58 0.22 27)` | Hearts, errors, danger actions |
| `--foreground` | `oklch(0.145 0 0)` / `oklch(0.985 0 0)` | Text (light/dark mode) |
| `--muted-foreground` | `oklch(0.556 0 0)` | Secondary text |
| `--focus-ring-color` | `oklch(0.5 0.25 252)` | Focus ring (blue) |

**Rule:** Never use arbitrary hex/rgb colors. Always use semantic tokens via CSS variables.

### Typography
- Font: **Poppins** (via `--font-sans` CSS variable)
- Weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- See STYLE_GUIDE.md Section 1

### Border Radius Scale
| Utility | Size | Usage |
|---------|------|-------|
| `rounded-md` | 6px | Tab triggers, badges |
| `rounded-lg` | 8px | Inputs, dropdowns, menu items |
| `rounded-3xl` | 24px | Cards |
| `rounded-4xl` | 26px | Combobox chips |
| `rounded-full` | pill | Buttons |

### Spacing
- Use Tailwind spacing scale (4, 8, 12, 16, 24, 32, etc.)
- Consistent padding within cards

### Animations
- Respect `prefers-reduced-motion`
- Keep animations subtle and purposeful
- 150-300ms duration for micro-interactions

### Accessibility
- All interactive elements must be focusable
- Visible focus rings (automatic via globals.css)
- Proper ARIA labels (see `data-slot`, `data-state` patterns in STYLE_GUIDE.md)
- Color contrast 4.5:1 minimum

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-12-21 | Initial inventory created | Claude |
| 2025-12-21 | Marked VoiceWaveform as Done (already exists); Updated GameTimer notes to clarify it wraps Progress | Claude |
| 2025-12-21 | Added Section 11 (Custom Hooks) and Architecture Decisions section. Documented wrapper pattern for GameTimer, single-hook pattern for voice input, presentational vs. smart component distinction. Updated VoiceWaveform and VoiceInput notes to reflect architecture. | Claude |
| 2025-12-21 | Updated Design System Notes to reference OKLCH color system from globals.css, added explicit references to STYLE_GUIDE.md and lib/icons.ts, added border radius scale table. | Claude |
| 2025-12-22 | Implemented HeartsDisplay component. Added HeartIcon to lib/icons.ts. Added heart-loss animation to globals.css. | Claude |
| 2025-12-22 | Integrated VoiceWaveform into SpeechInput. Renamed VoiceInput to SpeechInput in inventory (already existed). Added `analyserNode` prop for optional waveform rendering. Updated useSpeechRecognition status to Done. Updated Architecture Decisions to reflect integration pattern. | Claude |
| 2025-12-26 | Implemented GameTimer component and useGameTimer hook. Uses wrapper pattern around Progress. Two states: normal (--primary) and critical (--destructive, ≤5 seconds). Added demo to showcase page. | Claude |
| 2025-12-26 | Implemented GameFeedbackOverlay component, useGameFeedback hook, and useGameSounds hook. Combines CorrectAnswerFeedback and WrongAnswerFeedback into single overlay component. Created public/sounds/ folder for audio files. Added demo to showcase page. | Claude |
| 2025-12-26 | Removed RoundIndicator from inventory — it's just inline text, not a component. Added Architecture Decision #4: "When NOT to Create a Component" with guidelines on avoiding over-abstraction. | Claude |
| 2025-12-26 | Created RankBadge component structure with placeholder SVG paths. 7 tiers × 2 modes = 14 variants. Auto theme switching, size presets (sm/md/lg/xl). Expects files in `public/badges/`. | Claude |
| 2025-12-30 | Added keyboard mode to SpeechInput. New `mode="keyboard"` prop with "Type to start"/"Enter to stop" buttons. Uses discriminated union types for type-safe mode-specific props. Added InputMode, InputState types and INPUT_MODE_PLACEHOLDERS constant for reusability. Improved accessibility with ARIA live regions. KeyboardInput now marked as Done (implemented within SpeechInput). | Claude |
| 2026-01-02 | Removed PlacementGameIntro from inventory — tutorial step 3 already explains placement, no separate intro screen per PRD. | Claude |
| 2026-01-02 | Removed RankReveal from component inventory — it's a full-screen page, not a reusable component. Only used once for initial placement flow. Implemented as `/onboarding/rank-result/page.tsx` instead. Follows Architecture Decision #4 (avoid over-abstraction for single-use UI). Figma: node `2610:6076`. | Claude |
| 2026-01-08 | Added HexPattern component for decorative hexagonal backgrounds. Created as component (not static SVG) for future dynamic theming. Includes commented code for future color/scale/opacity props. Added TopNavbar to inventory (was missing). Updated STYLE_GUIDE.md with HexPattern documentation. Figma: node `2641:7585`. | Claude |
| 2026-01-08 | Implemented Leaderboard components: LeaderboardTable (TanStack React Table + pagination), Pagination (composable nav), SearchInput (InputGroup composite). Added SearchIcon and FilterIcon to lib/icons.ts. Created Leaderboard page at `/leaderboard`. Marked LeaderboardRow, LeaderboardFilters, LeaderboardTabs as N/A (merged/existing components used). Figma: node `2435:33026`. | Claude |
| 2026-01-08 | Refactored Leaderboard to follow shadcn data table patterns. Created reusable `DataTable` component in `components/ui/`. Separated column definitions to `leaderboard-columns.tsx`. Added semantic `--placement-gold/silver/bronze` color tokens to globals.css (replacing hardcoded Tailwind colors). Added `data-slot` attributes to all cell components. | Claude |
| 2026-01-10 | Implemented speech recognition provider abstraction for improved accuracy. Created `lib/speech-recognition-service.ts` with Deepgram (~95%) and Web Speech API fallback. Created `useSpeechRecognition` hook. Deprecated old `useVoiceRecorder` hook. Added aggressive phonetic mapping and `formatTranscriptForDisplay()` for real-time letter display. Added `.env.example` for Deepgram API key. Updated all documentation. | Claude |

---

*End of Component Inventory*
