/**
 * User Menu — PlayLexi
 *
 * Displays the current user's avatar with a dropdown menu for account actions.
 * Shows sign-in button if not authenticated.
 *
 * @example
 * ```tsx
 * // In a navbar
 * <UserMenu />
 * ```
 */

"use client"

import * as React from "react"
import { useSession, signOut } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GoogleSignInButton } from "./google-sign-in-button"
import { AccountSettingsDialog } from "@/components/settings/account-settings-dialog"

// =============================================================================
// ICONS
// =============================================================================

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// =============================================================================
// USER MENU
// =============================================================================

interface UserMenuProps {
  /** Show compact version (just avatar) */
  compact?: boolean
}

/**
 * User Menu Component.
 *
 * Shows either:
 * - A sign-in button if not authenticated
 * - User avatar with dropdown menu if authenticated
 */
export function UserMenu({ compact = false }: UserMenuProps) {
  const { data: session, isPending } = useSession()
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  // Loading state
  if (isPending) {
    return (
      <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
    )
  }

  // Not signed in
  if (!session) {
    if (compact) {
      return (
        <Button variant="outline" size="sm" asChild>
          <a href="/">Sign In</a>
        </Button>
      )
    }
    return <GoogleSignInButton callbackURL="/" />
  }

  // Signed in - show user menu
  const user = session.user
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-9 w-9">
              {user.image && <AvatarImage src={user.image} alt={user.name || "User"} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/profile" className="cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setSettingsOpen(true)}
            className="cursor-pointer"
          >
            <SettingsIcon className="mr-2 h-4 w-4" />
            <span>Account Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut()}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOutIcon className="mr-2 h-4 w-4" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Account Settings Dialog */}
      <AccountSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  )
}
