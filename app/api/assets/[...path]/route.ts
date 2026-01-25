/**
 * Static Assets API — Serves audio files from Cloudflare R2.
 *
 * GET /api/assets/audio/tts/intros/castle.mp3
 * GET /api/assets/audio/tts/sentences/castle.mp3
 * GET /api/assets/audio/tts/definitions/castle.mp3
 * GET /api/assets/audio/pronunciations/castle.mp3
 *
 * This route serves pre-generated audio files stored in Cloudflare R2.
 * Files are cached aggressively (1 year) since they're immutable once generated.
 *
 * ## Why R2?
 *
 * - Zero egress fees (unlike S3)
 * - Edge-cached globally via Cloudflare CDN
 * - "Generate once, serve forever" architecture
 *
 * ## Cache Strategy
 *
 * Audio files are immutable (same word = same audio), so we use aggressive caching:
 * - Cache-Control: public, max-age=31536000, immutable (1 year)
 * - This reduces R2 reads and improves latency
 *
 * ## Local Development
 *
 * In local dev, the R2 binding points to an empty local emulator.
 * We fall back to fetching directly from remote R2 via S3 API when:
 * - R2 binding returns null (file not in local emulator)
 * - R2_ACCOUNT_ID env var is configured
 *
 * ## Error Handling
 *
 * - 404: File not found in R2 (word not yet generated)
 * - 500: R2 connection error
 *
 * @see scripts/generate-tts.ts - Generates and uploads TTS audio
 * @see scripts/lib/r2-upload.ts - R2 upload utilities
 * @see ADR-015 (OpenAI TTS for Realistic Voice Output)
 */

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

// =============================================================================
// CLOUDFLARE ENV AUGMENTATION
// =============================================================================

declare global {
  interface CloudflareEnv {
    R2_ASSETS: R2Bucket
  }
}

// =============================================================================
// CONTENT TYPE MAPPING
// =============================================================================

/**
 * Map file extensions to MIME types.
 * Focused on audio files but includes common web assets.
 */
const CONTENT_TYPES: Record<string, string> = {
  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm",

  // Images (in case we add word images later)
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",

  // Other
  ".json": "application/json",
  ".txt": "text/plain",
}

/**
 * Get MIME type from file path.
 * Defaults to audio/mpeg for unknown extensions (most assets are MP3).
 */
function getContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase()
  return CONTENT_TYPES[ext] || "audio/mpeg"
}

// =============================================================================
// S3 CLIENT FOR LOCAL DEVELOPMENT FALLBACK
// =============================================================================

let s3Client: S3Client | null = null

/**
 * Get S3 client for fetching from remote R2 (local dev fallback).
 * Returns null if R2 credentials are not configured.
 */
function getS3Client(): S3Client | null {
  if (s3Client) return s3Client

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null
  }

  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })

  return s3Client
}

/**
 * Fetch object from remote R2 via S3 API (local dev fallback).
 */
async function fetchFromRemoteR2(
  key: string
): Promise<{ body: ArrayBuffer; contentType: string; size: number } | null> {
  const client = getS3Client()
  if (!client) return null

  const bucketName = process.env.R2_BUCKET_NAME || "playlexi-assets"

  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
    const response = await client.send(command)

    if (!response.Body) return null

    // Convert stream to ArrayBuffer
    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    const body = new Uint8Array(
      chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    )
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.length
    }

    return {
      body: body.buffer as ArrayBuffer,
      contentType: response.ContentType || getContentType(key),
      size: response.ContentLength || body.length,
    }
  } catch (error) {
    // NotFound or other errors
    console.log(`[Assets API] Remote R2 fetch failed for ${key}:`, error)
    return null
  }
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * GET /api/assets/[...path]
 *
 * Serves files from Cloudflare R2 storage.
 * Uses aggressive caching since audio files are immutable.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  try {
    // Await params (Next.js 15+ async params)
    const { path: pathSegments } = await params

    // Reconstruct the full path from segments
    const key = pathSegments.join("/")

    // Validate path to prevent directory traversal
    if (key.includes("..") || key.startsWith("/")) {
      return new NextResponse("Invalid path", { status: 400 })
    }

    // Get R2 binding from Cloudflare context
    const { env } = await getCloudflareContext({ async: true })

    let body: ArrayBuffer
    let contentType: string
    let size: number
    let etag: string | undefined

    // Try R2 binding first (production + local with populated emulator)
    if (env.R2_ASSETS) {
      const object = await env.R2_ASSETS.get(key)

      if (object) {
        contentType = object.httpMetadata?.contentType || getContentType(key)
        body = await object.arrayBuffer()
        size = object.size
        etag = object.httpEtag
      } else {
        // R2 binding exists but file not found - try remote fallback for local dev
        const remoteResult = await fetchFromRemoteR2(key)
        if (!remoteResult) {
          console.log(`[Assets API] Not found: ${key}`)
          return new NextResponse("Not found", { status: 404 })
        }
        body = remoteResult.body
        contentType = remoteResult.contentType
        size = remoteResult.size
      }
    } else {
      // No R2 binding - try remote R2 via S3 API (local dev without binding)
      const remoteResult = await fetchFromRemoteR2(key)
      if (!remoteResult) {
        console.error("[Assets API] R2_ASSETS binding not available and remote fetch failed")
        return new NextResponse("Storage not configured", { status: 503 })
      }
      body = remoteResult.body
      contentType = remoteResult.contentType
      size = remoteResult.size
    }

    // Build response headers
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": size.toString(),
      // Immutable cache: 1 year, never revalidate
      "Cache-Control": "public, max-age=31536000, immutable",
      // CORS: Allow any origin (audio needs to be playable)
      "Access-Control-Allow-Origin": "*",
    }

    // Add ETag if available (only from R2 binding)
    if (etag) {
      headers["ETag"] = etag
    }

    // Return with aggressive caching headers
    return new NextResponse(body, { status: 200, headers })
  } catch (error) {
    console.error("[Assets API] Error:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}

/**
 * OPTIONS handler for CORS preflight.
 * Required for audio playback from different origins.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400", // 24 hours
    },
  })
}
