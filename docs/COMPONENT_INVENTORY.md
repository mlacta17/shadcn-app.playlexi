# PlayLexi — Component Inventory

> **Version:** 1.2
> **Last Updated:** January 17, 2026
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
| ~~**TutorialCard**~~ | ~~Step card with illustration~~ | N/A | N/A | **Not needed.** Use `Card` + `Badge size="number"` + content. See Architecture Decision #5 below. |
| ~~**TutorialStep**~~ | ~~Individual step content~~ | N/A | N/A | **Not needed.** Just content inside Card — title, image, description. |
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
| Badge | shadcn/ui | Done. Added `size="number"` for circular step indicators, placement variants (gold/silver/bronze). |
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
5. ~~PlacementGameIntro~~ ✗ Removed (tutorial steps 3-4 explain placement + hearts, no separate intro needed per PRD)
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
| **useSpeechRecognition** | Audio capture, visualization, and speech recognition | Done | Single source of truth for voice input. Returns `isRecording`, `startRecording`, `stopRecording`, `analyserNode`, `transcript`, `provider`. Located at `hooks/use-speech-recognition.ts`. Uses provider abstraction: Google Cloud Speech-to-Text (~95-98% accuracy) with Web Speech API fallback. Service layer at `lib/speech-recognition-service.ts`. |
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

### 5. Don't Create Components for Content Arrangements

**Decision:** Don't create components that are just primitives with specific content inside.

**Example:** Tutorial "card" is just a Card with a step badge, title, image, and description — NOT a component.

```tsx
// GOOD: Use existing primitives with content
<Card>
  <CardContent className="flex flex-col gap-3">
    <Badge variant="secondary" size="number">1</Badge>
    <p className="text-base font-semibold">
      Press Start, then listen carefully to the word
    </p>
  </CardContent>
  <CardFooter className="flex flex-col gap-2">
    <img src="/images/tutorial-step-1.png" className="rounded-lg w-full" alt="..." />
    <p className="text-sm text-muted-foreground">
      You can replay the word as many times as you'd like...
    </p>
  </CardFooter>
</Card>

// BAD: Component that just wraps Card with content
<TutorialCard
  step={1}
  title="Press Start..."
  image="/images/tutorial-step-1.png"
  description="You can replay..."
/>
```

**This applies to:**
- `TutorialCard` → Use `Card` + content
- `LoginCard` → Use `Card` + content
- `ProfileCard` → Use `Card` + content
- Any "Card" variant that just has different content

**When to create a component instead:**
- The arrangement has complex logic (conditional rendering, animations)
- It needs its own state or hooks
- The same exact arrangement is used in 3+ different files
- It requires significant accessibility handling

**Key insight:** In Figma, designers use the Card component and swap content. Code should mirror this — use the primitive, change the content.

---

> **Design System Reference:** For colors, typography, spacing, and accessibility guidelines, see [STYLE_GUIDE.md](STYLE_GUIDE.md) and [app/globals.css](../app/globals.css).

---

*End of Component Inventory*
