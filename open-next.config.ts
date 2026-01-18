/**
 * OpenNext Configuration for Cloudflare
 *
 * This file configures how Next.js is adapted for Cloudflare's platform.
 * OpenNext replaces @cloudflare/next-on-pages for Next.js 16+ support.
 *
 * @see https://opennext.js.org/cloudflare
 */

import { defineCloudflareConfig } from "@opennextjs/cloudflare"

export default defineCloudflareConfig({
  // Use default configuration
  // R2 incremental cache can be enabled if needed:
  // incrementalCache: r2IncrementalCache,
})
