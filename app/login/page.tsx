/**
 * Login Page — DEPRECATED
 *
 * The standalone login page has been replaced by the SignInDialog modal
 * on the dashboard. This route redirects to / for backwards compatibility
 * (bookmarks, shared links, etc.).
 *
 * The middleware also redirects /login → / before this page renders,
 * so this server-side redirect is a safety net only.
 *
 * @see components/auth/sign-in-dialog.tsx for the current sign-in UI
 * @see middleware.ts for the primary /login → / redirect
 */

import { redirect } from "next/navigation"

export default function LoginPage() {
  redirect("/")
}
