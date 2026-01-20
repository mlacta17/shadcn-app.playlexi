/**
 * Login Page — PlayLexi
 *
 * Sign-in page with OAuth providers.
 * Full-page layout with navbar, centered card, and footer.
 *
 * ## OAuth Providers
 * - Google: Enabled (configured in lib/auth/index.ts)
 * - Apple: Coming soon (requires Apple Developer setup)
 *
 * @see Figma: Playlexi.com > Login (node-id=2683-12521)
 */

import { UserIcon } from "@/lib/icons"
import { Logo } from "@/components/ui/logo"
import { GoogleSignInButton } from "@/components/auth"
import { LoginNavbar } from "./login-navbar"

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navbar - Client component wrapper to handle onSignUp */}
      <LoginNavbar />

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-6">
        {/* Login Card */}
        <div className="w-full max-w-[394px] rounded-3xl border border-border bg-card px-6 py-10">
          {/* User Icon */}
          <div className="flex justify-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-secondary p-3">
              <div className="flex size-full items-center justify-center rounded-full border border-border bg-background">
                <UserIcon className="size-7 text-foreground" />
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div className="mt-6 space-y-2 text-center">
            <h1 className="text-2xl font-bold text-card-foreground">
              Sign into your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Log in to unlock tailored content and stay connected with your community.
            </p>
          </div>

          {/* Sign-in Buttons */}
          <div data-slot="sign-in-buttons" className="mt-6 space-y-2">
            {/*
              OAuth callback goes to dashboard (/).

              TODO: When onboarding is fully built, add logic to:
              1. Check if user has completed profile setup
              2. If not, redirect to /onboarding/tutorial

              This can be done via:
              - A `hasCompletedOnboarding` flag in the users table
              - Middleware check after OAuth callback
              - Or a server-side redirect in the dashboard page
            */}
            <GoogleSignInButton callbackURL="/">
              Sign in with Google
            </GoogleSignInButton>
            {/*
              Apple Sign-In: Coming soon
              Requires Apple Developer account setup:
              1. Create App ID with Sign in with Apple capability
              2. Create Services ID with domain verification
              3. Generate private key for client secret
              4. Add Apple provider to lib/auth/index.ts

              <AppleSignInButton callbackURL="/onboarding/tutorial">
                Sign in with Apple
              </AppleSignInButton>
            */}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex h-16 items-center justify-center border-t border-border bg-background px-6 shadow-sm">
        <p className="text-xs text-muted-foreground">
          All rights reserved © 2025 Spectrum
        </p>
      </footer>
    </div>
  )
}
