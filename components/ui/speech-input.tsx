"use client"

import * as React from "react"
import {
  IconMicrophoneOutline24 as MicIcon,
  IconMediaStopOutline24 as StopIcon,
  IconMediaPlayOutline24 as PlayIcon,
  IconMessage2ContentOutline24 as SentenceIcon,
  IconBookOutline24 as DictionaryIcon,
} from "nucleo-core-outline-24"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface SpeechInputProps {
  /** Current state of the input - Default or Recording */
  state?: "default" | "recording"
  /** Whether the play button is pressed */
  playPressed?: boolean
  /** Whether the dictionary button is pressed */
  dictionaryPressed?: boolean
  /** Whether the sentence button is pressed */
  sentencePressed?: boolean
  /** The current voice input text */
  inputText?: string
  /** Placeholder text when no input */
  placeholder?: string
  /** Definition text to show in footer */
  definition?: string
  /** Status text to show in footer (for play/sentence states) */
  statusText?: string
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
  /** Additional class names */
  className?: string
}

function SpeechInput({
  state = "default",
  playPressed = false,
  dictionaryPressed = false,
  sentencePressed = false,
  inputText,
  placeholder = "no voice input...",
  definition,
  statusText,
  onRecordClick,
  onStopClick,
  onPlayClick,
  onDictionaryClick,
  onSentenceClick,
  className,
}: SpeechInputProps) {
  const isRecording = state === "recording"
  const hasInput = Boolean(inputText)

  // Determine footer text
  const getFooterText = () => {
    if (playPressed) {
      return statusText || "*Word being spoken out right now. Make sure volume is on*"
    }
    if (sentencePressed) {
      return statusText || "*Word being used in a sentence. Make sure volume is on*"
    }
    if (dictionaryPressed || definition) {
      return definition || "Definition: [insert definition of word, but not the word]"
    }
    return null
  }

  const footerText = getFooterText()
  const showFooter = Boolean(footerText)

  return (
    <div
      data-slot="speech-input"
      data-state={state}
      className={cn(
        "bg-secondary border-input flex w-full max-w-[525px] flex-col items-start overflow-clip rounded-lg border",
        className
      )}
    >
      {/* Main content area */}
      <div className="bg-transparent border-input flex h-[138px] w-full flex-col gap-2.5 overflow-clip rounded-b-lg border p-3">
        {/* Voice input display */}
        <p
          className={cn(
            "min-h-px min-w-px w-full grow shrink-0 basis-0 overflow-hidden text-ellipsis text-nowrap text-center text-xl leading-7 italic",
            hasInput ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {hasInput ? `"${inputText}"` : `"${placeholder}"`}
        </p>

        {/* Footer controls */}
        <div className="flex w-full shrink-0 items-center justify-between">
          {/* Left buttons - Sentence and Dictionary */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onSentenceClick}
              aria-label="Use word in sentence"
              aria-pressed={sentencePressed}
              className={cn(sentencePressed && "bg-muted")}
            >
              <SentenceIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onDictionaryClick}
              aria-label="Show definition"
              aria-pressed={dictionaryPressed}
              className={cn(dictionaryPressed && "bg-muted")}
            >
              <DictionaryIcon />
            </Button>
          </div>

          {/* Center button - Record/Stop */}
          {isRecording ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={onStopClick}
              className="h-9"
            >
              <StopIcon data-icon="inline-start" />
              Stop
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onRecordClick}
              className="h-9"
            >
              <MicIcon data-icon="inline-start" />
              Record
            </Button>
          )}

          {/* Right button - Play */}
          <div className="flex min-w-[80px] shrink-0 items-center justify-end gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onPlayClick}
              aria-label="Play word"
              aria-pressed={playPressed}
              className={cn(playPressed && "bg-muted")}
            >
              <PlayIcon />
            </Button>
          </div>
        </div>
      </div>

      {/* Footer text area */}
      {showFooter && (
        <div className="flex w-full shrink-0 items-center justify-center p-3">
          <p
            className={cn(
              "text-muted-foreground min-h-px min-w-px h-full w-full overflow-hidden text-ellipsis text-nowrap text-sm leading-5",
              (playPressed || sentencePressed) && "italic"
            )}
          >
            {footerText}
          </p>
        </div>
      )}
    </div>
  )
}

export { SpeechInput }
