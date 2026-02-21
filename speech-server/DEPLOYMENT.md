# Speech Server Deployment Guide

This guide covers deploying the PlayLexi speech recognition server to production.

## Overview

The speech server is a Node.js WebSocket server that bridges the browser to Wispr Flow. It must run separately from the Next.js app because:

1. **Next.js App Router doesn't support WebSockets**
2. **Credential shielding** — keeps `WISPR_API_KEY` off the client
3. **Real-time streaming needs persistent connections**

```
Browser (WebSocket) --> Speech Server (Node.js) --> Wispr Flow (WebSocket)
```

---

## Scaling Strategy

> **Strategy:** Start with Railway, migrate to Cloud Run when scaling requires it.

### Why This Phased Approach?

| Phase | Scale | Platform | Monthly Cost | Rationale |
|-------|-------|----------|--------------|-----------|
| **Phase 1** | 0-1,000 DAU | Railway | $5-50 | Simple deployment, no cold starts, focus on product |
| **Phase 2** | 1,000-10,000 DAU | Cloud Run | $100-500 | Better scaling, lower latency |
| **Phase 3** | 10,000+ DAU | Cloud Run (scaled) | $500+ | Auto-scaling, multi-region if needed |

### When to Migrate to Cloud Run

Monitor these signals on Railway:
1. **Connection errors**: Users reporting "WebSocket connection failed"
2. **Latency complaints**: Users noticing delay in transcription
3. **Memory usage**: Approaching Railway's limits
4. **Monthly costs**: Exceeding $50-100 consistently

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
   WISPR_API_KEY=your-wispr-api-key
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
     --set-secrets="WISPR_API_KEY=wispr-api-key:latest"
   ```

3. **Get your URL** from the deployment output (e.g., `playlexi-speech-xxxxx.run.app`)

4. **Update Cloudflare Workers** environment variable:
   ```
   NEXT_PUBLIC_SPEECH_SERVER_URL=wss://playlexi-speech-xxxxx.run.app
   ```

---

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `WISPR_API_KEY` | Your Wispr Flow API key | Yes |
| `SPEECH_SERVER_PORT` | Server port (default: 3002) | No |
| `NODE_ENV` | Set to "production" | Recommended |

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
5. Verify you see transcription after stopping

---

## Troubleshooting

### "WebSocket connection failed"

- Check that the URL uses `wss://` (not `ws://`) for HTTPS sites
- Verify the speech server is running (check platform logs)
- Ensure no firewall is blocking WebSocket connections

### "Wispr API error"

- Verify `WISPR_API_KEY` is set correctly
- Check that the API key is valid and has not expired

### "Connection timeout"

- Railway: Check if the app is running in the dashboard
- Cloud Run: Ensure `min-instances=1` is set to avoid cold starts

### "No transcription results"

- Check browser console for errors
- Verify microphone permissions are granted
- Test microphone with another app

---

## Security Notes

1. **Never commit credentials** — Use environment variables or secrets management
2. **Use WSS (WebSocket Secure)** — Always use `wss://` in production
3. **API key stays server-side** — The `WISPR_API_KEY` is never sent to the browser
