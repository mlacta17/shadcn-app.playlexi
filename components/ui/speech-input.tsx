"use client"

import * as React from "react"
import {
  MicIcon,
  StopIcon,
  PlayIcon,
  SentenceIcon,
  DictionaryIcon,
  KeyboardIcon,
} from "@/lib/icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { VoiceWaveform } from "@/components/ui/voice-waveform"

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

/**
 * Input mode for the SpeechInput component.
 * Per PRD, input mode is locked per game (no mid-game switching).
 * Voice and Keyboard are separate competitive tracks.
 */
export type InputMode = "voice" | "keyboard"

/**
 * Input state representing whether user is actively inputting.
 * - "default": Waiting for input
 * - "recording": Voice recording or keyboard typing in progress
 */
export type InputState = "default" | "recording"

/** Default placeholder text for each input mode */
export const INPUT_MODE_PLACEHOLDERS: Record<InputMode, string> = {
  voice: "no voice input...",
  keyboard: "type to start",
} as const

/**
 * Design System Tokens
 *
 * Layout:
 * - Max width: 525px per Figma design
 * - Main content height: 138px
 * - Gap between waveform and input: 24px (gap-6) per Figma
 *
 * Colors:
 * - Uses semantic color tokens from globals.css
 * - Record/Type button: primary (yellow)
 * - Stop button: destructive (red)
 * - Helper buttons: outline variant
 *
 * Input Modes:
 * - Voice mode: Record/Stop buttons, VoiceWaveform visualization
 * - Keyboard mode: Type to start/Enter to stop, hidden text input
 * - Input mode is locked per game (no mid-game switching per PRD)
 *
 * Integration:
 * - When `analyserNode` is provided (voice mode), VoiceWaveform renders above the input
 * - VoiceWaveform shows active state only when recording
 * - This creates a unified voice/keyboard input experience
 */

// =============================================================================
// PROPS INTERFACE
// =============================================================================

/** Base props shared by both voice and keyboard modes */
interface SpeechInputBaseProps extends React.ComponentProps<"div"> {
  /** Current state of the input - Default or Recording/Typing */
  state?: InputState
  /** The current input text (voice transcript or typed text) */
  inputText?: string
  /** Placeholder text when no input. Defaults to mode-specific placeholder. */
  placeholder?: string
  /** Definition text to show in footer when dictionary is pressed */
  definition?: string
  /** Whether the play button is pressed - shows audio playback message in footer */
  playPressed?: boolean
  /** Whether the dictionary button is pressed - shows definition in footer */
  dictionaryPressed?: boolean
  /** Whether the sentence button is pressed - shows sentence playback message in footer */
  sentencePressed?: boolean
  /** Callback when play button is clicked */
  onPlayClick?: () => void
  /** Callback when dictionary button is clicked */
  onDictionaryClick?: () => void
  /** Callback when sentence button is clicked */
  onSentenceClick?: () => void
}

/** Props specific to voice mode */
interface VoiceModeProps extends SpeechInputBaseProps {
  mode?: "voice"
  /**
   * Audio analyser node from useVoiceRecorder hook.
   * When provided, renders VoiceWaveform above the input controls.
   * The waveform shows active state when state="recording".
   */
  analyserNode?: AnalyserNode | null
  /** Callback when record button is clicked */
  onRecordClick?: () => void
  /** Callback when stop button is clicked */
  onStopClick?: () => void
  // Keyboard-specific props should not be used in voice mode
  onInputChange?: never
  onSubmit?: never
}

/** Props specific to keyboard mode */
interface KeyboardModeProps extends SpeechInputBaseProps {
  mode: "keyboard"
  /**
   * Callback when input text changes.
   * Called on each keystroke with the current input value.
   */
  onInputChange?: (value: string) => void
  /**
   * Callback when user submits their answer.
   * Triggered by pressing Enter or clicking "Enter to stop" button.
   */
  onSubmit?: () => void
  // Voice-specific props should not be used in keyboard mode
  analyserNode?: never
  onRecordClick?: never
  onStopClick?: never
}

/**
 * Props for SpeechInput component.
 * Uses discriminated union to ensure type safety for mode-specific props.
 */
export type SpeechInputProps = VoiceModeProps | KeyboardModeProps

/**
 * Input component for the spelling bee game supporting voice and keyboard modes.
 *
 * This is a **presentational component** that displays:
 * - Optional VoiceWaveform visualization (voice mode only, when analyserNode is provided)
 * - Input text display area
 * - Record/Stop button (voice) or Type/Enter button (keyboard)
 * - Helper buttons (Sentence, Dictionary, Play)
 * - Contextual footer messages
 *
 * ## Architecture
 * The component is intentionally "dumb" — it doesn't manage audio or input state.
 * Audio capture is handled by `useVoiceRecorder` hook. Keyboard input state
 * is managed by the parent component.
 * This separation allows:
 * - Easy testing (just pass props)
 * - Flexibility in how input is managed
 * - Clear separation of concerns
 *
 * ## Usage with Voice Mode (useVoiceRecorder)
 * ```tsx
 * const { isRecording, startRecording, stopRecording, analyserNode, transcript } = useVoiceRecorder()
 *
 * <SpeechInput
 *   mode="voice"
 *   state={isRecording ? "recording" : "default"}
 *   analyserNode={analyserNode}
 *   inputText={transcript}
 *   onRecordClick={startRecording}
 *   onStopClick={stopRecording}
 * />
 * ```
 *
 * ## Usage with Keyboard Mode
 * ```tsx
 * const [text, setText] = useState("")
 * const [isTyping, setIsTyping] = useState(false)
 *
 * <SpeechInput
 *   mode="keyboard"
 *   state={isTyping ? "recording" : "default"}
 *   inputText={text}
 *   onInputChange={(value) => {
 *     setText(value)
 *     if (!isTyping && value) setIsTyping(true)
 *   }}
 *   onSubmit={() => {
 *     // Handle submission
 *     setIsTyping(false)
 *   }}
 * />
 * ```
 */
function SpeechInput(props: SpeechInputProps) {
  // Destructure all component-specific props to prevent them from spreading to DOM
  const {
    // Shared props
    mode = "voice",
    state = "default",
    inputText,
    placeholder,
    definition,
    playPressed = false,
    dictionaryPressed = false,
    sentencePressed = false,
    onPlayClick,
    onDictionaryClick,
    onSentenceClick,
    className,
    // Voice mode props (extract to prevent DOM spread)
    analyserNode: _analyserNode,
    onRecordClick: _onRecordClick,
    onStopClick: _onStopClick,
    // Keyboard mode props (extract to prevent DOM spread)
    onInputChange: _onInputChange,
    onSubmit: _onSubmit,
    // Remaining DOM-safe props
    ...domProps
  } = props as SpeechInputProps & {
    // Type assertion needed because discriminated union makes these mutually exclusive
    analyserNode?: AnalyserNode | null
    onRecordClick?: () => void
    onStopClick?: () => void
    onInputChange?: (value: string) => void
    onSubmit?: () => void
  }

  // Type-safe access to mode-specific props
  const analyserNode = mode === "voice" ? _analyserNode : undefined
  const onRecordClick = mode === "voice" ? _onRecordClick : undefined
  const onStopClick = mode === "voice" ? _onStopClick : undefined
  const onInputChange = mode === "keyboard" ? _onInputChange : undefined
  const onSubmit = mode === "keyboard" ? _onSubmit : undefined

  // Refs
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Derived state
  const isRecording = state === "recording"
  const hasInput = Boolean(inputText)
  const isKeyboardMode = mode === "keyboard"

  // Default placeholder based on mode (using exported constant)
  const displayPlaceholder = placeholder ?? INPUT_MODE_PLACEHOLDERS[mode]

  // Only show active waveform when actually recording in voice mode
  // This prevents showing stale visualization when analyserNode is cached
  const activeAnalyserNode = isRecording ? analyserNode : null

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  /** Focus the input when "Type to start" is clicked */
  const handleTypeClick = React.useCallback(() => {
    inputRef.current?.focus()
  }, [])

  /** Handle keyboard input changes */
  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onInputChange?.(e.target.value)
    },
    [onInputChange]
  )

  /** Handle Enter key for submission */
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        onSubmit?.()
      }
    },
    [onSubmit]
  )

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  /**
   * Auto-focus the input when keyboard mode becomes active.
   * This provides immediate typing capability without requiring a click.
   */
  React.useEffect(() => {
    if (isKeyboardMode && !isRecording) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isKeyboardMode, isRecording])

  // ---------------------------------------------------------------------------
  // Footer Text Logic
  // ---------------------------------------------------------------------------

  /** Determine footer text based on which helper button is pressed */
  const getFooterText = (): string | null => {
    if (playPressed) {
      return "Word is being spoken. Make sure your volume is on."
    }
    if (sentencePressed) {
      return "Word is being used in a sentence. Make sure your volume is on."
    }
    if (dictionaryPressed && definition) {
      return definition
    }
    return null
  }

  const footerText = getFooterText()

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Generate unique ID for accessibility associations
  const inputId = React.useId()
  const statusId = `${inputId}-status`

  return (
    <div
      data-slot="speech-input"
      data-mode={mode}
      data-state={state}
      data-has-waveform={!isKeyboardMode && analyserNode ? "true" : "false"}
      className={cn(
        "flex w-full max-w-[525px] flex-col items-center",
        // Gap between waveform and input area (24px per Figma)
        "gap-6",
        className
      )}
      {...domProps}
    >
      {/* Voice Waveform - only renders in voice mode when analyserNode is provided */}
      {!isKeyboardMode && analyserNode !== undefined && (
        <VoiceWaveform
          analyserNode={activeAnalyserNode}
          className="shrink-0"
        />
      )}

      {/* Input container with background and border */}
      <div
        data-slot="speech-input-container"
        className="bg-input/30 outline-input flex w-full flex-col items-start overflow-clip rounded-lg outline outline-1 -outline-offset-1"
      >
        {/* Main content area */}
        <div className="bg-background border-input flex h-36 w-full flex-col gap-2.5 rounded-lg border p-3">
        {/* Hidden input for keyboard mode - captures keystrokes */}
        {isKeyboardMode && (
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={inputText ?? ""}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="sr-only"
            aria-label="Type your spelling"
            aria-describedby={footerText ? statusId : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        )}

        {/* Input text display - serves as live region for screen readers */}
        <p
          id={statusId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "w-full grow overflow-hidden text-ellipsis text-nowrap text-center text-xl leading-7 italic",
            hasInput ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {hasInput ? `"${inputText}"` : `"${displayPlaceholder}"`}
        </p>

        {/* Controls row */}
        <div className="flex w-full shrink-0 items-center justify-between">
          {/* Left buttons - Sentence and Dictionary (disabled while recording) */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onSentenceClick}
              aria-label="Use word in sentence"
              disabled={isRecording}
            >
              <SentenceIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onDictionaryClick}
              aria-label="Show definition"
              disabled={isRecording}
            >
              <DictionaryIcon />
            </Button>
          </div>

          {/* Center button - Voice: Record/Stop, Keyboard: Type/Enter */}
          {isKeyboardMode ? (
            // Keyboard mode buttons
            isRecording ? (
              <Button variant="destructive" size="sm" onClick={onSubmit}>
                <StopIcon data-icon="inline-start" />
                Enter to stop
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={handleTypeClick}>
                <KeyboardIcon data-icon="inline-start" />
                Type to start
              </Button>
            )
          ) : (
            // Voice mode buttons
            isRecording ? (
              <Button variant="destructive" size="sm" onClick={onStopClick}>
                <StopIcon data-icon="inline-start" />
                Stop
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={onRecordClick}>
                <MicIcon data-icon="inline-start" />
                Record
              </Button>
            )
          )}

          {/* Right button - Play (disabled while recording) */}
          <div className="flex min-w-[80px] shrink-0 items-center justify-end gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onPlayClick}
              aria-label="Play word"
              disabled={isRecording}
            >
              <PlayIcon />
            </Button>
          </div>
        </div>
        </div>

        {/* Footer text area - shows contextual info based on pressed button */}
        {footerText && (
          <div className="flex w-full items-center justify-center p-3">
            <p
              className={cn(
                "text-muted-foreground w-full text-sm leading-normal",
                (playPressed || sentencePressed) && "italic text-nowrap"
              )}
            >
              {footerText}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export { SpeechInput }
