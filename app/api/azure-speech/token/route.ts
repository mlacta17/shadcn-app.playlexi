/**
 * Azure Speech Services Token API Route
 *
 * This route provides short-lived authentication tokens for the client-side
 * Azure Speech SDK. Tokens are valid for 10 minutes.
 *
 * ## Why a Server-Side Route?
 * Azure Speech Services requires either:
 * 1. Subscription key (MUST NOT be exposed client-side)
 * 2. Auth token (short-lived, safe for client)
 *
 * This route securely exchanges our subscription key for a temporary token
 * that the client can use without exposing secrets.
 *
 * ## Security
 * - Subscription key stays server-side only
 * - Tokens expire after 10 minutes
 * - Client must request fresh token for each session
 *
 * ## Usage
 * ```ts
 * const response = await fetch('/api/azure-speech/token')
 * const { token, region } = await response.json()
 * ```
 *
 * @see https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text
 */

import { NextResponse } from "next/server"

// =============================================================================
// TYPES
// =============================================================================

interface TokenResponse {
  token: string
  region: string
  expiresIn: number
}

interface ErrorResponse {
  error: string
  details?: string
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Azure Speech Services configuration.
 * These values come from your Azure Portal Speech resource.
 */
function getAzureConfig() {
  const subscriptionKey = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION

  return { subscriptionKey, region }
}

// =============================================================================
// TOKEN ENDPOINT
// =============================================================================

/**
 * GET /api/azure-speech/token
 *
 * Exchanges the server-side subscription key for a client-safe auth token.
 *
 * @returns TokenResponse with token, region, and expiration
 */
export async function GET(): Promise<NextResponse<TokenResponse | ErrorResponse>> {
  const { subscriptionKey, region } = getAzureConfig()

  // Validate configuration
  if (!subscriptionKey || !region) {
    console.error("[Azure Token] Missing configuration:", {
      hasKey: !!subscriptionKey,
      hasRegion: !!region,
    })
    return NextResponse.json(
      {
        error: "Azure Speech Services not configured",
        details: "Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in environment variables",
      },
      { status: 503 }
    )
  }

  try {
    // Request token from Azure
    // Endpoint: https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken
    const tokenUrl = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Azure Token] Failed to get token:", {
        status: response.status,
        error: errorText,
      })
      return NextResponse.json(
        {
          error: "Failed to get Azure token",
          details: `Azure returned ${response.status}: ${errorText}`,
        },
        { status: 502 }
      )
    }

    // Token is returned as plain text
    const token = await response.text()

    // Token is valid for 10 minutes (600 seconds)
    const expiresIn = 600

    if (process.env.NODE_ENV === "development") {
      console.log("[Azure Token] Token issued successfully, expires in", expiresIn, "seconds")
    }

    return NextResponse.json({
      token,
      region,
      expiresIn,
    })
  } catch (error) {
    console.error("[Azure Token] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
