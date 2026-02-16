"use client"

import * as React from "react"
import Link from "next/link"
import {
  BellIcon,
  MenuIcon,
  XIcon,
  CircleUserIcon as UserIcon,
  SettingsIcon,
  LogOutIcon,
} from "@/lib/icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { PlayerAvatar } from "@/components/ui/player-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

/* -------------------------------------------------------------------------------------------------
 * NavLink - Shared navigation link component for desktop and mobile
 * Renders as <Link> when href is provided, <button> otherwise
 * -----------------------------------------------------------------------------------------------*/

interface NavLinkProps {
  /** If provided, renders as Next.js Link. Otherwise renders as button. */
  href?: string
  active?: boolean
  badge?: string
  /** Size variant: "sm" for desktop, "base" for mobile */
  size?: "sm" | "base"
  onClick?: () => void
  children: React.ReactNode
}

function NavLink({ href, active, badge, size = "sm", onClick, children }: NavLinkProps) {
  const className = cn(
    "flex items-center gap-1.5 rounded-lg px-3 font-medium transition-colors",
    size === "sm" ? "py-2.5 text-sm" : "py-2 text-base",
    !href && "text-left w-full",
    active
      ? "bg-accent text-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"
  )

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className}>
        {children}
        {badge && <Badge className="text-xs px-2 py-0.5">{badge}</Badge>}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Navbar
 * -----------------------------------------------------------------------------------------------*/

export interface NavbarProps {
  /** Logo element or image URL */
  logo?: React.ReactNode
  /** Navigation links configuration */
  navLinks?: {
    label: string
    href: string
    active?: boolean
    badge?: string
  }[]
  /** Whether user is logged in */
  isLoggedIn?: boolean
  /** User info for logged in state */
  user?: {
    name: string
    email: string
    avatarUrl?: string
    initials?: string
    /** PlayLexi avatar ID (1=dog, 2=person, 3=cat) */
    avatarId?: number
  }
  /** Notification count */
  notificationCount?: number
  /** Callback when sign in is clicked (anonymous users) */
  onSignIn?: () => void
  /** Callback when sign out is clicked */
  onSignOut?: () => void
  /** Callback when notification bell is clicked */
  onNotificationClick?: () => void
  /** Callback when profile is clicked */
  onProfileClick?: () => void
  /** Callback when settings is clicked */
  onSettingsClick?: () => void
  /** Additional class names */
  className?: string
}

/**
 * Full-featured responsive navigation bar.
 *
 * Features:
 * - Responsive: Desktop shows full nav, mobile shows hamburger menu
 * - Nav links with active state and optional badges
 * - Notification bell with count badge
 * - User dropdown (logged in) or sign up button (logged out)
 *
 * @example
 * ```tsx
 * // Logged out state
 * <Navbar
 *   logo={<img src="/logo.svg" />}
 *   onSignIn={() => openSignInModal()}
 * />
 *
 * // Logged in state
 * <Navbar
 *   isLoggedIn={true}
 *   user={{ name: "John", email: "john@example.com" }}
 *   notificationCount={3}
 *   onSignOut={() => signOut()}
 * />
 * ```
 *
 * @see {@link TopNavbar} for minimal wizard-flow navigation
 */
function Navbar({
  logo,
  navLinks = [
    { label: "Play", href: "/play", active: true },
    { label: "Leaderboard", href: "/leaderboard" },
    { label: "Learn", href: "/learn", badge: "PRO" },
  ],
  isLoggedIn = false,
  user,
  notificationCount = 0,
  onSignIn,
  onSignOut,
  onNotificationClick,
  onProfileClick,
  onSettingsClick,
  className,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  return (
    <nav
      data-slot="navbar"
      className={cn(
        "relative bg-background border-b shadow-sm flex h-16 w-full items-center justify-between px-4 md:px-6",
        className
      )}
    >
      <div className="flex h-full w-full max-w-[1280px] items-center justify-between mx-auto">
        {/* Mobile: Menu button */}
        <Button
          variant={mobileMenuOpen ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <XIcon className="size-5" />
          ) : (
            <MenuIcon className="size-5" />
          )}
        </Button>

        {/* Desktop: Logo + Nav */}
        <div className="flex flex-1 items-center gap-6">
          {/* Logo - centered on mobile, left on desktop */}
          <div className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
            {logo || (
              <div className="size-9 rounded-lg bg-foreground flex items-center justify-center text-background font-bold text-sm">
                L
              </div>
            )}
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                active={link.active}
                badge={link.badge}
                size="sm"
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Right side: Notifications + Account */}
        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onNotificationClick}
              aria-label="Notifications"
            >
              <BellIcon />
            </Button>
            {notificationCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 h-5 min-w-5 px-1.5 text-xs"
              >
                {notificationCount}
              </Badge>
            )}
          </div>

          {/* Account Section */}
          {isLoggedIn && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden md:block rounded-full">
                  <PlayerAvatar
                    avatarId={user.avatarId}
                    avatarUrl={user.avatarUrl}
                    fallbackInitials={user.initials || user.name.slice(0, 2).toUpperCase()}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onProfileClick}>
                  <UserIcon className="text-muted-foreground" />
                  My profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSettingsClick}>
                  <SettingsIcon className="text-muted-foreground" />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  <LogOutIcon className="text-muted-foreground" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={onSignIn} size="sm" className="hidden md:flex">
              Sign in
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full z-40 bg-background shadow-lg md:hidden">
          {/* Nav Links */}
          <div className="flex flex-col p-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                active={link.active}
                badge={link.badge}
                size="base"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <Separator />

          {/* Account Section */}
          <div className="flex flex-col p-2">
            {isLoggedIn && user ? (
              <>
                {/* User Info */}
                <div className="flex items-center gap-3 p-2">
                  <PlayerAvatar
                    avatarId={user.avatarId}
                    avatarUrl={user.avatarUrl}
                    fallbackInitials={user.initials || user.name.slice(0, 2).toUpperCase()}
                  />
                  <div className="flex flex-col">
                    <span className="text-base font-medium text-foreground">{user.name}</span>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                  </div>
                </div>
                {/* Account Links */}
                <NavLink size="base" onClick={() => { onProfileClick?.(); setMobileMenuOpen(false) }}>
                  My profile
                </NavLink>
                <NavLink size="base" onClick={() => { onSettingsClick?.(); setMobileMenuOpen(false) }}>
                  Account settings
                </NavLink>
                <NavLink size="base" onClick={() => { onSignOut?.(); setMobileMenuOpen(false) }}>
                  Sign out
                </NavLink>
              </>
            ) : (
              <Button onClick={onSignIn} className="w-full">
                Sign in
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

export { Navbar }
