# Price Tracker

A personal grocery price tracking app. Track prices across stores like Costco, Walmart, and Lidl, import receipts, and see where things are cheapest.

## Features
- Store management (add/edit/delete stores)
- Item & category management
- Receipt import via text paste
- Price comparison table with cheapest store highlighted
- Dashboard with best deals overview

## Self-Hosting on Synology (Portainer)

### Setup
1. Push repo to GitHub → GitHub Actions auto-builds and pushes image to `ghcr.io/yourname/price-tracker:latest`
2. In Portainer → Stacks → Add Stack
3. Paste `docker-compose.yml` (update image name to your GitHub username)
4. Deploy → access at `http://<synology-ip>:3000`

### Updating
Push code → Actions rebuilds image → Portainer "Pull and redeploy" → data persists in Docker volume.

## Local Development

```bash
npm install
npm run db:seed   # seed default categories
npm run dev       # http://localhost:3000
```

## Stack
Next.js 16 · TypeScript · Prisma + SQLite · Tailwind CSS + shadcn/ui · Docker
