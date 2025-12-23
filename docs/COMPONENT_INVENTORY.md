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
| **VoiceWaveform** | Animated audio visualization during recording | Done | Done | **Presentational only.** Canvas-based, uses AnalyserNode, has idle/active states. Located at `components/ui/voice-waveform.tsx`. Does NOT handle audio capture or Whisper — that's `useVoiceRecorder` hook. |
| **HeartsDisplay** | 3 heart icons showing remaining lives | Done | Done | **Presentational.** Shows remaining hearts with shake+fade animation on loss. Uses `--destructive` color, 20px hearts, 2px gap. Located at `components/game/hearts-display.tsx`. Animation defined in `globals.css`. Respects `prefers-reduced-motion`. |
| **GameTimer** | Progress bar countdown timer | Not Started | Not Started | **Wrapper pattern.** Wraps existing `Progress` component; adds countdown logic, color states (normal → warning → critical), ARIA labels. See Architecture Decisions below. |
| **RoundIndicator** | "Round 1", "Round 2" badge | Not Started | Not Started | Simple text badge |
| **WordHelperButtons** | Sentence/Dictionary/Play button group | Not Started | Not Started | Icon buttons with tooltips |
| **VoiceInput** | Microphone recording interface | Not Started | Not Started | **Smart component.** Composes `useVoiceRecorder` hook + `VoiceWaveform`. Handles record/stop buttons, shows transcript, submits answer. Located at `components/game/voice-input.tsx`. |
| **KeyboardInput** | Text input for typing spelling | Not Started | Not Started | May use existing Input component |
| **GameResultCard** | Final placement display after game | Not Started | Not Started | Shows rank badge, XP earned, stats |
| **CorrectAnswerFeedback** | Visual/audio feedback on correct answer | Not Started | Not Started | Green flash, sound effect |
| **WrongAnswerFeedback** | Visual/audio feedback on wrong answer | Not Started | Not Started | Red flash, heart loss animation |

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
| **RankBadge** | Tier badge (New Bee → Bee Keeper) | Not Started | Not Started | 7 variants; may need SVG/images |
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
| **LeaderboardTable** | Table of ranked players | Not Started | Not Started | May use existing Table component |
| **LeaderboardRow** | Individual player row | Not Started | Not Started | Rank #, avatar, name, tier, XP, accuracy |
| **LeaderboardFilters** | Mode/input method filter pills | Not Started | Not Started | Toggle buttons or select |
| **LeaderboardTabs** | Solo/Friends/Global tabs | Not Started | Not Started | May use existing Tabs component |
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
| **PlacementGameIntro** | Intro screen before placement | Not Started | Not Started | Explains what will happen |
| **RankReveal** | Animation showing earned rank | Not Started | Not Started | Badge reveal after placement |
| **ProfileCompletionForm** | Username, age, avatar form | Not Started | Not Started | Validation, unique username check |

---

## 8. Navigation & Layout Components

Structural components.

| Component | Description | Design Status | Implementation Status | Notes |
|-----------|-------------|---------------|----------------------|-------|
| **Navbar** | Main navigation bar | Done | Done | Already exists |
| **MobileNav** | Mobile navigation menu | Done | Done | Already exists |
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

1. VoiceWaveform
2. HeartsDisplay
3. GameTimer
4. VoiceInput / KeyboardInput
5. WordHelperButtons
6. GameResultCard
7. RankBadge

### P1 — Core Experience

Needed for a complete single-player experience:

1. RoundIndicator
2. CorrectAnswerFeedback
3. WrongAnswerFeedback
4. TutorialCard
5. PlacementGameIntro
6. RankReveal
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
4. LeaderboardTable
5. All remaining components

---

## 11. Custom Hooks

Hooks that manage state and side effects for components.

| Hook | Description | Implementation Status | Notes |
|------|-------------|----------------------|-------|
| **useVoiceRecorder** | Audio capture, visualization, and Whisper transcription | Not Started | Single source of truth for voice input. Returns `analyserNode` for VoiceWaveform, `transcript` for submission. See ARCHITECTURE.md Section 8. |
| **useGameTimer** | Countdown timer with state management | Not Started | Manages time remaining, warning/critical states. Used by GameTimer component. |
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
// GOOD: Wrapper pattern
function GameTimer({ totalSeconds, remainingSeconds }: GameTimerProps) {
  const state = remainingSeconds <= 5 ? "critical" : remainingSeconds <= 10 ? "warning" : "normal"
  return <Progress value={(remainingSeconds / totalSeconds) * 100} data-state={state} />
}

// BAD: Bloated generic component
<Progress value={50} isTimer warningThreshold={10} criticalThreshold={5} />
```

### 2. Single Hook, Multiple Consumers

**Decision:** One hook owns the entire audio pipeline; multiple components consume from it.

**Example:** `useVoiceRecorder` provides both `analyserNode` (for VoiceWaveform) and `transcript` (for submission).

**Why:**
- Single source of truth for audio state
- VoiceWaveform and VoiceInput stay in sync
- No risk of two hooks fighting over the same MediaStream
- Clear separation: hook handles logic, components handle UI

```
useVoiceRecorder (owns audio pipeline)
    │
    ├── analyserNode → VoiceWaveform (presentational)
    │
    └── transcript, isRecording, etc. → VoiceInput (smart component)
```

### 3. Presentational vs. Smart Components

| Type | Characteristics | Examples |
|------|-----------------|----------|
| **Presentational** | No hooks, no side effects, just props → UI | VoiceWaveform, HeartsDisplay, RankBadge |
| **Smart** | Uses hooks, manages state, composes other components | VoiceInput, GameScreen, LobbyPlayerList |

**Rule:** UI components in `components/ui/` are presentational. Game components in `components/game/` can be smart.

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

---

*End of Component Inventory*
