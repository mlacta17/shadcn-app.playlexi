# Speech Server Deployment Guide

This guide covers deploying the PlayLexi speech recognition server to production.

## Overview

The speech server is a Node.js WebSocket server that bridges the browser to Google Cloud Speech-to-Text via gRPC. It must run separately from the Next.js app because:

1. **Next.js App Router doesn't support WebSockets**
2. **Google Speech API requires gRPC** (not REST)
3. **Real-time streaming needs persistent connections**

```
Browser (WebSocket) --> Speech Server (Node.js) --> Google Cloud (gRPC)
```

---

## Scaling Strategy

> **Decision Date:** January 2026
>
> **Strategy:** Start with Railway, migrate to Cloud Run when scaling requires it.

### Why This Phased Approach?

| Phase | Scale | Platform | Monthly Cost | Rationale |
|-------|-------|----------|--------------|-----------|
| **Phase 1** | 0-1,000 DAU | Railway | $5-50 | Simple deployment, no cold starts, focus on product |
| **Phase 2** | 1,000-10,000 DAU | Cloud Run | $100-500 | Better scaling, lower latency to Google APIs |
| **Phase 3** | 10,000+ DAU | Cloud Run (scaled) | $500+ | Auto-scaling, multi-region if needed |

### Platform Limits (Verified January 2026)

**Railway:**
- ~3,000 concurrent WebSocket connections max
- 15-minute HTTP request timeout
- No sticky sessions (not needed for our stateless sessions)
- No auto-scaling (manual replica management)
- **Good for:** Up to ~36,000 hourly active users (8% concurrency ratio)

**Cloud Run:**
- 1,000 concurrent connections per instance
- Up to 1,000 instances (1M concurrent theoretical max)
- 60-minute WebSocket timeout
- Auto-scaling based on concurrency
- Session stickiness within single WebSocket connection
- **Good for:** Virtually unlimited scale

### When to Migrate to Cloud Run

Monitor these signals on Railway:
1. **Connection errors**: Users reporting "WebSocket connection failed"
2. **Latency complaints**: Users noticing delay in transcription
3. **Memory usage**: Approaching Railway's limits
4. **Monthly costs**: Exceeding $50-100 consistently

### Migration Effort: ~2 Hours

The migration from Railway to Cloud Run requires:
1. Deploy same code to Cloud Run
2. Update `NEXT_PUBLIC_SPEECH_SERVER_URL` environment variable
3. Test
4. Done (no code changes needed)

---

## Phase 1: Deploy to Railway (Recommended Start)

**Cost**: $5/month (Hobby tier, always running)

### Steps

1. **Create a Railway account** at https://railway.app

2. **Create a new project** and select "Deploy from GitHub repo"

3. **Configure the deployment**:
   - **Root Directory**: `speech-server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. **Add environment variables** in Railway dashboard:
   ```
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_CLOUD_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
   NODE_ENV=production
   ```

5. **Get your deployment URL** (e.g., `playlexi-speech.up.railway.app`)

6. **Update your Next.js app** with the speech server URL:
   - In Cloudflare Workers environment variables:
   ```
   NEXT_PUBLIC_SPEECH_SERVER_URL=wss://playlexi-speech.up.railway.app
   ```

### Railway-Specific Notes

- **No cold starts**: Railway keeps your app running 24/7 on paid tiers
- **Keepalive**: WebSocket connections may drop after 10-15 minutes without activity (not an issue for spelling sessions which are < 1 minute)
- **Logs**: View real-time logs in Railway dashboard for debugging

---

## Phase 2: Migrate to Cloud Run (When Needed)

**Cost**: ~$65/month minimum (with `min-instances=1` to eliminate cold starts)

### Prerequisites

1. **Google Cloud CLI** installed: https://cloud.google.com/sdk/docs/install
2. **Authenticated**: `gcloud auth login`
3. **Project set**: `gcloud config set project YOUR_PROJECT_ID`

### Steps

1. **Create a Dockerfile** in `speech-server/`:
   ```dockerfile
   FROM node:20-slim
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build
   EXPOSE 3002
   CMD ["npm", "start"]
   ```

2. **Deploy to Cloud Run**:
   ```bash
   cd speech-server

   gcloud run deploy playlexi-speech \
     --source . \
     --port 3002 \
     --allow-unauthenticated \
     --min-instances=1 \
     --max-instances=100 \
     --concurrency=100 \
     --timeout=300 \
     --memory=512Mi \
     --cpu=1 \
     --set-env-vars="NODE_ENV=production" \
     --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=your-project-id" \
     --set-env-vars="GOOGLE_CLOUD_CLIENT_EMAIL=your-email" \
     --set-secrets="GOOGLE_CLOUD_PRIVATE_KEY=playlexi-speech-key:latest"
   ```

3. **Get your URL** from the deployment output (e.g., `playlexi-speech-xxxxx.run.app`)

4. **Update Cloudflare Workers** environment variable:
   ```
   NEXT_PUBLIC_SPEECH_SERVER_URL=wss://playlexi-speech-xxxxx.run.app
   ```

### Cloud Run Configuration Explained

| Flag | Value | Rationale |
|------|-------|-----------|
| `--min-instances=1` | 1 | Eliminates cold starts (~$65/month cost) |
| `--max-instances=100` | 100 | Handles up to 10,000 concurrent connections |
| `--concurrency=100` | 100 | Connections per instance (conservative) |
| `--timeout=300` | 5 minutes | Max WebSocket session length |
| `--memory=512Mi` | 512MB | Sufficient for WebSocket + gRPC |
| `--cpu=1` | 1 vCPU | Single CPU is enough for I/O-bound work |

### Cloud Run Cost Breakdown

With `min-instances=1` (1 vCPU, 512MB, 24/7):
- **CPU**: ~$62/month
- **Memory**: ~$3/month
- **Total base cost**: ~$65/month

Additional scaling instances billed per-second of usage.

---

## Other Platforms (Not Recommended)

### Render

**Why not recommended:**
- Free tier WebSocket connections disconnect after 5 minutes
- Free tier sleeps after 15 minutes of inactivity (30+ second cold starts)
- Not suitable for real-time speech recognition

### Fly.io

**Why not recommended for Phase 1:**
- No free tier for new organizations
- More complex setup than Railway
- Inconsistent WebSocket timeout behavior reported

**May be suitable for Phase 2** if you need multi-region deployment before Cloud Run scale.

---

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLOUD_PROJECT_ID` | Your GCP project ID | Yes |
| `GOOGLE_CLOUD_CLIENT_EMAIL` | Service account email | Yes |
| `GOOGLE_CLOUD_PRIVATE_KEY` | Service account private key | Yes |
| `SPEECH_SERVER_PORT` | Server port (default: 3002) | No |
| `NODE_ENV` | Set to "production" | Recommended |

### Private Key Formatting

The `GOOGLE_CLOUD_PRIVATE_KEY` must include the literal `\n` characters:

```bash
# Correct
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

# Wrong (actual newlines won't work in most platforms)
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvg...
-----END PRIVATE KEY-----"
```

---

## Connecting the Next.js App

### Local Development (.env.local)

```bash
NEXT_PUBLIC_SPEECH_SERVER_URL=ws://localhost:3002
```

### Production (Cloudflare Workers Environment Variables)

```bash
# Railway (Phase 1)
NEXT_PUBLIC_SPEECH_SERVER_URL=wss://playlexi-speech.up.railway.app

# Cloud Run (Phase 2)
NEXT_PUBLIC_SPEECH_SERVER_URL=wss://playlexi-speech-xxxxx.run.app
```

---

## Verifying the Deployment

### 1. Test WebSocket connection

Open browser console and run:

```javascript
const ws = new WebSocket('wss://your-speech-server-url');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.onerror = (e) => console.error('Error:', e);
```

You should see "Connected!" followed by a `{"type":"ready",...}` message.

### 2. Test in the app

1. Open your deployed PlayLexi app
2. Start a game in voice mode
3. Click the microphone button
4. Speak some letters
5. Verify you see real-time transcription

---

## Troubleshooting

### "WebSocket connection failed"

- Check that the URL uses `wss://` (not `ws://`) for HTTPS sites
- Verify the speech server is running (check platform logs)
- Ensure no firewall is blocking WebSocket connections

### "Google API error: invalid_grant"

- The service account credentials may have expired
- Re-download the JSON key from Google Cloud Console
- Update the environment variables

### "Connection timeout"

- Railway: Check if the app is running in the dashboard
- Cloud Run: Ensure `min-instances=1` is set to avoid cold starts

### "No transcription results"

- Check browser console for errors
- Verify microphone permissions are granted
- Test microphone with another app

---

## Architecture Notes

### Why No Redis/State Synchronization Needed

Unlike chat applications, the speech server sessions are **stateless and isolated**:

- Each user's spelling session is independent
- No cross-user communication
- No shared state between sessions
- Each WebSocket connection = one Google gRPC stream

This means you can scale horizontally without Redis Pub/Sub or other coordination mechanisms. Each instance handles its own connections independently.

### Scaling Math

| Concurrent Users | Platform | Instances | Monthly Cost |
|------------------|----------|-----------|--------------|
| 100 | Railway | 1 | $5-20 |
| 1,000 | Railway | 1 | $20-50 |
| 3,000+ | Cloud Run | 1+ | $65+ |
| 10,000 | Cloud Run | ~100 | ~$1,000 |

**Note:** "Concurrent" means actively recording at the same moment. With 8% concurrency ratio:
- 1,000 concurrent = ~12,500 hourly active users
- 3,000 concurrent = ~37,500 hourly active users

---

## Security Notes

1. **Never commit credentials** - Use environment variables or secrets management
2. **Restrict service account permissions** - Only grant Speech-to-Text access
3. **Consider API key restrictions** - Limit by IP or referrer in production
4. **Use WSS (WebSocket Secure)** - Always use `wss://` in production
