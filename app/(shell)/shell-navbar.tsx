/**
 * Shell Navbar — PlayLexi
 *
 * Session-aware navigation bar for the main application shell.
 * Displays the full navigation with Play/Leaderboard/Learn links,
 * notifications, and user account menu.
 *
 * ## Why Client Component?
 *
 * This component requires client-side interactivity for:
 * - useSession hook (auth state)
 * - usePlayLexiUser hook (user profile data)
 * - usePathname hook (active link detection)
 * - Event handlers (sign out, navigation)
 * - Mobile menu state
 *
 * ## Data Flow
 *
 * 1. useSession — Gets Better Auth session (email, Google name)
 * 2. usePlayLexiUser — Gets PlayLexi profile (username, avatarId)
 * 3. Combines both for complete user display
 *
 * @see hooks/use-playlexi-user.ts for PlayLexi user fetching
 */

"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession, signOut } from "@/lib/auth/client"
import { usePlayLexiUser } from "@/hooks/use-playlexi-user"
import { Logo } from "@/components/ui/logo"
import { Navbar } from "@/components/ui/navbar"
import { AccountSettingsDialog } from "@/components/settings/account-settings-dialog"
import { SignInDialog } from "@/components/auth/sign-in-dialog"

export function ShellNavbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending: isSessionPending } = useSession()
  const { user: playLexiUser, isLoading: isUserLoading, refetch: refetchUser } = usePlayLexiUser()
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [signInOpen, setSignInOpen] = React.useState(false)

  // Navigation links with active state based on current path
  const navLinks = [
    {
      label: "Play",
      href: "/",
      active: pathname === "/" || pathname.startsWith("/game"),
    },
    {
      label: "Leaderboard",
      href: "/leaderboard",
      active: pathname === "/leaderboard",
    },
    {
      label: "Learn",
      href: "/learn",
      badge: "PRO" as const,
      active: pathname === "/learn",
    },
  ]

  // Transform session + PlayLexi user to Navbar's user prop shape
  // Prefer PlayLexi username over Google name
  const user = session?.user
    ? {
        // Use PlayLexi username if available, fall back to Google name
        name: playLexiUser?.username || session.user.name || "User",
        email: session.user.email || "",
        // Use PlayLexi avatarId if available, fall back to Google profile image
        avatarId: playLexiUser?.avatarId,
        avatarUrl: playLexiUser?.avatarId ? undefined : (session.user.image || undefined),
        initials: (playLexiUser?.username || session.user.name || "?")
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
      }
    : undefined

  // Auto-open sign-in dialog when returning from tutorial with ?signIn=true
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("signIn") === "true") {
      setSignInOpen(true)
      // Clean up URL so the param doesn't persist on refresh
      window.history.replaceState({}, "", "/")
    }
  }, [])

  // Event handlers
  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  const handleSignIn = () => {
    setSignInOpen(true)
  }

  const handleNotificationClick = () => {
    // TODO: Open notifications panel
    console.log("[ShellNavbar] Notifications clicked")
  }

  const handleProfileClick = () => {
    router.push("/profile")
  }

  const handleSettingsClick = () => {
    setSettingsOpen(true)
  }

  // Loading state: show skeleton to prevent layout shift
  // Only wait for user loading if a session exists (anonymous users resolve immediately)
  if (isSessionPending || (!!session && isUserLoading)) {
    return (
      <nav className="relative flex h-16 w-full items-center justify-between border-b bg-background px-4 shadow-sm md:px-6">
        <div className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between">
          <Logo />
          <div className="h-9 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      </nav>
    )
  }

  return (
    <>
      <Navbar
        logo={<Logo />}
        navLinks={navLinks}
        isLoggedIn={!!session}
        user={user}
        notificationCount={0}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onNotificationClick={handleNotificationClick}
        onProfileClick={handleProfileClick}
        onSettingsClick={handleSettingsClick}
      />
      <AccountSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaveSuccess={refetchUser}
      />
      <SignInDialog
        open={signInOpen}
        onOpenChange={setSignInOpen}
      />
    </>
  )
}
