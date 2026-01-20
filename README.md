# PlayLexi

A competitive spelling bee game with voice recognition and anti-cheat detection.

## Quick Start

```bash
# Install dependencies
npm install

# Start development (Next.js + Speech Server)
npm run dev:all

# Or run separately:
npm run dev          # Next.js on http://localhost:3000
npm run dev:speech   # Speech server on ws://localhost:3002
```

## Architecture

| Service | Technology | URL |
|---------|------------|-----|
| **Web App** | Next.js 16 + Cloudflare Workers | https://app.playlexi.com |
| **Speech Server** | Node.js WebSocket + Google Cloud | wss://speech.playlexi.com |
| **Database** | Cloudflare D1 (SQLite) | Serverless |

## Documentation

- **[Product Requirements](docs/PRD.md)** — Game mechanics, features, roadmap
- **[Architecture](docs/ARCHITECTURE.md)** — Technical design, data flow, patterns
- **[Setup Guide](docs/SETUP.md)** — Development, deployment, and optional tooling (Figma MCP)
- **[Component Inventory](docs/COMPONENT_INVENTORY.md)** — UI components and their status

## Key Commands

```bash
# Development
npm run dev:all              # Start both Next.js and speech server
npm run dev                  # Start Next.js only
npm run dev:speech           # Start speech server only

# Database
npm run db:migrate           # Run migrations (local)
npm run db:migrate:prod      # Run migrations (production)
npm run db:seed              # Seed words (local)
npm run db:seed:prod         # Seed words (production)
npm run db:studio            # Open Drizzle Studio

# Deployment
npm run deploy               # Build and deploy to Cloudflare Workers
npm run preview              # Preview production build locally
```

## Tech Stack

- **Frontend**: Next.js 16, React, Tailwind CSS, shadcn/ui
- **Backend**: Cloudflare Workers, D1 Database, R2 Storage
- **Speech**: Google Cloud Speech-to-Text via WebSocket streaming
- **ORM**: Drizzle ORM with D1 adapter

## Project Structure

```
├── app/                    # Next.js App Router pages
├── components/             # React components (UI + game)
├── lib/                    # Business logic and services
├── hooks/                  # React custom hooks
├── speech-server/          # WebSocket server for speech recognition
├── db/                     # Database schema and connection
├── scripts/                # CLI utilities (seeding, uploads)
├── docs/                   # Architecture and setup documentation
└── migrations/             # D1 SQL migrations
```

## License

Private — All rights reserved.
