# Speech Server

A dedicated WebSocket server for real-time speech recognition using Google Cloud Speech-to-Text.

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
│  - Static pages                                       - gRPC to Google       │
│  - API routes                                         - Real-time streaming  │
│                                                               │              │
│                                                               ▼              │
│                                                    Google Cloud Speech       │
│                                                    (gRPC bidirectional)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why a Separate Server?

1. **Next.js App Router doesn't support WebSockets** - Route handlers can't maintain
   persistent connections.

2. **gRPC requires bidirectional streaming** - Google's Speech API uses gRPC, not REST,
   for real-time streaming. This requires a persistent server-side connection.

3. **Separation of Concerns** - The Next.js app handles HTTP/rendering, this server
   handles real-time audio streaming. Each does one thing well.

4. **Scalability** - This server can be scaled independently. No Redis/state sync needed
   because each session is stateless and isolated.

## Scaling Strategy

| Phase | Scale | Platform | Monthly Cost |
|-------|-------|----------|--------------|
| Phase 1 | 0-1K DAU | Railway | $5-50 |
| Phase 2 | 1K-10K DAU | Cloud Run | $65-500 |
| Phase 3 | 10K+ DAU | Cloud Run (scaled) | $500+ |

**When to migrate:** Connection errors, latency complaints, or costs exceeding $50-100/mo on Railway.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Protocol

### Client → Server (Binary)
- Raw audio data (LINEAR16, 16kHz, mono)
- Sent as binary WebSocket frames

### Server → Client (JSON)
```typescript
// Interim result (as user speaks)
{
  "type": "interim",
  "transcript": "c a",
  "timestamp": 1234567890
}

// Final result (when speech ends)
{
  "type": "final",
  "transcript": "c a t",
  "words": [
    { "word": "c", "startTime": 0.1, "endTime": 0.3 },
    { "word": "a", "startTime": 0.5, "endTime": 0.7 },
    { "word": "t", "startTime": 0.9, "endTime": 1.1 }
  ],
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
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_CLIENT_EMAIL`
- `GOOGLE_CLOUD_PRIVATE_KEY`

## Files

- `index.ts` - Server entry point, WebSocket handling
- `google-streaming.ts` - Google Cloud Speech gRPC streaming logic
- `types.ts` - TypeScript interfaces
- `package.json` - Dependencies for standalone deployment
- `DEPLOYMENT.md` - Production deployment guide
