"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  IconMicrophoneOutline24 as MicIcon,
  IconMediaStopOutline24 as StopIcon,
  IconMediaPlayOutline24 as PlayIcon,
  IconMessage2ContentOutline24 as SentenceIcon,
  IconBookOutline24 as DictionaryIcon,
} from "nucleo-core-outline-24"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const iconButtonVariants = cva(
  "bg-background border-input size-9 border shadow-sm rounded-full [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      pressed: {
        true: "bg-muted",
        false: "",
      },
    },
    defaultVariants: {
      pressed: false,
    },
  }
)

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
        "bg-secondary border-input flex w-full max-w-[525px] flex-col items-start overflow-clip rounded-lg border shadow-sm",
        className
      )}
    >
      {/* Main content area */}
      <div className="bg-background border-input flex h-[138px] w-full flex-col gap-2.5 overflow-clip rounded-b-lg border p-3">
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
            <button
              type="button"
              onClick={onSentenceClick}
              className={cn(iconButtonVariants({ pressed: sentencePressed }))}
              aria-label="Use word in sentence"
              aria-pressed={sentencePressed}
            >
              <SentenceIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={onDictionaryClick}
              className={cn(iconButtonVariants({ pressed: dictionaryPressed }))}
              aria-label="Show definition"
              aria-pressed={dictionaryPressed}
            >
              <DictionaryIcon className="size-4" />
            </button>
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
            <button
              type="button"
              onClick={onPlayClick}
              className={cn(iconButtonVariants({ pressed: playPressed }))}
              aria-label="Play word"
              aria-pressed={playPressed}
            >
              <PlayIcon className="size-4" />
            </button>
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
