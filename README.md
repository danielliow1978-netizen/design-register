# Design Register

A multi-user drawing register for M&E EPC/EPCM contractors to monitor design team productivity.

## Features
- Drawing register with Designer + Project views
- Multi-column sortable tables with URL-synced sort state
- Mark complete with late-reason gate (locked dates, immutable audit log)
- Auto-save drafts every 30 seconds
- Soft-delete recycle bin with role-based permissions
- Productivity dashboard: 5 KPIs + Recharts charts
- Export to PDF / Excel / CSV / PNG
- Daily + weekly email digests via Resend
- Light / Dark / Auto theme

## Tech Stack
**Frontend:** React 18 + Vite + TypeScript + TailwindCSS + TanStack Query + Recharts + zustand  
**Backend:** Node.js + Express + TypeScript + Prisma + SQLite (dev) / PostgreSQL (prod)  
**Email:** Resend SDK · **Deployment:** Vercel (frontend) + Render (backend)

---

## Local Development

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Clone and install
```bash
git clone <your-repo-url>
cd design-register
npm install
```

### 2. Set up backend environment
```bash
cp .env.example packages/backend/.env
# Edit packages/backend/.env — minimum required:
# DATABASE_URL="file:./prisma/dev.db"
# JWT_SECRET="any-random-string-for-local-dev"
```

### 3. Run database migrations + seed
```bash
cd packages/backend
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
cd ../..
```

### 4. Start both servers
```bash
# Terminal 1 — backend
npm run dev:backend

# Terminal 2 — frontend
npm run dev:frontend
```

Open http://localhost:5173

**Test accounts (all passwords: `Password123!`):**

| Email | Role |
|-------|------|
| admin@designregister.com | Admin |
| manager@designregister.com | Design Manager |
| pm@designregister.com | Project Manager |
| daniel@designregister.com | Senior Designer |
| sarah@designregister.com | Designer |

---

## Production Deployment (100% Free)

### Step 1: Supabase (Database)
1. Create account at [supabase.com](https://supabase.com) → New project
2. Go to **Settings → Database → Connection string → URI**
3. Copy the `postgresql://...` connection string

### Step 2: Render (Backend)
1. Create account at [render.com](https://render.com)
2. New → Blueprint → connect your GitHub repo
3. Render reads `render.yaml` automatically
4. Set these environment variables in the Render dashboard:
   - `DATABASE_URL` → your Supabase connection string
   - `CORS_ORIGINS` → your Vercel frontend URL (set after Step 3)
   - `RESEND_API_KEY` → from resend.com (optional — emails won't send without it)
   - `EMAIL_FROM` → verified sender email in Resend
   - `FRONTEND_URL` → your Vercel frontend URL

5. After first deploy, run migrations:
   ```bash
   # In Render dashboard → Shell
   cd packages/backend && npx prisma migrate deploy && npx tsx prisma/seed.ts
   ```

### Step 3: Vercel (Frontend)
1. Create account at [vercel.com](https://vercel.com)
2. New Project → Import from GitHub
3. Override build settings:
   - **Build Command:** `cd packages/frontend && npm install && npm run build`
   - **Output Directory:** `packages/frontend/dist`
4. Edit `vercel.json` — replace `YOUR-APP.onrender.com` with your actual Render URL
5. Deploy

### Step 4: Connect everything
- In Render dashboard: set `CORS_ORIGINS` and `FRONTEND_URL` to your Vercel URL
- Trigger a new Render deploy to pick up the env vars

---

## Email Digests (Optional)

1. Create account at [resend.com](https://resend.com) (free: 100 emails/day)
2. Add and verify your sending domain
3. Set `RESEND_API_KEY` and `EMAIL_FROM` in Render dashboard
4. Digests run automatically via cron (daily 08:00 SGT, weekly Monday 09:00 SGT)
5. Cron only runs in production (`NODE_ENV=production`)

---

## Local PostgreSQL (Alternative to SQLite)

```bash
# Start Postgres via Docker
docker-compose up -d

# Update packages/backend/.env:
# DATABASE_URL="postgresql://designregister:designregister@localhost:5432/designregister"

# Run migrations
cd packages/backend && npx prisma migrate dev
```

---

## Project Structure

```
design-register/
├── packages/
│   ├── backend/          # Express API
│   │   ├── prisma/       # Schema + migrations + seed
│   │   └── src/
│   │       ├── routes/   # API endpoints
│   │       ├── middleware/
│   │       └── services/ # Email + cron jobs
│   └── frontend/         # React app
│       └── src/
│           ├── pages/
│           ├── components/
│           ├── hooks/
│           ├── api/
│           └── lib/      # Export utilities
├── vercel.json           # Frontend deploy config
├── render.yaml           # Backend deploy blueprint
└── .env.example          # Environment variable template
```

---

## Role Permissions

| Role | Delete own drawings | Delete any discipline | Restore | Purge | Audit log |
|------|--------------------|----------------------|---------|-------|-----------|
| Designer | yes | no | no | no | no |
| Senior Designer | yes + same discipline | no | no | no | no |
| Design Manager | yes same discipline | no | yes | no | yes |
| Project Manager | yes own projects | no | yes | no | yes |
| Department Head | yes any | yes | yes | yes | yes |
| Admin | no (system only) | no | yes | no | yes |
