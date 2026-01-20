/**
 * Login Page Navbar — Client Component
 *
 * Wrapper for Navbar that handles the onSignUp callback.
 * Separated to keep the main login page as a server component.
 */

"use client"

import { Logo } from "@/components/ui/logo"
import { Navbar } from "@/components/ui/navbar"

export function LoginNavbar() {
  return (
    <Navbar
      logo={<Logo />}
      navLinks={[
        { label: "Play", href: "/play", active: true },
        { label: "Leaderboard", href: "/leaderboard" },
        { label: "Learn", href: "/learn", badge: "PRO" },
      ]}
      isLoggedIn={false}
      onSignUp={() => {
        // Already on login page - scroll to sign-in buttons
        const signInSection = document.querySelector("[data-slot='sign-in-buttons']")
        signInSection?.scrollIntoView({ behavior: "smooth" })
      }}
    />
  )
}
