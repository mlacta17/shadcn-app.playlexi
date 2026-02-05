"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { CircleWarningIcon } from "@/lib/icons"

/**
 * Props for the ErrorBoundary component.
 */
interface ErrorBoundaryProps {
  children: React.ReactNode
  /**
   * Optional custom fallback UI.
   * If not provided, uses the default error UI.
   */
  fallback?: React.ReactNode
  /**
   * Callback when an error is caught.
   * Use for error logging/reporting.
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /**
   * Context label for error logging (e.g., "GamePage", "Leaderboard").
   */
  context?: string
}

/**
 * State for the ErrorBoundary component.
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary component for graceful error handling.
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the app.
 *
 * ## When to Use
 *
 * Wrap sections of your app that could fail independently:
 * - Game pages (API failures, state errors)
 * - Data-fetching components
 * - Third-party integrations
 *
 * ## Usage
 *
 * ```tsx
 * // Basic usage
 * <ErrorBoundary context="GamePage">
 *   <EndlessGamePage />
 * </ErrorBoundary>
 *
 * // With custom fallback
 * <ErrorBoundary
 *   context="Leaderboard"
 *   fallback={<LeaderboardErrorFallback />}
 * >
 *   <LeaderboardContent />
 * </ErrorBoundary>
 *
 * // With error callback for logging
 * <ErrorBoundary
 *   context="GameSession"
 *   onError={(error, info) => {
 *     logToService(error, info)
 *   }}
 * >
 *   <GameSession />
 * </ErrorBoundary>
 * ```
 *
 * ## Important Notes
 *
 * Error boundaries do NOT catch:
 * - Event handler errors (use try/catch)
 * - Async errors (use promise .catch())
 * - Server-side rendering errors
 * - Errors in the error boundary itself
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error
    const context = this.props.context || "Unknown"
    console.error(`[ErrorBoundary:${context}] Caught error:`, error)
    console.error(`[ErrorBoundary:${context}] Component stack:`, errorInfo.componentStack)

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = (): void => {
    // Reset error state to attempt re-render
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Props for the default error fallback component.
 */
interface DefaultErrorFallbackProps {
  error: Error | null
  onRetry?: () => void
}

/**
 * Default error fallback UI.
 *
 * Shows a friendly error message with retry option.
 * Styled to match PlayLexi's design system.
 */
function DefaultErrorFallback({ error, onRetry }: DefaultErrorFallbackProps) {
  return (
    <div
      data-slot="error-fallback"
      className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-6 text-center"
    >
      {/* Error icon */}
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <CircleWarningIcon className="size-8 text-destructive" />
      </div>

      {/* Error message */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-card-foreground">
          Something went wrong
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          We hit an unexpected error. Please try again.
        </p>
      </div>

      {/* Error details (development only) */}
      {process.env.NODE_ENV === "development" && error && (
        <details className="max-w-md text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Technical details
          </summary>
          <pre className="mt-2 overflow-auto rounded-md bg-muted p-2 text-xs">
            {error.message}
          </pre>
        </details>
      )}

      {/* Retry button */}
      {onRetry && (
        <Button variant="default" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

/**
 * Functional wrapper for ErrorBoundary with hooks support.
 *
 * This allows using the error boundary in functional components
 * while still leveraging the class-based implementation required
 * by React's error boundary API.
 */
function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: Omit<ErrorBoundaryProps, "children"> = {}
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundary.displayName = `withErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`

  return WithErrorBoundary
}

export { ErrorBoundary, DefaultErrorFallback, withErrorBoundary }
export type { ErrorBoundaryProps, DefaultErrorFallbackProps }
