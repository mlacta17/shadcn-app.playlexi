"use client"

import * as React from "react"
import {
  MicIcon,
  StopIcon,
  PlayIcon,
  SentenceIcon,
  DictionaryIcon,
} from "@/lib/icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { VoiceWaveform } from "@/components/ui/voice-waveform"

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
 * - Record button: primary (yellow)
 * - Stop button: destructive (red)
 * - Helper buttons: outline variant
 *
 * Integration:
 * - When `analyserNode` is provided, VoiceWaveform renders above the input
 * - VoiceWaveform shows active state only when recording
 * - This creates a unified voice input experience
 */

export interface SpeechInputProps extends React.ComponentProps<"div"> {
  /** Current state of the input - Default or Recording */
  state?: "default" | "recording"
  /**
   * Audio analyser node from useVoiceRecorder hook.
   * When provided, renders VoiceWaveform above the input controls.
   * The waveform shows active state when state="recording".
   */
  analyserNode?: AnalyserNode | null
  /** Whether the play button is pressed - shows audio playback message in footer */
  playPressed?: boolean
  /** Whether the dictionary button is pressed - shows definition in footer */
  dictionaryPressed?: boolean
  /** Whether the sentence button is pressed - shows sentence playback message in footer */
  sentencePressed?: boolean
  /** The current voice input text */
  inputText?: string
  /** Placeholder text when no input */
  placeholder?: string
  /** Definition text to show in footer when dictionary is pressed */
  definition?: string
  /** Callback when record button is clicked */
  onRecordClick?: () => void
  /** Callback when stop button is clicked */
  onStopClick?: () => void
  /** Callback when play button is clicked */
  onPlayClick?: () => void
  /** Callback when dictionary button is clicked */
  onDictionaryClick?: () => void
  /** Callback when sentence button is clicked */
  onSentenceClick?: () => void
}

/**
 * Voice input component for the spelling bee game.
 *
 * This is a **presentational component** that displays:
 * - Optional VoiceWaveform visualization (when analyserNode is provided)
 * - Transcript display area
 * - Record/Stop button
 * - Helper buttons (Sentence, Dictionary, Play)
 * - Contextual footer messages
 *
 * ## Architecture
 * The component is intentionally "dumb" — it doesn't manage audio state.
 * Audio capture and speech recognition are handled by `useVoiceRecorder` hook.
 * This separation allows:
 * - Easy testing (just pass props)
 * - Flexibility in how audio is managed
 * - Clear separation of concerns
 *
 * ## Usage with useVoiceRecorder
 * ```tsx
 * const { isRecording, startRecording, stopRecording, analyserNode, transcript } = useVoiceRecorder()
 *
 * <SpeechInput
 *   state={isRecording ? "recording" : "default"}
 *   analyserNode={analyserNode}
 *   inputText={transcript}
 *   onRecordClick={startRecording}
 *   onStopClick={stopRecording}
 * />
 * ```
 */
function SpeechInput({
  state = "default",
  analyserNode,
  playPressed = false,
  dictionaryPressed = false,
  sentencePressed = false,
  inputText,
  placeholder = "no voice input...",
  definition,
  onRecordClick,
  onStopClick,
  onPlayClick,
  onDictionaryClick,
  onSentenceClick,
  className,
  ...props
}: SpeechInputProps) {
  const isRecording = state === "recording"
  const hasInput = Boolean(inputText)

  // Only show active waveform when actually recording
  // This prevents showing stale visualization when analyserNode is cached
  const activeAnalyserNode = isRecording ? analyserNode : null

  // Determine footer text based on which button is pressed
  const getFooterText = () => {
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

  return (
    <div
      data-slot="speech-input"
      data-state={state}
      data-has-waveform={analyserNode ? "true" : "false"}
      className={cn(
        "flex w-full max-w-[525px] flex-col items-center",
        // Gap between waveform and input area (24px per Figma)
        "gap-6",
        className
      )}
      {...props}
    >
      {/* Voice Waveform - only renders when analyserNode is provided */}
      {analyserNode !== undefined && (
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
        <div className="bg-background border-input flex h-[138px] w-full flex-col gap-2.5 rounded-lg border p-3">
        {/* Voice input display */}
        <p
          className={cn(
            "w-full grow overflow-hidden text-ellipsis text-nowrap text-center text-xl leading-7 italic",
            hasInput ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {hasInput ? `"${inputText}"` : `"${placeholder}"`}
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

          {/* Center button - Record/Stop */}
          {isRecording ? (
            <Button variant="destructive" size="sm" onClick={onStopClick}>
              <StopIcon data-icon="inline-start" />
              Stop
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={onRecordClick}>
              <MicIcon data-icon="inline-start" />
              Record
            </Button>
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
