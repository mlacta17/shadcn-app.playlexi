/**
 * Focused Layout — PlayLexi
 *
 * Layout for focused experiences that need minimal navigation.
 * Pages in this group render their own TopNavbar with contextual controls.
 *
 * ## When to use (focused)
 *
 * Use this route group for immersive experiences where the full
 * navigation shell would be distracting:
 *
 * - **Gameplay**: Game screens need focus, not nav links
 * - **Onboarding**: Step-by-step flows with their own progress
 * - **Wizards**: Multi-step forms (settings setup, profile creation)
 * - **Modals/Full-screen**: Content that needs user's full attention
 *
 * ## Navigation Pattern
 *
 * Pages in (focused) typically use TopNavbar with:
 * - Close button (X) on the left → exits the flow
 * - Center content → context (e.g., "Game mode: Endless")
 * - Optional skip link on the right
 *
 * Each page renders its own TopNavbar because the content and
 * handlers vary (game mode, step number, skip destination).
 *
 * ## Error Handling
 *
 * This layout includes an Error Boundary that catches React errors
 * in child components. If a page crashes, users see a friendly error
 * message instead of a white screen.
 *
 * ## Why This Layout is Minimal
 *
 * This layout just wraps children with error handling. It doesn't add any
 * navigation because:
 *
 * 1. Pages have different TopNavbar configurations
 * 2. Some pages may not want TopNavbar at all
 * 3. Keeping nav in pages makes the code more explicit
 *
 * ## Authentication
 *
 * Most routes in (focused) require authentication, but onboarding
 * pages before OAuth (tutorial, placement, rank-result) are public.
 * See middleware.ts for the full routing logic.
 *
 * @see app/(shell)/layout.tsx for full navigation shell
 * @see components/ui/top-navbar.tsx for TopNavbar component
 * @see components/ui/error-boundary.tsx for error handling
 * @see middleware.ts for route protection
 */

import { ErrorBoundary } from "@/components/ui/error-boundary"

export default function FocusedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Wrap children with Error Boundary for graceful error handling
  // Pages still own their navigation
  return <ErrorBoundary context="FocusedLayout">{children}</ErrorBoundary>
}
