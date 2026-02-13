/**
 * Shell Layout — PlayLexi
 *
 * Layout for pages that use the full application navigation shell.
 * Renders the main Navbar with logo, nav links, and user menu.
 *
 * ## When to use (shell)
 *
 * Use this route group for pages where users need:
 * - Access to main navigation (Play, Leaderboard, Learn)
 * - User account menu (profile, settings, sign out)
 * - Notification bell
 *
 * Examples: Dashboard, Leaderboard, Profile, Settings
 *
 * ## When NOT to use (shell)
 *
 * Don't use for focused experiences where navigation would distract:
 * - Gameplay screens → use (focused)
 * - Onboarding flows → use (focused)
 * - Wizard-style multi-step forms → use (focused)
 *
 * ## Authentication
 *
 * All routes in (shell) require authentication.
 * Middleware redirects unauthenticated users to /login.
 *
 * @see app/(focused)/layout.tsx for focused experience layout
 * @see middleware.ts for route protection
 */

import { ShellNavbar } from "./shell-navbar"

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      <ShellNavbar />
      {children}
    </div>
  )
}
