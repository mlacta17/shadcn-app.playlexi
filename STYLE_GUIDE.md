# Style Guide

This document captures the custom styling decisions for this project. Most styles are automatically applied through the design system, but some require manual implementation when adding new components.

## Automatic Styles (No Action Needed)

These are built into the codebase and apply automatically to all components:

### 1. Typography - Poppins Font
- **Location:** [app/layout.tsx](app/layout.tsx)
- **Applied via:** CSS variable `--font-sans`
- **Weights available:** 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- **Action:** None - automatically applied to all text

### 2. Border Radius Scale
- **Location:** [app/globals.css:52-58](app/globals.css:52-58)
- **Base:** `--radius: 0.625rem` (10px)
- **Available utilities:**
  - `rounded-md` = 6px (Tailwind default) - **for tab triggers, badges**
  - `rounded-lg` = 8px (Tailwind default) - **for inputs, dropdowns, menu items, nav links**
  - `rounded-3xl` = 24px (Tailwind default) - **for cards**
  - `rounded-4xl` = 26px (`calc(var(--radius) + 16px)`) - **for individual combobox chips**
  - `rounded-full` = 9999px (Tailwind default) - **for buttons**
- **Visual hierarchy:**
  - Extra Subtle (6px): Tab triggers, badges - minimal, clean
  - Subtle (8px): Form inputs, dropdown containers, menu items, nav links - cohesive, functional
  - Medium (24px): Cards - structured, contained
  - Medium-Bold (26px): Individual combobox chips - prominent but not fully rounded
  - Bold (fully rounded): Buttons - distinctive, pill-shaped
- **Action:**
  - Use `rounded-md` for tab triggers, badges
  - Use `rounded-lg` for:
    - Form inputs (input, textarea, select trigger, combobox chips container)
    - Dropdown content (select dropdown, dropdown menu, combobox popup)
    - Tab list containers
    - All menu items (dropdown items, select items, combobox items)
    - Nav links (navbar navigation items)
  - Use `rounded-3xl` for cards
  - Use `rounded-4xl` for individual combobox chips (the pills inside ComboboxChips)
  - Use `rounded-full` for buttons

### 3. Component Padding Scale
- **Pattern:** ~33% increase from shadcn defaults
- **Implementation:** Achieved via larger border radius utilities
- **Action:** None - use the rounded utilities above

### 4. Focus Ring System
- **Location:** [app/globals.css:269-302](app/globals.css:269-302)
- **Style:** 2px solid blue outline with 2px offset
- **Light mode:** `oklch(0.5 0.25 252)` (blue)
- **Dark mode:** `oklch(0.6 0.25 252)` (lighter blue)
- **Destructive states:** Automatically use red outline
- **Action:** None - automatically applied to all interactive elements

### 4.1. Focus Ring for Container Components
- **Pattern:** Use `focus-within` for containers that don't receive focus themselves
- **Applies to:** InputGroup, ComboboxChips (containers wrapping focusable children)
- **Utility class:** `focus-within-ring` (defined in globals.css)
- **Implementation options:**
  ```tsx
  // Option 1: Use utility class (recommended for new components)
  <div className="focus-within-ring" aria-invalid={hasError}>
    <input />
  </div>

  // Option 2: Inline Tailwind (existing components use this)
  focus-within:outline
  focus-within:outline-[length:var(--focus-ring-width)]
  focus-within:outline-[var(--focus-ring-color)]
  focus-within:outline-offset-[var(--focus-ring-offset)]
  aria-invalid:focus-within:outline-[var(--destructive)]
  ```
- **Why?** Container `<div>` elements don't receive focus - their child `<input>` elements do. `focus-within` shows outline when any descendant is focused.
- **Action:** Use `focus-within-ring` class for any new composite form components

### 4.2. Error States (Form Validation)
- **Pattern:** `aria-invalid:border-destructive dark:aria-invalid:border-destructive/50`
- **Applies to:** Input, Textarea, Select, InputGroup, ComboboxChips
- **Usage:** Add `aria-invalid="true"` to the component
- **Visual effects:**
  1. Border changes to red (`--destructive` color)
  2. Focus ring changes to red (automatic via global CSS)
- **Dark mode:** 50% opacity for better visibility
- **Companion element:** Use `<p className="text-destructive text-sm">Error message</p>` below the input
- **Action:** Set `aria-invalid="true"` on form fields with validation errors

### 5. SVG Icon Sizing
- **Pattern:** `[&_svg:not([class*='size-'])]:size-4`
- **Default size:** 16px (size-4)
- **Small buttons:** 12px (size-3)
- **Action:** None - SVG sizing is automatic via CSS selectors

### 6. Form Input Backgrounds (Maia Style)
- **Pattern:** `bg-input/30` for all form inputs (both light and dark mode)
- **Source:** shadcn/ui Maia style preset
- **Applies to:** Input, Textarea, Select trigger, InputGroup, ComboboxChips
- **Effect:** Subtle tinted background at 30% opacity using the `--input` color token
- **Why different from default shadcn?** This project uses the Maia style preset which provides a more defined visual hierarchy for form elements
- **Action:** Use `bg-input/30` for all form-related components

### 7. Semantic Color System
- **Location:** [app/globals.css:63-233](app/globals.css:63-233)
- **Format:** OKLCH color space
- **Pattern:** Background + foreground pairs for proper contrast
- **Available tokens:**
  - `bg-primary` / `text-primary-foreground`
  - `bg-secondary` / `text-secondary-foreground`
  - `bg-destructive` / `text-destructive-foreground`
  - `bg-muted` / `text-muted-foreground`
  - `bg-accent` / `text-accent-foreground`
- **Hover states:** `--primary-hover`, `--secondary-hover`, `--destructive-hover`
- **Action:** Use semantic tokens instead of arbitrary colors

### 8. Button Hover States
- **Pattern:** Darker shades on hover (not lighter)
- **Implementation:** `hover:bg-[var(--primary-hover)]`
- **Action:** None - already built into button component

### 8.1. Outline Button Background
- **Pattern:** `bg-background` (matching original shadcn/ui)
- **Light mode:** White background
- **Dark mode:** Dark gray background (`oklch(0.145 0 0)`)
- **Why?** Provides visual distinction from ghost buttons and ensures consistent appearance across different container backgrounds
- **Action:** None - already built into button component

### 9. Icon Positioning System
- **Pattern:** Automatic padding adjustment when icons are present in components
- **Implementation:** `has-data-[icon=inline-start]:pl-3 has-data-[icon=inline-end]:pr-3`
- **How it works:** Add `data-icon="inline-start"` or `data-icon="inline-end"` to SVG icons to reduce padding on that side
- **Applies to:** Button, Badge, InputGroup
- **Example:**
  ```tsx
  <Button>
    <IconTrash data-icon="inline-start" />
    Delete
  </Button>
  ```
  The left padding automatically reduces because the icon is there.
- **Action:** Add `data-icon` attribute to icons in Button/Badge components

### 10. Data Attributes for Components
- **Purpose:** Standardized attributes for component identification and styling hooks
- **Source:** Part of shadcn/ui's component architecture (already included in all shadcn components)
- **Standard attributes:**
  - `data-slot="component-name"` - Identifies the component type (e.g., "button", "input", "card")
  - `data-variant="variant-name"` - Tracks which variant is active (e.g., "destructive", "outline")
  - `data-size="size-name"` - Tracks size variant (e.g., "sm", "default", "lg")
- **Real examples from your components:**
  ```tsx
  // Button component
  <button data-slot="button" data-variant="destructive" data-size="lg">

  // Card component
  <div data-slot="card" data-size="sm">

  // Input component
  <input data-slot="input">
  ```
- **Why use them:**
  - **CSS targeting**: `[data-slot="button"]` or `has-data-[slot=combobox-chip]`
  - **Parent-child styling**: Style buttons inside cards differently
  - **Debugging**: Instantly see component type in browser DevTools
  - **Conditional styling**: `data-[size=sm]:gap-4` applies styles based on size
- **Action:**
  - shadcn components already have these - **keep them when updating**
  - Add these attributes to custom components for consistency
  - Never remove `data-slot`, `data-variant`, or `data-size` attributes

### 11. Group Variants
- **Pattern:** Parent-child state communication using Tailwind's group feature
- **Implementation:** Add `group/component-name` to parent, use `group-*/` selectors in children
- **Applies to:** Button (`group/button`), Card (`group/card`), Badge (`group/badge`), InputGroup (`group/input-group`)
- **Example:**
  ```tsx
  // Parent has group/button
  <button className="group/button">
    // Child responds to parent hover
    <svg className="group-hover/button:text-red-500" />
  </button>
  ```
- **Action:** Use `group/component-name` pattern for components with interactive children

## Manual Implementation Required

These require action when adding new components:

### 1. Icons - Use Centralized Icons File
**IMPORTANT:** Always import icons from `@/lib/icons`, never directly from `nucleo-core-outline-24` or `lucide-react`.

```typescript
import { PlusIcon, TrashIcon, SettingsIcon } from "@/lib/icons"
```

All components in this codebase use this pattern. See [lib/icons.ts](lib/icons.ts) for all available icons.

#### Adding New Icons
If you need an icon that isn't in `lib/icons.ts`, add it there first:
```typescript
// In lib/icons.ts
export { IconNewIconOutline24 as NewIcon } from "nucleo-core-outline-24"
```

#### Common Icon Mappings:
| Lucide Name | Nucleo Name | Alias |
|-------------|-------------|-------|
| X | IconXmarkOutline24 | XIcon |
| Check | IconCheckOutline24 | CheckIcon |
| ChevronDown | IconChevronDownOutline24 | ChevronDownIcon |
| ChevronUp | IconChevronUpOutline24 | ChevronUpIcon |
| ChevronRight | IconChevronRightOutline24 | ChevronRightIcon |
| Plus | IconPlusOutline24 | PlusIcon |
| Mail | IconEnvelopeOutline24 | MailIcon |
| Settings | IconGearOutline24 | SettingsIcon |
| Save | IconFloppyDiskOutline24 | SaveIcon |
| HelpCircle | IconCircleQuestionOutline24 | HelpCircleIcon |
| LogOut | IconCircleLogoutOutline24 | LogOutIcon |

#### Finding Nucleo Icons:
1. Search pattern: `Icon{Name}Outline24`
2. Browse: `node_modules/nucleo-core-outline-24/dist/components/`
3. Search command: `ls node_modules/nucleo-core-outline-24/dist/components/ | grep -i "search-term"`

#### Setup:
Add your Nucleo license key to `.env`:
```
NUCLEO_LICENSE_KEY=your-license-key
```
For deployment, add the same variable to your hosting provider (Vercel/Netlify/etc.).

## Canvas-Based Components

Some components use HTML Canvas for performance-critical rendering. These can't use Tailwind classes directly but must still follow the design system.

### Voice Waveform
- **Location:** [components/ui/voice-waveform.tsx](components/ui/voice-waveform.tsx)
- **Hook:** [hooks/use-voice-recorder.ts](hooks/use-voice-recorder.ts)
- **Type:** Canvas-based audio visualizer

#### Design System Integration:
| Aspect | Implementation |
|--------|----------------|
| **Color** | Reads `--foreground` CSS variable at runtime via `getComputedStyle()` |
| **Bar radius** | Fully-rounded ends (`barWidth / 2`) matching button pattern |
| **Spacing** | `barWidth=6px` (1.5 spacing units), `barGap=3px` (0.75 spacing units) |
| **Attributes** | `data-slot="voice-waveform"`, `data-state="active\|inactive"` |
| **Accessibility** | `aria-hidden="true"` (decorative element) |

#### Architecture:
```
useVoiceRecorder (hook) - owns microphone + speech recognition
├── analyserNode → VoiceWaveform (presentational)
├── transcript → display recognized speech
└── isRecording, startRecording, stopRecording → controls
```

#### Standalone Usage:
VoiceWaveform can be used standalone if needed, but **the recommended approach is to use SpeechInput with `analyserNode` prop** for full integration.

```tsx
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import { VoiceWaveform } from "@/components/ui/voice-waveform"

// Standalone (just waveform, no controls)
function WaveformOnly() {
  const { analyserNode } = useVoiceRecorder()
  return <VoiceWaveform analyserNode={analyserNode} />
}

// Recommended: Use SpeechInput with integrated waveform (see SpeechInput section below)
```

#### Visual Behavior:
- **Inactive state:** Minimal uniform bars (flat idle look)
- **Active state:** Dynamic bars mirrored from center, ~12% asymmetry for organic feel
- **Smoothing:** 0.3 factor for fluid transitions
- **Voice focus:** Samples 100Hz-3000Hz range (human voice frequencies)

#### Adding New Canvas Components:
When creating canvas-based components, follow this pattern:
1. Read colors from CSS variables (`getComputedStyle(document.documentElement).getPropertyValue('--variable')`)
2. Use spacing values that align with Tailwind scale (4px increments)
3. Apply `data-slot` and `data-state` attributes to wrapper element
4. Add `aria-hidden="true"` if purely decorative
5. Document the component in this section

### SpeechInput
- **Location:** [components/ui/speech-input.tsx](components/ui/speech-input.tsx)
- **Hook:** [hooks/use-voice-recorder.ts](hooks/use-voice-recorder.ts)
- **Type:** Presentational voice input component with integrated VoiceWaveform

#### Design System Integration:
| Aspect | Implementation |
|--------|----------------|
| **Max width** | 525px per Figma |
| **Main area height** | 138px per Figma |
| **Waveform gap** | 24px (`gap-6`) per Figma |
| **Container** | `bg-input/30 outline-input rounded-lg` |
| **Buttons** | Primary (Record), Destructive (Stop), Outline (helpers) |
| **Attributes** | `data-slot="speech-input"`, `data-state="default\|recording"`, `data-has-waveform` |
| **Icons** | MicIcon, StopIcon, PlayIcon, SentenceIcon, DictionaryIcon from lib/icons.ts |

#### Architecture:
```
useVoiceRecorder (hook)
└── SpeechInput (presentational)
    ├── analyserNode → VoiceWaveform (auto-rendered when provided)
    ├── transcript → inputText display
    └── isRecording → state prop
```

VoiceWaveform is now **integrated into SpeechInput**. When you pass `analyserNode`, the waveform renders automatically above the input controls. No manual composition needed.

#### Props:
| Prop | Type | Description |
|------|------|-------------|
| `state` | `"default" \| "recording"` | Current recording state |
| `analyserNode` | `AnalyserNode \| null` | Audio analyser for waveform visualization |
| `inputText` | `string` | Current transcribed text |
| `placeholder` | `string` | Placeholder when no input |
| `definition` | `string` | Dictionary definition to show in footer |
| `playPressed` | `boolean` | Play button state |
| `dictionaryPressed` | `boolean` | Dictionary button state |
| `sentencePressed` | `boolean` | Sentence button state |
| `onRecordClick`, `onStopClick`, etc. | `() => void` | Callback handlers |

#### Usage:
```tsx
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import { SpeechInput } from "@/components/ui/speech-input"

function VoiceInputScreen() {
  const { isRecording, startRecording, stopRecording, analyserNode, transcript } = useVoiceRecorder()

  return (
    <SpeechInput
      state={isRecording ? "recording" : "default"}
      analyserNode={analyserNode}
      inputText={transcript}
      onRecordClick={startRecording}
      onStopClick={stopRecording}
    />
  )
}
```

#### Visual Behavior:
- **VoiceWaveform:** Renders above input when `analyserNode` provided
- **Waveform active state:** Only animates when `state="recording"` (prevents stale visualization)
- **Helper buttons:** Disabled during recording
- **Footer:** Shows contextual messages based on pressed button
- **Input text:** Wrapped in quotes, italicized, centered

## Game Components

Game-specific components live in `components/game/` and follow the same design system patterns as UI components.

### HeartsDisplay
- **Location:** [components/game/hearts-display.tsx](components/game/hearts-display.tsx)
- **Type:** Presentational component (no hooks)
- **Use case:** Displaying player's remaining lives in the game

#### Design System Integration:
| Aspect | Implementation |
|--------|----------------|
| **Color** | `fill-destructive stroke-destructive` (red hearts) |
| **Size** | 20px (`size-5`) per Figma |
| **Gap** | 2px (`gap-0.5`) per Figma |
| **Animation** | `animate-heart-loss` keyframes in globals.css |
| **Attributes** | `data-slot="hearts-display"`, `data-state="filled\|losing\|lost"`, `data-remaining`, `data-total` |
| **Accessibility** | `role="status"`, `aria-live="polite"`, `aria-label` |

#### Heart States (Active/Disabled Pattern):
The component follows the **destructive button active/disabled pattern** for visual consistency:

| State | Visual | `data-state` | Description |
|-------|--------|--------------|-------------|
| **Filled** | Full red (`opacity: 1`) | `filled` | Active heart (remaining life) |
| **Losing** | Animating | `losing` | Currently transitioning (shake + fade) |
| **Lost** | Dimmed red (`opacity: 0.5`) | `lost` | Disabled heart (life lost) |

**Why show all hearts?** Displaying all hearts (filled + lost) provides clear visual feedback:
- Players see total lives available (e.g., "3 lives total")
- Players see how many they've lost (dimmed hearts)
- Matches common game UI patterns (Mario, Zelda, etc.)

#### Props:
| Prop | Type | Description |
|------|------|-------------|
| `remaining` | `number` | Hearts remaining (0-3) |
| `total` | `number` | Max hearts (default: 3) |
| `onHeartLost` | `() => void` | Callback after loss animation completes |
| `className` | `string` | Additional classes |

#### Usage:
```tsx
import { HeartsDisplay } from "@/components/game"

// Shows 2 filled hearts + 1 lost heart (50% opacity)
<HeartsDisplay remaining={2} />

<HeartsDisplay
  remaining={hearts}
  onHeartLost={() => playSound('heart-lost')}
/>
```

#### Animation:
- Defined in `globals.css` under "GAME COMPONENT ANIMATIONS"
- Duration: 300ms (matches `HEART_LOSS_ANIMATION_DURATION` constant)
- Respects `prefers-reduced-motion`
- Shake + fade to 50% opacity (transitions to "lost" state, not hidden)

### GameTimer
- **Location:** [components/game/game-timer.tsx](components/game/game-timer.tsx)
- **Hook:** [hooks/use-game-timer.ts](hooks/use-game-timer.ts)
- **Type:** Presentational wrapper around Progress component
- **Use case:** Countdown timer for game rounds

#### Design System Integration:
| Aspect | Implementation |
|--------|----------------|
| **Normal color** | `--primary` (yellow/amber) - plenty of time |
| **Critical color** | `--destructive` (red) - ≤5 seconds |
| **Height** | 8px (`h-2`) per Figma |
| **Width** | Full width of parent |
| **Attributes** | `data-slot="game-timer"`, `data-state="normal\|critical"`, `data-remaining`, `data-total` |
| **Accessibility** | `role="timer"`, `aria-live="polite"`, `aria-label` |

#### Architecture:
```
useGameTimer (hook) - owns countdown logic
├── totalSeconds → total duration
├── remainingSeconds → current time left
├── state → "normal" | "critical"
├── isRunning, isExpired → timer status
└── start, pause, reset, restart → controls
```

GameTimer is **presentational only**. It receives values from `useGameTimer` hook and renders a styled Progress bar. This follows the same pattern as SpeechInput + useVoiceRecorder.

#### Props:
| Prop | Type | Description |
|------|------|-------------|
| `totalSeconds` | `number` | Total time for this round |
| `remainingSeconds` | `number` | Current time remaining |
| `criticalThreshold` | `number` | Seconds threshold for red state (default: 5) |
| `className` | `string` | Additional classes |

#### Usage:
```tsx
import { GameTimer } from "@/components/game"
import { useGameTimer } from "@/hooks/use-game-timer"

function GameScreen() {
  const timer = useGameTimer(15, {
    onTimeUp: () => handleWrongAnswer(),
    autoStart: true,
  })

  return (
    <GameTimer
      totalSeconds={timer.totalSeconds}
      remainingSeconds={timer.remainingSeconds}
    />
  )
}
```

#### Visual Behavior:
- **Normal state:** Yellow/amber progress bar (plenty of time)
- **Critical state:** Red progress bar (≤5 seconds - creates urgency)
- **Smooth countdown animation:** 1-second linear CSS transition (`duration-1000 ease-linear`) matches the hook's 1-second tick interval, creating fluid movement instead of jumpy steps
- **Color transition:** Faster 300ms transition for responsive state change feel when entering critical state
- **Progress direction:** Fills from left, decreases toward right as time runs out

#### Animation Architecture:
The smooth animation is implemented **at the GameTimer level** (not in Progress component). This follows the wrapper pattern:

| Layer | Responsibility |
|-------|----------------|
| **Progress (generic)** | Base progress bar, no timing assumptions |
| **GameTimer (wrapper)** | Adds 1s linear transition for countdown-specific behavior |

**Why this separation?**
- Progress component stays generic (could be used for file uploads, loading states with different timing needs)
- GameTimer owns the domain-specific knowledge that countdown ticks are 1-second intervals
- Junior developers can easily find and modify timer animation in one place
- Other countdown components can make different choices without affecting Progress

### GameFeedbackOverlay
- **Location:** [components/game/game-feedback-overlay.tsx](components/game/game-feedback-overlay.tsx)
- **Hooks:** [hooks/use-game-feedback.ts](hooks/use-game-feedback.ts), [hooks/use-game-sounds.ts](hooks/use-game-sounds.ts)
- **Type:** Presentational overlay component
- **Use case:** Full-screen flash feedback for correct/wrong answers

#### Design System Integration:
| Aspect | Implementation |
|--------|----------------|
| **Correct color** | `bg-green-500/20` (green at 20% opacity) |
| **Wrong color** | `bg-destructive/20` (red at 20% opacity) |
| **Positioning** | `fixed inset-0 z-50` (covers entire viewport) |
| **Animation** | `animate-feedback-flash` keyframes in globals.css (400ms) |
| **Attributes** | `data-slot="game-feedback-overlay"`, `data-state="correct\|wrong"` |
| **Accessibility** | `aria-hidden="true"` (decorative element) |

#### Architecture:
```
useGameFeedback (hook) - owns state and timing
├── feedbackType → "correct" | "wrong" | null
├── isShowing → boolean
└── showCorrect, showWrong, clear → controls

useGameSounds (hook) - owns audio playback
├── playCorrect, playWrong → sound triggers
├── isReady → sounds preloaded
└── setEnabled, setVolume → controls
```

Both hooks feed into `GameFeedbackOverlay` (presentational). Place the overlay at page/layout level.

#### Props:
| Prop | Type | Description |
|------|------|-------------|
| `type` | `"correct" \| "wrong" \| null` | Feedback type to show |
| `isVisible` | `boolean` | Whether overlay is visible |
| `className` | `string` | Additional classes |

#### Usage:
```tsx
import { GameFeedbackOverlay } from "@/components/game"
import { useGameFeedback } from "@/hooks/use-game-feedback"
import { useGameSounds } from "@/hooks/use-game-sounds"

function GameScreen() {
  const feedback = useGameFeedback({
    onComplete: () => nextQuestion(),
  })
  const sounds = useGameSounds()

  const handleAnswer = (isCorrect: boolean) => {
    if (isCorrect) {
      feedback.showCorrect()
      sounds.playCorrect()
    } else {
      feedback.showWrong()
      sounds.playWrong()
    }
  }

  return (
    <>
      <GameFeedbackOverlay
        type={feedback.feedbackType}
        isVisible={feedback.isShowing}
      />
      <AnswerButton onClick={() => handleAnswer(true)} />
    </>
  )
}
```

#### Visual Behavior:
- **Flash animation:** Quick fade in (0-20%), hold at peak (20-60%), fade out (60-100%)
- **Duration:** 400ms total (fast, immediate feedback)
- **Opacity:** 20% for visibility without obscuring game UI
- **Pointer events:** Disabled (overlay doesn't block interactions)

#### Sound Files:
MP3 files in `public/sounds/`:
- `CorrectAnswerFeedback_sound.mp3` - played on correct answer
- `WrongAnswerFeedback_sound.mp3` - played on wrong answer

**Format:** MP3 for universal browser support (including iOS Safari).

---

## Navigation Components

### Navbar
- **Location:** [components/ui/navbar.tsx](components/ui/navbar.tsx)
- **Type:** Full-featured responsive navigation bar
- **Use case:** Main app navigation with logo, nav links, notifications, and user menu

#### Props:
| Prop | Type | Description |
|------|------|-------------|
| `logo` | `ReactNode` | Logo element or image |
| `navLinks` | `Array<{label, href, active?, badge?}>` | Navigation links configuration |
| `isLoggedIn` | `boolean` | Toggle logged-in/logged-out state |
| `user` | `{name, email, avatarUrl?, initials?}` | User info for logged-in state |
| `notificationCount` | `number` | Badge count on notification bell |
| `onSignUp`, `onSignOut`, etc. | `() => void` | Action callbacks |

#### Usage:
```tsx
import { Navbar } from "@/components/ui/navbar"

<Navbar
  logo={<img src="/logo.svg" alt="Logo" />}
  navLinks={[
    { label: "Play", href: "/play", active: true },
    { label: "Learn", href: "/learn", badge: "PRO" },
  ]}
  isLoggedIn={true}
  user={{ name: "John", email: "john@example.com" }}
  notificationCount={3}
  onSignOut={() => signOut()}
/>
```

#### Features:
- Responsive: Desktop shows full nav, mobile shows hamburger menu
- Nav links support active state and badges
- User dropdown with profile, settings, sign out
- Notification bell with count badge

---

### TopNavbar
- **Location:** [components/ui/top-navbar.tsx](components/ui/top-navbar.tsx)
- **Type:** Minimal contextual header
- **Use case:** Wizard flows, modal-like experiences, focused tasks where full navigation isn't needed

#### Props:
| Prop | Type | Description |
|------|------|-------------|
| `onClose` | `() => void` | Callback when close button clicked |
| `closeHref` | `string` | URL for close button (alternative to callback) |
| `skipLabel` | `string` | Text for skip link (default: "Skip") |
| `skipHref` | `string` | URL for skip link |
| `onSkip` | `() => void` | Callback when skip clicked |
| `hideSkip` | `boolean` | Hide the skip link entirely |

#### Usage:
```tsx
import { TopNavbar } from "@/components/ui/top-navbar"

// With callbacks
<TopNavbar
  onClose={() => router.back()}
  skipHref="/dashboard"
/>

// With links
<TopNavbar
  closeHref="/"
  skipHref="/skip"
  skipLabel="Skip this step"
/>

// Without skip link
<TopNavbar onClose={() => router.back()} hideSkip />
```

#### Design System Compliance:
- Close button: `Button variant="outline" size="icon-sm"` with Nucleo XIcon
- Skip link: `Button variant="link" size="xs"`
- Container: `bg-background border-b shadow-sm h-16 px-6`
- Data attribute: `data-slot="top-navbar"`

## Component Checklist

When adding a new shadcn component:

- [ ] Replace all `lucide-react` imports with `nucleo-core-outline-24`
- [ ] Use `rounded-full` for buttons
- [ ] Use `rounded-md` for badges
- [ ] Use `rounded-4xl` for individual combobox chips
- [ ] Use `rounded-3xl` for cards
- [ ] Use `rounded-lg` for inputs, dropdowns, menu items, nav links
- [ ] Use `rounded-md` for tab triggers
- [ ] Verify semantic color tokens are used (not arbitrary colors)
- [ ] Confirm SVG sizing selector `[&_svg:not([class*='size-'])]:size-4` is present
- [ ] Test keyboard navigation to verify focus rings appear
- [ ] For form inputs: Add error state support (`aria-invalid:border-destructive dark:aria-invalid:border-destructive/50`)
- [ ] For container components: Use `focus-within` pattern for focus rings (see 4.1 above)

## Reference Files

- **Color system:** [app/globals.css](app/globals.css)
- **Font setup:** [app/layout.tsx](app/layout.tsx)
- **Icon exports:** [lib/icons.ts](lib/icons.ts)
- **Button example:** [components/ui/button.tsx](components/ui/button.tsx)
- **Icon usage examples:** See showcase page button section
- **Showcase page:** [app/showcase/page.tsx](app/showcase/page.tsx)
- **Canvas component:** [components/ui/voice-waveform.tsx](components/ui/voice-waveform.tsx)
- **Voice input:** [components/ui/speech-input.tsx](components/ui/speech-input.tsx)
- **Voice recorder hook:** [hooks/use-voice-recorder.ts](hooks/use-voice-recorder.ts)
- **Game timer hook:** [hooks/use-game-timer.ts](hooks/use-game-timer.ts)
- **Game feedback hook:** [hooks/use-game-feedback.ts](hooks/use-game-feedback.ts)
- **Game sounds hook:** [hooks/use-game-sounds.ts](hooks/use-game-sounds.ts)
- **Game components:** [components/game/](components/game/)
- **Sound files:** [public/sounds/](public/sounds/) (add correct.mp3, wrong.mp3)

## Design Philosophy

**Goal:** Create a distinctive UI that feels cohesive and polished while maintaining compatibility with shadcn's component additions.

**Base Style:** This project uses the **Maia** style preset from shadcn/ui, which provides a refined, modern aesthetic with subtle backgrounds and enhanced visual hierarchy.

**Achieved through:**
1. Maia style preset from shadcn/ui (form input backgrounds, color palette)
2. Scaled padding via border radius system (not hardcoded values)
3. Custom font (Poppins) via CSS variables
4. Nucleo icons for visual differentiation
5. Consistent semantic color system
6. Accessible focus ring system

**Result:** New shadcn components automatically inherit most styling. Only icon imports need manual updates.
