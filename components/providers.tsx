"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

interface ProvidersProps {
  children: React.ReactNode
}

/**
 * Client-side providers wrapper.
 *
 * ThemeProvider must be a client component for next-themes to work.
 * Add other client-side providers here as needed.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
