/**
 * Phonetic Debug Panel — Development-only observability for phonetic learning.
 *
 * This collapsible panel displays:
 * - User's learned phonetic mappings
 * - Recent recognition logs
 * - Aggregate statistics
 *
 * ## Usage
 *
 * Only renders in development mode (NODE_ENV === 'development').
 * Add to game pages where phonetic learning is active:
 *
 * ```tsx
 * import { PhoneticDebugPanel } from "@/components/debug/phonetic-debug-panel"
 *
 * function GamePage() {
 *   const { userId } = usePhoneticLearning()
 *   return (
 *     <div>
 *       {/* game UI *\/}
 *       <PhoneticDebugPanel userId={userId} />
 *     </div>
 *   )
 * }
 * ```
 *
 * ## Architecture
 *
 * - Fetches data from `/api/phonetic-learning/stats`
 * - Uses React state for collapse/expand
 * - Lazy loads data only when expanded
 * - Auto-refreshes when game submits an answer
 *
 * @see app/api/phonetic-learning/stats/route.ts
 * @see hooks/use-phonetic-learning.ts
 */

"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon, RefreshIcon, XIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"

// =============================================================================
// TYPES (matching API response)
// =============================================================================

interface PhoneticMappingStat {
  id: string
  heard: string
  intended: string
  source: "auto_learned" | "manual" | "support_added"
  confidence: number
  occurrenceCount: number
  timesApplied: number
  createdAt: string
  updatedAt: string
}

interface RecognitionLogEntry {
  id: string
  wordToSpell: string
  googleTranscript: string
  extractedLetters: string
  wasCorrect: boolean
  rejectionReason: string | null
  createdAt: string
}

interface AggregateStats {
  totalMappings: number
  autoLearnedCount: number
  manualCount: number
  avgConfidence: number
  totalLogsLast30Days: number
  successRate: number
  mostUsedMapping: { heard: string; intended: string; timesApplied: number } | null
}

interface StatsResponse {
  success: true
  userId: string
  stats: AggregateStats
  mappings: PhoneticMappingStat[]
  recentLogs: RecognitionLogEntry[]
}

interface ErrorResponse {
  success: false
  error: string
}

type ApiResponse = StatsResponse | ErrorResponse

// =============================================================================
// COMPONENT
// =============================================================================

interface PhoneticDebugPanelProps {
  /** User ID to fetch stats for */
  userId: string | null
  /** Additional className for positioning */
  className?: string
  /** Trigger refresh externally (e.g., after answer submission) */
  refreshTrigger?: number
}

/**
 * PhoneticDebugPanel — Collapsible panel for phonetic learning observability.
 *
 * Only renders in development mode.
 */
export function PhoneticDebugPanel({
  userId,
  className,
  refreshTrigger,
}: PhoneticDebugPanelProps) {
  // Only render in development
  if (process.env.NODE_ENV !== "development") {
    return null
  }

  return <PhoneticDebugPanelInner userId={userId} className={className} refreshTrigger={refreshTrigger} />
}

/**
 * Inner component (avoids hook rules issues with early return).
 */
function PhoneticDebugPanelInner({
  userId,
  className,
  refreshTrigger,
}: PhoneticDebugPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<StatsResponse | null>(null)
  const [activeTab, setActiveTab] = React.useState<"mappings" | "logs">("mappings")

  // Fetch stats when expanded and userId is available
  const fetchStats = React.useCallback(async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/phonetic-learning/stats?userId=${encodeURIComponent(userId)}&logsLimit=20`
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result: ApiResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch stats")
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Fetch when expanded or refresh trigger changes
  React.useEffect(() => {
    if (isExpanded && userId) {
      fetchStats()
    }
  }, [isExpanded, userId, refreshTrigger, fetchStats])

  const handleToggle = () => {
    setIsExpanded((prev) => !prev)
  }

  const handleRefresh = () => {
    fetchStats()
  }

  // Format relative time
  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Confidence badge color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "bg-green-500/20 text-green-400"
    if (confidence >= 0.7) return "bg-yellow-500/20 text-yellow-400"
    return "bg-red-500/20 text-red-400"
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-96 rounded-lg border border-border bg-card shadow-lg",
        className
      )}
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Phonetic Debug
          </span>
          {data && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
              {data.stats.totalMappings} mappings
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        ) : (
          <ChevronUpIcon className="size-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Actions Bar */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("mappings")}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                  activeTab === "mappings"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Mappings
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                  activeTab === "logs"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Logs
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshIcon className={cn("size-4", isLoading && "animate-spin")} />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {!userId ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No user ID available
              </div>
            ) : isLoading && !data ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : error ? (
              <div className="p-4 text-center text-sm text-red-400">
                Error: {error}
              </div>
            ) : data ? (
              <>
                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-2 border-b border-border p-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">
                      {data.stats.totalMappings}
                    </div>
                    <div className="text-xs text-muted-foreground">Mappings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">
                      {Math.round(data.stats.successRate * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Success</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">
                      {data.stats.totalLogsLast30Days}
                    </div>
                    <div className="text-xs text-muted-foreground">Logs (30d)</div>
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === "mappings" ? (
                  <div className="divide-y divide-border">
                    {data.mappings.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No mappings learned yet
                      </div>
                    ) : (
                      data.mappings.map((mapping) => (
                        <div
                          key={mapping.id}
                          className="flex items-center justify-between px-4 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {mapping.heard}
                            </code>
                            <span className="text-muted-foreground">→</span>
                            <code className="rounded bg-primary/20 px-1.5 py-0.5 text-xs font-bold text-primary">
                              {mapping.intended.toUpperCase()}
                            </code>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-xs",
                                getConfidenceColor(mapping.confidence)
                              )}
                            >
                              {Math.round(mapping.confidence * 100)}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ×{mapping.timesApplied}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {data.recentLogs.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No recognition logs yet
                      </div>
                    ) : (
                      data.recentLogs.map((log) => (
                        <div key={log.id} className="px-4 py-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">
                              {log.wordToSpell}
                            </span>
                            <div className="flex items-center gap-2">
                              {log.wasCorrect ? (
                                <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-400">
                                  ✓
                                </span>
                              ) : (
                                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                                  ✗
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(log.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Heard:</span>
                            <code className="rounded bg-muted px-1 text-muted-foreground">
                              {log.googleTranscript}
                            </code>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Got:</span>
                            <code className="rounded bg-muted px-1">
                              {log.extractedLetters}
                            </code>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
