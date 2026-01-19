# CLAUDE.md - BookerBot Project Constitution

## What is BookerBot?

An AI-powered appointment booking system that automates lead qualification and scheduling via SMS/WhatsApp. The AI has natural conversations with contacts, qualifies them against criteria, and books appointments - all without human intervention.

**Core flow:** Contact added → Initial outreach sent → AI converses → Qualifies lead → Books appointment

---

## Role-Based Workflow System

This project uses specialized Claude roles for parallel development. Roles are **auto-assigned** based on the task - you don't need to specify them explicitly. Handoffs between roles happen automatically when work crosses boundaries.

### Available Roles

| Command | Role | Focus Area |
|---------|------|------------|
| `/role:ai` | AI Architect | Conversation engine, prompts, qualification |
| `/role:integrations` | Integration Engineer | Twilio, Calendar, external APIs |
| `/role:frontend` | Frontend Lead | Dashboard UI, components, styling |
| `/role:data` | Data Architect | Database, API routes, data flows |
| `/role:analytics` | Analytics Lead | Metrics, dashboards, monitoring |
| `/role:qa` | QA Lead | Testing, reliability, hardening |

### Utility Commands

| Command | Purpose |
|---------|---------|
| `/role:ship` | Verify, commit, and push to main |
| `/role:handoff` | Create structured handoff notes |

### Auto-Role Detection

Claude automatically selects the appropriate role based on the task:

| If the task involves... | Auto-assign role |
|------------------------|------------------|
| AI prompts, conversation flow, intent detection, qualification | **AI Architect** |
| Twilio, webhooks, calendar, OAuth, external APIs | **Integration Engineer** |
| UI components, pages, styling, React, Tailwind | **Frontend Lead** |
| Database, API routes, types, Supabase queries | **Data Architect** |
| Metrics, dashboards, token tracking, monitoring | **Analytics Lead** |
| Testing, error handling, edge cases, hardening | **QA Lead** |

**Cross-cutting tasks:** When work spans multiple areas, start with the primary role, then auto-handoff to other roles as needed. Document the handoff in the commit message.

### Auto-Handoff Between Roles

When a task requires expertise from another role:

1. **Complete your portion** of the work
2. **Commit with your role prefix** (e.g., `ai: add new intent pattern`)
3. **Switch to the next role** automatically and continue
4. **Commit that portion** with the new role prefix
5. **Push everything to main** when complete

Example flow:
```
Task: "Add reschedule intent and update the UI to show it"

1. [AI Architect] Add reschedule intent detection
   → Commit: "ai: add reschedule intent detection"
2. [Auto-handoff to Frontend]
3. [Frontend Lead] Add reschedule status badge to UI
   → Commit: "ui: add reschedule status badge"
4. Push all commits to main
```

### Git Workflow (ALWAYS MERGE TO MAIN)

**The user never does manual merges or PRs.** All roles automatically push to main after verification.

**Standard Workflow (Every Change):**

```bash
# 1. Ensure on main branch
git checkout main

# 2. Pull latest first
git pull origin main

# 3. Make your changes...

# 4. Verify changes pass all checks
npm run lint && npm run build

# 5. Commit with role prefix
git add -A
git commit -m "[role]: description"

# 6. Pull again (in case parallel session pushed), rebase, and push
git pull --rebase origin main
git push origin main
```

**NEVER create PRs or feature branches** unless explicitly told the change is experimental and might break everything irreversibly.

### Parallel Session Coordination

When multiple Claude sessions work simultaneously:

1. **Always pull before starting work**
   ```bash
   git checkout main && git pull origin main
   ```

2. **Always pull --rebase before pushing**
   ```bash
   git pull --rebase origin main
   ```

3. **If rebase conflicts occur:**
   - Resolve conflicts in the affected files
   - `git add .` the resolved files
   - `git rebase --continue`
   - Push to main

4. **Commit frequently** - smaller commits reduce conflict chance

5. **Coordinate via file ownership** - roles have defined areas, so conflicts should be rare if each role stays in their lane

### Conflict Resolution

If `git pull --rebase` shows conflicts:

```bash
# 1. See which files conflict
git status

# 2. Open each conflicted file, resolve the <<<< ==== >>>> markers

# 3. Stage resolved files
git add <resolved-file>

# 4. Continue rebase
git rebase --continue

# 5. Push to main
git push origin main
```

**When in doubt:** If conflicts are complex or span critical files, describe the situation to the user before resolving.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict)
- **Database:** Supabase (PostgreSQL + Auth)
- **AI:** Anthropic Claude API (Opus 4.5 for conversations)
- **Messaging:** Twilio (SMS/WhatsApp)
- **UI:** Tailwind CSS + shadcn/ui + Radix primitives
- **Deployment:** Vercel

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Login, auth callback
│   ├── (dashboard)/      # Main app pages
│   │   ├── clients/      # Client management
│   │   ├── contacts/     # Contact management
│   │   ├── workflows/    # Workflow configuration
│   │   └── ai-playground/# AI testing
│   └── api/
│       ├── clients/      # Client CRUD
│       ├── contacts/     # Contact CRUD + outreach
│       ├── workflows/    # Workflow CRUD + bulk outreach
│       ├── ai/           # AI endpoints (research, respond, test)
│       ├── messages/     # Message retry
│       └── webhooks/twilio/  # Inbound messages + status updates
├── components/
│   ├── ui/               # shadcn components
│   └── *.tsx             # App-specific components
├── lib/
│   ├── ai/               # AI conversation engine (see below)
│   ├── supabase/         # DB client (server/client/middleware)
│   ├── twilio/           # Messaging client + sender
│   └── utils.ts          # cn() helper
├── types/
│   ├── database.ts       # Supabase types + helpers
│   └── ai.ts             # AI engine types
└── middleware.ts         # Auth protection
```

## AI Conversation Engine (`src/lib/ai/`)

This is the heart of the system. Understand these files:

| File | Purpose |
|------|---------|
| `orchestrator.ts` | Main entry point - processes inbound messages, coordinates all AI components |
| `prompt-builder.ts` | Builds system prompts with phase-based directives and anti-AI language rules |
| `context-manager.ts` | Parses/serializes conversation context to/from database |
| `intent-detector.ts` | Classifies user intent (booking_interest, question, opt_out, etc.) |
| `qualification-engine.ts` | Assesses if contact meets qualification criteria |
| `handoff-handler.ts` | Escalates to human when needed |
| `brand-researcher.ts` | Scrapes website to auto-populate brand info |
| `client.ts` | Low-level Claude API wrapper |

**Conversation phases:** `rapport` → `qualifying` → `qualified` → `booking`

## Database Schema

**Core entities:**
- `clients` - Businesses using the system (has brand info, Twilio number)
- `workflows` - Campaigns with instructions, templates, qualification criteria
- `contacts` - Leads in a workflow (has conversation_context JSON)
- `messages` - All SMS/WhatsApp messages (inbound + outbound)
- `appointments` - Booked meetings

**Key relationships:**
- Client → has many Workflows
- Workflow → has many Contacts
- Contact → has many Messages
- Contact → has many Appointments

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
npm run start    # Start production server
```

## Environment Variables

Required in `.env.local` and Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
NEXT_PUBLIC_APP_URL=     # For webhook callbacks
```

## Coding Conventions

### TypeScript
- Use strict types - avoid `any` (suppress with eslint comment if truly needed)
- Import types from `@/types/database` and `@/types/ai`
- Use path aliases: `@/` maps to `src/`

### React/Next.js
- Server Components by default, `'use client'` only when needed
- Use App Router patterns (not Pages Router)
- API routes return `NextResponse.json()`

### Styling
- Dark mode only - use `bg-card`, `text-foreground`, `text-muted-foreground`
- Never use `bg-white` or light mode colors
- See `docs/DESIGN_SYSTEM.md` for full design language

### Database
- Use `createClient()` from `@/lib/supabase/server` in server code
- Type cast with `as unknown as Type` for complex joins
- Always handle errors from Supabase calls

### AI Prompts
- Keep prompts human-sounding - avoid AI patterns ("Great!", "Absolutely!")
- Use phase-based directives to control conversation flow
- Max tokens: SMS=150, WhatsApp=250, Email=500

## Common Patterns

### Fetching with joins
```typescript
const { data } = await supabase
  .from('contacts')
  .select(`*, workflows(*, clients(*))`)
  .eq('id', id)
  .single()
const typed = data as unknown as ContactWithWorkflow
```

### API route with validation
```typescript
export async function POST(request: Request) {
  const body = await request.json()
  // validate...
  const supabase = createClient()
  const { data, error } = await supabase.from('table').insert(body)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### Component with dialog
```typescript
'use client'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
// Use controlled state with open/onOpenChange
```

## Webhook Flow (Inbound Messages)

1. Twilio POST → `/api/webhooks/twilio/inbound`
2. Find contact by phone number
3. Save inbound message to DB
4. `orchestrator.processMessage()` generates AI response
5. Typing delay (1.5-8s based on length)
6. Send response via Twilio
7. Update message status via status callback

## Important Gotchas

1. **Workflow must be "active"** for AI to respond to inbound messages
2. **Template variables** support both `{var}` and `{{var}}` syntax
3. **Contact deletion** cascades to messages and appointments
4. **Changing workflow** resets contact status and clears history
5. **Supabase RLS** is disabled - auth handled at API layer
6. **Twilio signature validation** only runs in production

## Testing AI Conversations

1. Create a client with brand info
2. Create a workflow with instructions + qualification criteria
3. Add a contact (pending status)
4. Send initial outreach (changes status to contacted)
5. Reply to the SMS - AI will respond
6. Check Vercel logs for typing delay and AI decisions

## Documentation

- `docs/PRD.md` - Full product requirements
- `docs/DESIGN_SYSTEM.md` - UI design language
- `CONTRIBUTING.md` - Contribution guidelines

## Sprint Status

- [x] Sprint 1: Foundation (Next.js, Supabase, Auth)
- [x] Sprint 2: Contact Management (CRUD, CSV import)
- [x] Sprint 3: AI Conversation Engine
- [x] Sprint 4: Twilio SMS/WhatsApp Integration
- [x] Sprint 5: Calendar Integration (Google Calendar)
- [ ] Sprint 6: Dashboard & Analytics
