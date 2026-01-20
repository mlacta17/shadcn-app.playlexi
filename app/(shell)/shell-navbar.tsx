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
 * - usePathname hook (active link detection)
 * - Event handlers (sign out, navigation)
 * - Mobile menu state
 *
 * ## Session Handling
 *
 * Uses Better Auth's useSession hook. Shows a loading skeleton
 * while session loads to prevent flash of logged-out state.
 */

"use client"

import { useRouter, usePathname } from "next/navigation"
import { useSession, signOut } from "@/lib/auth/client"
import { Logo } from "@/components/ui/logo"
import { Navbar } from "@/components/ui/navbar"

export function ShellNavbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = useSession()

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

  // Transform session user to Navbar's user prop shape
  const user = session?.user
    ? {
        name: session.user.name || "User",
        email: session.user.email || "",
        avatarUrl: session.user.image || undefined,
        initials: session.user.name
          ? session.user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          : "?",
      }
    : undefined

  // Event handlers
  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const handleSignUp = () => {
    router.push("/login")
  }

  const handleNotificationClick = () => {
    // TODO: Open notifications panel
    console.log("[ShellNavbar] Notifications clicked")
  }

  const handleProfileClick = () => {
    router.push("/profile")
  }

  const handleSettingsClick = () => {
    router.push("/settings")
  }

  // Loading state: show skeleton to prevent layout shift
  if (isPending) {
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
    <Navbar
      logo={<Logo />}
      navLinks={navLinks}
      isLoggedIn={!!session}
      user={user}
      notificationCount={0}
      onSignUp={handleSignUp}
      onSignOut={handleSignOut}
      onNotificationClick={handleNotificationClick}
      onProfileClick={handleProfileClick}
      onSettingsClick={handleSettingsClick}
    />
  )
}
