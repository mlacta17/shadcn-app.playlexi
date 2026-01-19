import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * Initialize OpenNext Cloudflare bindings for local development.
 *
 * This enables `npm run dev` to access Cloudflare bindings (D1, R2, etc.)
 * using the same local database that wrangler CLI commands use.
 *
 * The local D1 database is stored at:
 *   .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite
 *
 * The <hash> is derived from the database_id in wrangler.jsonc.
 * Both this function and `wrangler d1 execute --local` use the same hash,
 * so migrations applied via `npm run db:migrate` are immediately available
 * to the Next.js dev server.
 *
 * @see https://opennext.js.org/cloudflare/howtos/db
 * @see docs/SETUP.md for local development workflow
 */
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
