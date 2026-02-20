/**
 * useMediaQuery — PlayLexi
 *
 * Reactive hook that tracks a CSS media query match.
 * Returns `true` when the query matches, `false` otherwise.
 *
 * Defaults to `false` during SSR (no `window`), then hydrates on mount.
 *
 * @example
 * ```tsx
 * const isDesktop = useMediaQuery("(min-width: 768px)")
 * ```
 */

import * as React from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])

  return matches
}
