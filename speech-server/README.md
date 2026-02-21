# Speech Server

A dedicated WebSocket server for real-time speech recognition using Wispr Flow.

> **Deployment:** See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.
>
> **Scaling Strategy:** Start with Railway ($5-50/mo), migrate to Cloud Run ($65+/mo) when scaling requires it.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Browser                                         │
│                                 │                                            │
│    ┌────────────────────────────┴────────────────────────────┐              │
│    │                                                          │              │
│    ▼                                                          ▼              │
│  Next.js App                                          Speech Server          │
│  (localhost:3000)                                     (localhost:3002)       │
│  - Game UI                                            - WebSocket endpoint   │
│  - Static pages                                       - WebSocket to Wispr   │
│  - API routes                                         - Audio buffering +    │
│                                                         WAV encoding         │
│                                                               │              │
│                                                               ▼              │
│                                                    Wispr Flow API            │
│                                                    (WebSocket streaming)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why a Separate Server?

1. **Next.js App Router doesn't support WebSockets** - Route handlers can't maintain
   persistent connections.

2. **Credential shielding** - The `WISPR_API_KEY` stays on the server, never exposed
   to the browser.

3. **Protocol translation** - Browser sends raw PCM audio; the server buffers it,
   converts to base64 WAV, and sends JSON packets to Wispr.

4. **Scalability** - This server can be scaled independently. No Redis/state sync needed
   because each session is stateless and isolated.

## Protocol

### Client → Server (Binary)
- Raw audio data (LINEAR16, 16kHz, mono)
- Sent as binary WebSocket frames

### Server → Client (JSON)
```typescript
// Interim result
{
  "type": "interim",
  "transcript": "c a",
  "timestamp": 1234567890
}

// Final result (words array is empty — Wispr has no word-level timing)
{
  "type": "final",
  "transcript": "c a t",
  "words": [],
  "confidence": 0.95
}

// Error
{
  "type": "error",
  "message": "Recognition failed"
}
```

## Running Locally

```bash
# Development (from project root)
npm run dev:speech

# Or directly
cd speech-server && npx ts-node index.ts
```

## Environment Variables

Uses the same `.env.local` as the main app:
- `WISPR_API_KEY` — Your Wispr Flow API key

## Files

- `index.ts` — Server entry point, WebSocket handling
- `wispr-streaming.ts` — Wispr Flow WebSocket streaming logic
- `wav-encoder.ts` — PCM-to-WAV header utility (Wispr requires base64 WAV)
- `types.ts` — TypeScript interfaces
- `package.json` — Dependencies for standalone deployment
- `DEPLOYMENT.md` — Production deployment guide
