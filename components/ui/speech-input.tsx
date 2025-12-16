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

export interface SpeechInputProps extends React.ComponentProps<"div"> {
  /** Current state of the input - Default or Recording */
  state?: "default" | "recording"
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

function SpeechInput({
  state = "default",
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
      className={cn(
        "bg-secondary outline-input flex w-full max-w-[525px] flex-col items-start overflow-clip rounded-lg outline outline-1 -outline-offset-1",
        className
      )}
      {...props}
    >
      {/* Main content area */}
      <div className="bg-background border-input flex h-[138px] w-full flex-col gap-2.5 rounded-b-lg border p-3">
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
  )
}

export { SpeechInput }
