# BookerBot

AI-powered appointment booking automation platform by Levity Leads.

## Deployment

**Production URL:** https://booker-bot.vercel.app

**Deployment is automatic from the `main` branch.** Any commits pushed to `main` will auto-deploy to Vercel within ~1-2 minutes.

### Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production - auto-deploys to Vercel |
| `claude/*` | Feature branches - create PR to merge into main |

### How to Deploy Changes

1. Make your changes on a feature branch or directly on `main`
2. If on a feature branch, create a PR and merge to `main`
3. Vercel automatically deploys from `main`

**Do NOT leave changes on feature branches** - they won't be deployed until merged to `main`.

---

## Development

### Prerequisites

- Node.js 18+
- npm
- Supabase account (for database)

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript
- **Styling:** Tailwind CSS, Radix UI
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Hosting:** Vercel

---

## Documentation

See [docs/PRD.md](docs/PRD.md) for the full Product Requirements Document including:
- Feature specifications
- Database schema
- Sprint roadmap
- Technical architecture
