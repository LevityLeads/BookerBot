# Contributing to BookerBot

## Deployment Process

This project uses **automatic deployment** from Claude branches to production.

### How It Works

```
Push to claude/* branch → Auto-merge to main → Vercel deploys to production
```

That's it. No PRs, no manual merging, no complexity.

### For Claude Code Sessions

1. Claude Code automatically creates branches like `claude/feature-name-abc123`
2. When you push to these branches, they **automatically merge to main**
3. Vercel detects the main branch update and **deploys to production**

### For Manual Development

If you're developing manually (not via Claude Code):

1. Create a branch: `git checkout -b claude/your-feature-name`
2. Make your changes
3. Commit and push: `git push -u origin claude/your-feature-name`
4. Your changes will automatically deploy to production

### Important Notes

- **Only `claude/*` branches auto-deploy** - other branches require manual PRs
- **Test locally first** - run `npm run build` before pushing to catch errors
- **Vercel preview** - each push creates a preview URL you can test before it hits production
- **Rollback** - if something breaks, push a fix to the claude branch and it will auto-deploy

### Build Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server
npm run build    # Production build (run before pushing!)
npm run lint     # Check for lint errors
```

### Environment Variables

Required in Vercel:
- `ANTHROPIC_API_KEY` - Claude API key for AI features
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Dashboard pages (clients, workflows, etc.)
│   └── api/                # API routes
├── components/             # Reusable React components
├── lib/
│   ├── ai/                 # AI conversation engine
│   │   ├── brand-researcher.ts   # Multi-page website crawler
│   │   ├── orchestrator.ts       # Conversation orchestration
│   │   └── prompt-builder.ts     # Prompt construction
│   └── supabase/           # Database client
└── types/                  # TypeScript type definitions
```
