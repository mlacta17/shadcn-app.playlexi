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
  - `rounded-xl` = 12px (Tailwind default) - **for table containers, data displays**
  - `rounded-3xl` = 24px (Tailwind default) - **for cards and card images**
  - `rounded-4xl` = 26px (`calc(var(--radius) + 16px)`) - **for individual combobox chips**
  - `rounded-full` = 9999px (Tailwind default) - **for buttons**
- **Visual hierarchy:**
  - Extra Subtle (6px): Tab triggers, badges - minimal, clean
  - Subtle (8px): Form inputs, dropdown containers, menu items, nav links - cohesive, functional
  - Medium-Subtle (12px): Table containers, data tables - structured data displays
  - Medium (24px): Cards, card images - structured, contained
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
  - Use `rounded-xl` for table containers (DataTable wrapper)
  - Use `rounded-3xl` for cards AND images inside cards (must match for visual cohesion)
  - Use `rounded-4xl` for individual combobox chips (the pills inside ComboboxChips)
  - Use `rounded-full` for buttons

### 3. Component Padding Scale
- **Pattern:** ~33% increase from shadcn defaults
- **Implementation:** Achieved via larger border radius utilities
- **Action:** None - use the rounded utilities above

### 3.1. Z-Index Scale
Consistent layering system for overlapping elements:

| Value | Tailwind | Use For |
|-------|----------|---------|
| 10 | `z-10` | Badges, floating indicators (on top of content) |
| 20 | `z-20` | Sticky headers, floating elements |
| 30 | `z-30` | Tooltips, popovers |
| 40 | `z-40` | Dropdowns, menus (navbar mobile menu) |
| 50 | `z-50` | Modals, dialogs, overlays, game feedback |

**Important:** Dropdown menus use `z-40` so modals (`z-50`) can appear above them.

### 3.2. Spacing Scale (Tailwind Standard)
**IMPORTANT:** Always use Tailwind's standard spacing scale. Never use arbitrary pixel values like `h-[138px]` or `max-w-[525px]`.

Common values for Figma parity:

| Tailwind | Pixels | Common Usage |
|----------|--------|--------------|
| `h-5` | 20px | Badge height |
| `h-6` | 24px | Combobox chip height |
| `h-7` | 28px | Button xs |
| `h-9` | 36px | Button sm, Select sm, TabsList |
| `h-10` | 40px | Input, Select, Button default |
| `h-11` | 44px | Button lg |
| `h-36` | 144px | SpeechInput main area |
| `max-w-sm` | 384px | Narrow content containers |
| `max-w-lg` | 512px | Medium content containers (SpeechInput) |
| `max-w-xl` | 576px | Wide content containers |
| `max-w-2xl` | 672px | Extra wide containers |

**When Figma values don't match Tailwind:**
- Round to the nearest Tailwind value
- Update Figma to match Tailwind (not vice versa)
- Document the decision in this guide

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
  - `text-success` / `bg-success-muted` - positive indicators, correct feedback
  - `bg-highlight` - current user row highlighting, "this is you" indicators
- **Hover states:** `--primary-hover`, `--secondary-hover`, `--destructive-hover`
- **Action:** Use semantic tokens instead of arbitrary colors

#### Success Colors
Used for positive states like correct answers, score increases, and success feedback.

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--success` | emerald-600 | emerald-400 | Positive text (e.g., "+2" delta) |
| `--success-muted` | green-500/20 | green-400/20 | Overlay backgrounds (e.g., correct answer flash) |

```tsx
// Positive delta indicator
<span className={delta > 0 ? "text-success" : "text-destructive"}>
  {delta > 0 ? "+" : ""}{delta}
</span>

// Success overlay
<div className="bg-success-muted" />
```

#### Highlight Colors
Used for "this is you" indicators like current user row in tables.

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--highlight` | primary/5% | primary/8% | Subtle row background for current user |

**UX Rationale:**
- Uses primary color at low opacity for brand consistency
- Avoids yellow/warning semantics ("attention needed")
- Dark mode uses slightly higher opacity (8%) for visibility on dark backgrounds
- Subtle enough to not distract, clear enough to spot yourself

```tsx
// Current user row highlighting (DataTable)
<DataTable
  columns={columns}
  data={players}
  isCurrentUserRow={(player) => player.id === currentUserId}
/>

// Custom usage
<div className="bg-highlight">You are here</div>
```

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
- **Hook:** [hooks/use-voice-recorder.ts](hooks/use-voice-recorder.ts) (voice mode)
- **Type:** Presentational input component with voice and keyboard modes

#### Design System Integration:
| Aspect | Implementation |
|--------|----------------|
| **Max width** | `max-w-lg` (512px) - Tailwind scale |
| **Main area height** | `h-36` (144px) - Tailwind scale |
| **Waveform gap** | `gap-6` (24px) |
| **Container** | `bg-input/30 outline-input rounded-lg` |
| **Voice buttons** | Primary (Record), Destructive (Stop), Outline (helpers) |
| **Keyboard buttons** | Primary (Type to start), Destructive (Enter to stop), Outline (helpers) |
| **Attributes** | `data-slot="speech-input"`, `data-mode="voice\|keyboard"`, `data-state="default\|recording"`, `data-has-waveform` |
| **Icons** | MicIcon, KeyboardIcon, StopIcon, PlayIcon, SentenceIcon, DictionaryIcon from lib/icons.ts |

#### Input Modes:
| Mode | Use Case | Trigger | Stop |
|------|----------|---------|------|
| **Voice** | Microphone input | Record button | Stop button |
| **Keyboard** | Typed spelling | Start typing or click "Type to start" | Press Enter or click "Enter to stop" |

**Important:** Per PRD, input mode is locked per game (no mid-game switching). Voice and Keyboard are separate competitive tracks.

#### Architecture:
```
Voice mode:
useVoiceRecorder (hook)
└── SpeechInput (presentational)
    ├── analyserNode → VoiceWaveform (auto-rendered when provided)
    ├── transcript → inputText display
    └── isRecording → state prop

Keyboard mode:
Parent state management
└── SpeechInput (presentational)
    ├── Hidden input captures keystrokes
    ├── onInputChange → update parent state
    └── onSubmit → handle Enter key
```

VoiceWaveform is **only shown in voice mode**. When you pass `analyserNode` in voice mode, the waveform renders automatically above the input controls.

#### Props:
| Prop | Type | Description |
|------|------|-------------|
| `mode` | `"voice" \| "keyboard"` | Input method. Default: `"voice"` |
| `state` | `"default" \| "recording"` | Current input state (recording/typing) |
| `analyserNode` | `AnalyserNode \| null` | Audio analyser for waveform (voice mode only) |
| `inputText` | `string` | Current input text |
| `placeholder` | `string` | Placeholder text (default: mode-specific) |
| `definition` | `string` | Dictionary definition to show in footer |
| `playPressed` | `boolean` | Play button state |
| `dictionaryPressed` | `boolean` | Dictionary button state |
| `sentencePressed` | `boolean` | Sentence button state |
| `onRecordClick` | `() => void` | Voice mode: Record button clicked |
| `onStopClick` | `() => void` | Voice mode: Stop button clicked |
| `onInputChange` | `(value: string) => void` | Keyboard mode: Text changed |
| `onSubmit` | `() => void` | Keyboard mode: Enter pressed or "Enter to stop" clicked |
| `onPlayClick`, `onDictionaryClick`, `onSentenceClick` | `() => void` | Helper button callbacks |

#### Usage - Voice Mode:
```tsx
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import { SpeechInput } from "@/components/ui/speech-input"

function VoiceInputScreen() {
  const { isRecording, startRecording, stopRecording, analyserNode, transcript } = useVoiceRecorder()

  return (
    <SpeechInput
      mode="voice"
      state={isRecording ? "recording" : "default"}
      analyserNode={analyserNode}
      inputText={transcript}
      onRecordClick={startRecording}
      onStopClick={stopRecording}
    />
  )
}
```

#### Usage - Keyboard Mode:
```tsx
import { useState } from "react"
import { SpeechInput } from "@/components/ui/speech-input"

function KeyboardInputScreen() {
  const [text, setText] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  return (
    <SpeechInput
      mode="keyboard"
      state={isTyping ? "recording" : "default"}
      inputText={text}
      onInputChange={(value) => {
        setText(value)
        if (!isTyping && value) setIsTyping(true)
      }}
      onSubmit={() => {
        // Validate answer
        console.log("Submitted:", text)
        setIsTyping(false)
      }}
    />
  )
}
```

#### Visual Behavior:
- **Voice mode:**
  - VoiceWaveform renders above input when `analyserNode` provided
  - Waveform only animates when `state="recording"` (prevents stale visualization)
  - Record/Stop buttons in center
  - Placeholder: "no voice input..."
- **Keyboard mode:**
  - No VoiceWaveform
  - Type to start/Enter to stop buttons in center
  - Hidden input captures keystrokes
  - Placeholder: "type to start"
- **Both modes:**
  - Helper buttons (Sentence, Dictionary, Play) disabled during recording/typing
  - Footer shows contextual messages based on pressed button
  - Input text wrapped in quotes, italicized, centered

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

### RankBadge
- **Location:** [components/game/rank-badge.tsx](components/game/rank-badge.tsx)
- **Type:** Presentational component
- **Use case:** Display player rank tier badges throughout the app

#### Design System Integration:
| Aspect | Implementation |
|--------|----------------|
| **Rank tiers** | 7 tiers: New Bee → Bumble Bee → Busy Bee → Honey Bee → Worker Bee → Royal Bee → Bee Keeper |
| **Variants** | 14 total (7 tiers × 2 modes: light/dark) |
| **Sizes** | sm (32px), md (48px), lg (64px), xl (96px) |
| **Theme switching** | Auto-switches with theme, or force via `mode` prop |
| **Assets** | SVG files in `public/badges/` with naming `{rank}-{mode}.svg` |
| **Attributes** | Uses Next.js `Image` component for optimization |

#### Props:
| Prop | Type | Description |
|------|------|-------------|
| `rank` | `RankTier` | The rank tier to display (`"new-bee"` through `"bee-keeper"`) |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | Badge size preset. Default: `"md"` |
| `mode` | `"light" \| "dark"` | Force specific mode (optional, auto-switches with theme) |
| `className` | `string` | Additional CSS classes |

#### Usage:
```tsx
import { RankBadge } from "@/components/game"

// Basic - auto theme switching
<RankBadge rank="honey-bee" />

// With size
<RankBadge rank="royal-bee" size="lg" />

// Force specific mode
<RankBadge rank="bee-keeper" mode="dark" />
```

#### Asset Files:
SVG files in `public/badges/`:
- `new-bee-light.svg`, `new-bee-dark.svg`
- `bumble-bee-light.svg`, `bumble-bee-dark.svg`
- `busy-bee-light.svg`, `busy-bee-dark.svg`
- `honey-bee-light.svg`, `honey-bee-dark.svg`
- `worker-bee-light.svg`, `worker-bee-dark.svg`
- `royal-bee-light.svg`, `royal-bee-dark.svg`
- `bee-keeper-light.svg`, `bee-keeper-dark.svg`

#### Helper Exports:
| Export | Type | Description |
|--------|------|-------------|
| `RANK_LABELS` | `Record<RankTier, string>` | Human-readable tier names |
| `BADGE_PATHS` | `Record<RankTier, {light, dark}>` | Asset paths for each tier |
| `BADGE_SIZES` | `Record<BadgeSize, number>` | Pixel dimensions for each size |

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
| `centerContent` | `ReactNode` | Content for center (e.g., title, game mode label) |
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

// With center content (e.g., game mode title)
<TopNavbar
  onClose={() => router.back()}
  centerContent="Game mode: Endless"
  hideSkip
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
- Center content: Absolutely positioned, `text-sm font-medium` for subtlety
- Skip link: `Button variant="link" size="xs"`
- Container: `relative bg-background border-b shadow-sm h-16 px-6`
- Data attribute: `data-slot="top-navbar"`

---

### HexPattern
- **Location:** [components/ui/hex-pattern.tsx](components/ui/hex-pattern.tsx)
- **Type:** Decorative background pattern
- **Use case:** Subtle hexagonal backgrounds for pages and sections
- **Figma source:** Node `2641:7585`

#### Props:
| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | Additional classes for positioning/styling |

#### Usage:
```tsx
import { HexPattern } from "@/components/ui/hex-pattern"

// Full-page background
<div className="relative min-h-screen">
  <HexPattern className="absolute inset-0 -z-10" />
  <main className="relative">Content</main>
</div>

// Section background with custom opacity
<section className="relative overflow-hidden">
  <HexPattern className="absolute inset-0 -z-10 opacity-30" />
  <div className="relative">Section content</div>
</section>
```

#### Architecture Note:
This is a component (not a static SVG in `public/`) because we anticipate future dynamic theming needs. The component includes commented code for future enhancements:
- Dynamic color via props or CSS variables
- Theme-aware light/dark variants
- Configurable density/scale
- Animation support

#### Design System Compliance:
- Uses `currentColor` with `text-muted-foreground` for theme-aware coloring
- Fill opacity at 5% for subtle background effect
- Includes `aria-hidden="true"` for accessibility
- Applies `pointer-events-none` to prevent interaction blocking

---

## Data Table Components

### DataTable (Reusable)
- **Location:** [components/ui/data-table.tsx](components/ui/data-table.tsx)
- **Type:** Generic TanStack Table wrapper
- **Use case:** Any paginated data display (leaderboards, match history, user lists)

#### Architecture:
Following the official shadcn/ui data table pattern:
```
app/{feature}/
├── columns.tsx      (column definitions - client component)
├── data-table.tsx   (OR use shared DataTable from components/ui/)
└── page.tsx         (server component for data fetching)
```

#### Props:
| Prop | Type | Description |
|------|------|-------------|
| `columns` | `ColumnDef<TData>[]` | TanStack Table column definitions |
| `data` | `TData[]` | Array of row data |
| `pageSize` | `number` | Rows per page (default: 10) |
| `emptyMessage` | `string` | Message when no data |
| `renderPagination` | `(table) => ReactNode` | Custom pagination controls |
| `isCurrentUserRow` | `(row: TData) => boolean` | Function to highlight current user's row |

#### Usage:
```tsx
import { DataTable } from "@/components/ui/data-table"
import { columns } from "./columns"

// Basic usage
<DataTable columns={columns} data={payments} pageSize={10} />

// With current user highlighting (e.g., leaderboard)
<DataTable
  columns={leaderboardColumns}
  data={players}
  isCurrentUserRow={(player) => player.id === currentUserId}
/>
```

#### Current User Row Highlighting:
Use the `isCurrentUserRow` prop to highlight a specific row (e.g., the logged-in user in a leaderboard).

**Implementation:**
- Uses semantic `bg-highlight` token (see Section 7 - Highlight Colors)
- Light mode: primary at 5% opacity
- Dark mode: primary at 8% opacity for visibility

**UX Rationale:**
- Uses semantic `--highlight` token for brand-consistent highlighting
- Avoids yellow/warning colors which have semantic meaning ("attention needed")
- `data-current-user` attribute added for CSS hooks if needed
- Subtle enough to not distract but clear enough for users to find themselves

#### Design System Compliance:
- Uses `rounded-xl border` for table container (per border radius scale - 12px for data displays)
- Current user row: `bg-highlight` (semantic token - 5%/8% primary)
- Empty state uses `text-muted-foreground`
- `data-slot="data-table"` attribute for styling hooks
- `data-current-user` attribute on highlighted rows

### LeaderboardTable (Domain-Specific)
- **Location:** [components/game/leaderboard-table.tsx](components/game/leaderboard-table.tsx)
- **Columns:** [components/game/leaderboard-columns.tsx](components/game/leaderboard-columns.tsx)
- **Type:** Game-specific data table with custom cells

#### Column Cell Components:
| Component | Purpose | Design Notes |
|-----------|---------|--------------|
| Rank cell | All rank badges | Uses `getRankVariant()` helper for consistent Badge styling |
| `PlayerCell` | Avatar + name + description | Uses Avatar component |
| `RoundCell` | Score with delta indicator | Green (+) / destructive (-) |
| `PointsCell` | Total points earned | `toLocaleString()` formatting, shows "-" if undefined |

All cell components follow the same pattern:
- Dedicated component with typed props interface
- `data-slot` attribute for styling hooks
- Defensive handling of optional values
- Exported for reuse outside the table context

#### Badge Rank Variants:
All ranks use the Badge component for consistent visual alignment.
The `getRankVariant()` helper function returns the appropriate variant:

| Variant | Color Token | Use Case |
|---------|-------------|----------|
| `gold` | `--placement-gold` | 1st place |
| `silver` | `--placement-silver` | 2nd place |
| `bronze` | `--placement-bronze` | 3rd place |
| `secondary` | `--secondary` | 4th place onwards |

```tsx
import { Badge } from "@/components/ui/badge"

// Top 3 use placement colors
<Badge variant="gold">1</Badge>
<Badge variant="silver">2</Badge>
<Badge variant="bronze">3</Badge>

// 4th+ use secondary (gray)
<Badge variant="secondary">4</Badge>
```

The `getRankVariant()` helper in `leaderboard-columns.tsx` encapsulates this logic:
```tsx
function getRankVariant(rank: number): "gold" | "silver" | "bronze" | "secondary" {
  switch (rank) {
    case 1: return "gold"
    case 2: return "silver"
    case 3: return "bronze"
    default: return "secondary"
  }
}
```

#### Placement Colors (globals.css):
Colors match Figma design using Tailwind equivalents. Foreground uses `--primary-foreground` for consistency with primary button text.

```css
/* Background colors (Tailwind equivalents) */
--placement-gold: oklch(0.852 0.199 91.936);    /* yellow-400 (#facc15) - 1st place */
--placement-silver: oklch(0.901 0.058 230.902); /* sky-200 (#bae6fd) - 2nd place */
--placement-bronze: oklch(0.666 0.179 58.318);  /* amber-600 (#d97706) - 3rd place */

/* Foreground colors (text) */
--placement-gold-foreground: var(--primary-foreground);
--placement-silver-foreground: var(--primary-foreground);
--placement-bronze-foreground: var(--primary-foreground);
```

#### Usage:
```tsx
import { LeaderboardTable } from "@/components/game"

<LeaderboardTable
  data={players}
  pageSize={7}
/>
```

---

## ⚠️ Adding shadcn Components Safely

**CRITICAL:** The shadcn CLI can overwrite customized components. Always use these flags:

```bash
# Preview changes before applying (recommended)
npx shadcn@latest add <component> --diff

# Prevent overwriting existing files
npx shadcn@latest add <component> --no-overwrite
```

### Protected Components (DO NOT overwrite)
These components have custom styling that differs from shadcn defaults:

| Component | Custom Modifications |
|-----------|---------------------|
| `button.tsx` | Larger sizes (h-10 default), CSS variable hover states, solid destructive |
| `badge.tsx` | Placement variants (gold/silver/bronze), rounded-md |
| `card.tsx` | rounded-3xl border radius |
| `input.tsx` | bg-input/30, aria-invalid states |
| `pagination.tsx` | Custom layout, Nucleo icons, size-10 elements |

### If a component gets overwritten:
1. Check `git diff components/ui/<component>.tsx`
2. Restore with `git checkout HEAD~1 -- components/ui/<component>.tsx`
3. Manually merge any new features needed

---

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
- **Background patterns:** [components/ui/hex-pattern.tsx](components/ui/hex-pattern.tsx)
- **Data table:** [components/ui/data-table.tsx](components/ui/data-table.tsx)
- **Leaderboard:** [components/game/leaderboard-table.tsx](components/game/leaderboard-table.tsx)

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
