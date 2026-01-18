/**
 * R2 Upload Utility
 *
 * Uploads audio files to Cloudflare R2 using the S3-compatible API.
 * Used by the seed script to store pronunciation audio files.
 *
 * ## Setup
 * 1. Create an R2 API token in Cloudflare Dashboard:
 *    - Go to R2 > Overview > Manage R2 API Tokens
 *    - Create a token with "Object Read & Write" permissions
 *    - Note the Access Key ID and Secret Access Key
 *
 * 2. Set environment variables:
 *    - R2_ACCOUNT_ID: Your Cloudflare account ID
 *    - R2_ACCESS_KEY_ID: The API token's access key
 *    - R2_SECRET_ACCESS_KEY: The API token's secret key
 *    - R2_BUCKET_NAME: The bucket name (playlexi-assets)
 *
 * ## Alternative: Using Wrangler for Local Development
 * For local development, you can use `wrangler r2 object put` instead.
 * This utility is designed for programmatic seeding in CI/CD or build scripts.
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"

// Environment variables
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.R2_BUCKET_NAME || "playlexi-assets"

let s3Client: S3Client | null = null

/**
 * Get or create the S3 client for R2.
 */
function getClient(): S3Client {
  if (s3Client) return s3Client

  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error(
      "Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.\n" +
        "See scripts/lib/r2-upload.ts for setup instructions."
    )
  }

  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  })

  return s3Client
}

/**
 * Upload a file to R2.
 *
 * @param key - The object key (path) in the bucket, e.g., "audio/cat.mp3"
 * @param body - The file content as a Buffer
 * @param contentType - The MIME type, e.g., "audio/mpeg"
 * @returns The public URL of the uploaded file
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getClient()

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  })

  await client.send(command)

  // Return the R2 public URL
  // Note: You need to enable public access on the bucket or use a custom domain
  // For now, return a path that can be resolved by the application
  return `r2://${BUCKET_NAME}/${key}`
}

/**
 * Check if a file exists in R2.
 *
 * @param key - The object key to check
 * @returns true if the object exists, false otherwise
 */
export async function existsInR2(key: string): Promise<boolean> {
  const client = getClient()

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
    await client.send(command)
    return true
  } catch (error) {
    // NotFound error means the object doesn't exist
    if ((error as { name?: string }).name === "NotFound") {
      return false
    }
    throw error
  }
}

/**
 * Generate the R2 key for an audio file.
 *
 * @param word - The word (used for the filename)
 * @returns The R2 key, e.g., "audio/pronunciations/cat.mp3"
 */
export function getAudioKey(word: string): string {
  // Sanitize the word for use as a filename
  const sanitized = word.toLowerCase().replace(/[^a-z0-9]/g, "_")
  return `audio/pronunciations/${sanitized}.mp3`
}

/**
 * Get the public URL for an R2 object.
 *
 * In production, this would use a custom domain or Cloudflare's R2 public URL.
 * For now, we return a relative path that the application can resolve.
 *
 * @param key - The R2 object key
 * @returns The URL to access the object
 */
export function getPublicUrl(key: string): string {
  // Option 1: Use R2's public bucket URL (if enabled)
  // return `https://pub-{account-id}.r2.dev/${key}`

  // Option 2: Use a custom domain pointed at R2
  // return `https://assets.playlexi.com/${key}`

  // Option 3: Serve through a Cloudflare Worker/Pages function
  // This is the recommended approach for access control
  return `/api/assets/${key}`
}

/**
 * Upload audio for a word and return the public URL.
 *
 * @param word - The word
 * @param audioBuffer - The audio file content
 * @returns The public URL of the uploaded audio
 */
export async function uploadWordAudio(
  word: string,
  audioBuffer: Buffer
): Promise<string> {
  const key = getAudioKey(word)
  await uploadToR2(key, audioBuffer, "audio/mpeg")
  return getPublicUrl(key)
}

/**
 * Check if R2 credentials are configured.
 */
export function isR2Configured(): boolean {
  return !!(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY)
}
