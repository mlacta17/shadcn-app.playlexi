/**
 * Login Page Navbar — Client Component
 *
 * Wrapper for Navbar that handles the onSignIn callback.
 * Separated to keep the main login page as a server component.
 *
 * The "Sign in" button on the login page navigates new users
 * to the onboarding tutorial flow.
 */

"use client"

import { useRouter } from "next/navigation"

import { Logo } from "@/components/ui/logo"
import { Navbar } from "@/components/ui/navbar"

export function LoginNavbar() {
  const router = useRouter()

  return (
    <Navbar
      logo={<Logo />}
      navLinks={[
        { label: "Play", href: "/play", active: true },
        { label: "Leaderboard", href: "/leaderboard" },
        { label: "Learn", href: "/learn", badge: "PRO" },
      ]}
      isLoggedIn={false}
      onSignIn={() => {
        // Navigate new users to onboarding tutorial
        router.push("/onboarding/tutorial")
      }}
    />
  )
}
