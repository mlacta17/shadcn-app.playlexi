#!/usr/bin/env node
/**
 * Analyze data overlap between R2 storage and D1 database.
 */

require("dotenv").config({ path: ".env.local" });
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { execSync } = require("child_process");

const client = new S3Client({
  region: "auto",
  endpoint: "https://" + process.env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

async function analyze() {
  console.log("Fetching words from R2...");

  // Get words from R2
  const r2Words = new Set();
  let token;
  do {
    const cmd = new ListObjectsV2Command({
      Bucket: "playlexi-assets",
      Prefix: "audio/tts/intros/",
      ContinuationToken: token
    });
    const res = await client.send(cmd);
    for (const obj of res.Contents || []) {
      const word = obj.Key.replace("audio/tts/intros/", "").replace(".mp3", "");
      r2Words.add(word);
    }
    token = res.NextContinuationToken;
  } while (token);

  console.log("Fetching words from D1...");

  // Get words from D1
  const output = execSync(
    'npx wrangler d1 execute playlexi-db --remote --command="SELECT word FROM words" --json 2>/dev/null',
    { encoding: "utf-8" }
  );
  const parsed = JSON.parse(output);
  const dbWords = new Set(parsed[0].results.map(r => r.word.toLowerCase()));

  // Analyze overlap
  let inBoth = 0;
  let inR2Only = [];
  let inDbOnly = [];

  for (const w of r2Words) {
    if (dbWords.has(w)) {
      inBoth++;
    } else {
      inR2Only.push(w);
    }
  }

  for (const w of dbWords) {
    const found = r2Words.has(w.toLowerCase());
    if (!found) {
      inDbOnly.push(w);
    }
  }

  console.log("\n=== OVERLAP ANALYSIS ===");
  console.log("Words with TTS in R2:", r2Words.size);
  console.log("Words in D1 database:", dbWords.size);
  console.log("In BOTH R2 and D1:", inBoth);
  console.log("In R2 only (audio exists, not in DB):", inR2Only.length);
  console.log("In D1 only (in DB, no TTS audio):", inDbOnly.length);

  if (inR2Only.length > 0 && inR2Only.length <= 20) {
    console.log("\nR2 only sample:", inR2Only.slice(0, 10).join(", "));
  }
  if (inDbOnly.length > 0 && inDbOnly.length <= 20) {
    console.log("\nD1 only:", inDbOnly.join(", "));
  }
}

analyze().catch(e => console.error(e));
