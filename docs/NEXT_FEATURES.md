# Next Features Plan - BookerBot

**Created:** January 2026
**Updated:** January 2026
**Author:** Docs & Audit Lead
**Status:** Phase A Complete - In Progress

---

## Current State Audit

### Completed ✅

| Sprint | Feature | Status | Notes |
|--------|---------|--------|-------|
| 1 | Foundation | ✅ Complete | Next.js 14, Supabase, Auth, Schema |
| 2 | Contact Management | ✅ Complete | CRUD, CSV import, bulk actions |
| 3 | AI Conversation Engine | ✅ Complete | Orchestrator, intent, qualification, handoff |
| 4 | Twilio Integration | ✅ Complete | SMS/WhatsApp, webhooks, status tracking |
| 5 | Calendar Integration | ✅ Complete | Google OAuth, availability, booking |
| 6a | Automation Core | ✅ Complete | Jobs infrastructure, cron endpoints |

### Partially Complete ⚠️

| Feature | Done | Missing |
|---------|------|---------|
| Dashboard | Basic stats cards | Real analytics (placeholders show "--%" for rates) |
| Appointments | List view with stats | Calendar view, status management UI, filtering |
| Recent Activity | Placeholder UI | Real activity feed from messages table |
| Automation | Jobs + cron | Workflow pause/resume UI |

### Not Started ❌

| Feature | Priority | Complexity |
|---------|----------|------------|
| Real Analytics | **HIGH** | Medium |
| CRM Foundations | **HIGH** | Medium |
| Production Hardening | **MEDIUM** | Medium |
| Email Channel (Resend) | LOW | Medium |

---

## Priority 1: Automation & Scheduling

**Why:** The system can handle inbound messages but has NO automated outreach. Contacts sit at "pending" forever unless manually triggered.

### 1.1 Initial Outreach Automation

**Goal:** Automatically send initial messages to pending contacts.

**Implementation:**

```
src/
├── lib/
│   └── jobs/
│       ├── index.ts                 # Job runner/queue
│       ├── initial-outreach.ts      # Process pending contacts
│       └── follow-up.ts             # Process follow-ups
├── app/
│   └── api/
│       └── cron/
│           ├── process-outreach/route.ts   # Vercel cron endpoint
│           └── process-followups/route.ts  # Vercel cron endpoint
```

**Logic:**
1. Query contacts where `status = 'pending'` AND workflow `status = 'active'`
2. Check business hours for client timezone
3. Send initial message using existing `sendOutreachMessage()` logic
4. Update contact status to `contacted`
5. Set `next_follow_up_at` based on workflow settings

**Cron Schedule:** Every 5 minutes via Vercel Cron

### 1.2 Follow-up Automation

**Goal:** Automatically send follow-ups to unresponsive contacts.

**Logic:**
1. Query contacts where:
   - `status IN ('contacted', 'in_conversation')`
   - `next_follow_up_at <= NOW()`
   - `follow_ups_sent < workflow.follow_up_count`
   - workflow `status = 'active'`
2. Check business hours
3. Generate AI follow-up message OR use template
4. Increment `follow_ups_sent`, update `next_follow_up_at`
5. If max follow-ups reached, mark as `unresponsive`

**Cron Schedule:** Every 15 minutes via Vercel Cron

### 1.3 Workflow Status Controls

**Goal:** Pause/resume workflows to control automation.

**UI Changes:**
- Add pause/resume toggle button on workflow detail page
- Show warning when pausing about pending outreach
- Bulk pause option on workflows list

---

## Priority 2: Real Analytics Dashboard

**Why:** Dashboard shows placeholder percentages. Need actual conversion funnel data.

### 2.1 Analytics API Endpoint

```typescript
// GET /api/analytics
// Returns aggregated stats for dashboard

interface AnalyticsResponse {
  overview: {
    totalContacts: number
    contacted: number
    qualified: number
    booked: number
    optedOut: number
  }
  rates: {
    responseRate: number      // (in_conversation + qualified + booked) / contacted
    qualificationRate: number // qualified / (contacted - opted_out)
    bookingRate: number       // booked / qualified
    optOutRate: number        // opted_out / contacted
  }
  aiUsage: {
    totalTokens: number
    totalCost: number
    averageTokensPerConversation: number
  }
  byWorkflow: WorkflowStats[]
  recentActivity: ActivityItem[]
}
```

### 2.2 Dashboard Updates

**Replace placeholders with:**
1. **Booking Rate** - Calculated from contacts data
2. **Response Rate** - Based on inbound message count vs contacted
3. **Qualification Rate** - Qualified contacts / total engaged
4. **AI Cost Tracking** - Sum of `ai_cost` from messages table

**New Components:**
- Conversion funnel visualization
- Per-workflow performance comparison chart
- Recent activity feed (real messages, not placeholder)

### 2.3 Token & Cost Tracking

**Already tracked in DB:**
- `tokens_used`, `input_tokens`, `output_tokens`
- `ai_model`, `ai_cost`

**Need to add:**
- Aggregate cost display on dashboard
- Per-client cost breakdown
- Cost alerts/thresholds

---

## Priority 3: Appointments UI Improvements

### 3.1 Status Management

**Add ability to:**
- Mark appointment as completed
- Mark as no-show
- Cancel appointment
- Add/edit notes

**Implementation:**
- Dropdown menu on each appointment row
- Confirmation dialog for destructive actions
- PATCH endpoint already exists: `/api/appointments/[id]`

### 3.2 Calendar View

**Add toggle between:**
- List view (current)
- Week calendar view
- Month calendar view

**Use:**
- Could use a lightweight calendar library
- Or build simple week/month grid components

### 3.3 Filtering

**Add filters for:**
- Status (confirmed, completed, cancelled, no-show)
- Client/workflow
- Date range

---

## Priority 4: CRM Foundations (Scale for Thousands of Contacts)

**Why:** Clients will upload thousands of contacts. Current system has API pagination but UI is limited to 100 contacts with no pagination controls.

### 4.1 Current State

| Feature | API | UI | Notes |
|---------|-----|-----|-------|
| Pagination | ✅ `limit`/`offset` | ❌ Hardcoded 100 | No next/prev buttons |
| Search | ✅ Name/phone/email | ✅ Works | No date/custom field search |
| Filtering | ✅ Status/workflow | ✅ Works | No date range filters |
| Bulk Operations | ✅ Delete | ⚠️ Delete only | No bulk status change |
| DB Indexes | ✅ Good | N/A | status, workflow_id, next_follow_up_at |

### 4.2 UI Pagination

**Add to contacts page:**
- Page number display ("Page 1 of 50")
- Next/Previous buttons
- Page size selector (25, 50, 100, 250)
- Total count display

**Implementation:**
```typescript
// URL params: ?page=1&pageSize=50
const offset = (page - 1) * pageSize
```

### 4.3 Advanced Filtering

**Add filters for:**
- Date range (created, last message)
- Custom field values (from JSONB)
- Days since last contact
- Follow-up count

### 4.4 Bulk Status Operations

**Add bulk actions for:**
- Change status (pending → contacted, etc.)
- Assign to different workflow
- Export selected to CSV
- Trigger manual outreach

### 4.5 Contact Tags (Future)

**Schema addition:**
```sql
CREATE TABLE contact_tags (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  name TEXT NOT NULL,
  color TEXT
);

CREATE TABLE contact_tag_assignments (
  contact_id UUID REFERENCES contacts(id),
  tag_id UUID REFERENCES contact_tags(id),
  PRIMARY KEY (contact_id, tag_id)
);
```

**Use cases:**
- Segment by source ("Website", "Trade Show", "Referral")
- Mark priority levels
- Custom groupings for reporting

### 4.6 Performance Considerations

For 10,000+ contacts per client:
- ✅ Database indexes already in place
- ✅ Pagination at API level exists
- Need: Virtualized table for UI (react-virtual or similar)
- Need: Batch processing in automation jobs (already implemented)
- Consider: Read replicas if DB load increases

---

## Priority 5: Production Hardening

### 4.1 Error Boundaries

- Add React error boundaries for graceful degradation
- Catch and display errors in a user-friendly way

### 4.2 Rate Limiting

**Endpoints to protect:**
- `/api/webhooks/twilio/*` (already has signature validation)
- `/api/ai/*` (AI endpoints are expensive)
- All public endpoints

**Implementation:** Use Vercel's built-in rate limiting or `@upstash/ratelimit`

### 4.3 Input Validation

**Audit and add:**
- Zod schemas for all API inputs
- Sanitization for user-provided content
- Phone number validation before Twilio calls

### 4.4 Authentication

**Currently:** Auth is bypassed in many places

**Need to:**
- Re-enable Supabase auth checks
- Protect all API routes
- Add session management

---

## Implementation Order

Based on business value and dependencies:

### Phase A: Automation Core (Sprint 6a) ✅ COMPLETE
1. ✅ Create job infrastructure (`src/lib/jobs/`)
2. ✅ Implement initial outreach job with batching
3. ✅ Implement follow-up job with AI generation
4. ✅ Add Vercel cron endpoints
5. ⏳ Add workflow pause/resume UI (pending)

**New files created:**
- `src/lib/jobs/types.ts` - Job types and batch config
- `src/lib/jobs/business-hours.ts` - Business hours checker
- `src/lib/jobs/initial-outreach.ts` - Process pending contacts
- `src/lib/jobs/follow-up.ts` - Process follow-ups with AI
- `src/app/api/cron/process-outreach/route.ts` - Vercel cron
- `src/app/api/cron/process-followups/route.ts` - Vercel cron
- `vercel.json` - Cron schedule configuration

**Environment variable needed:**
- `CRON_SECRET` - Secret for authenticating cron requests

### Phase B: Analytics (Sprint 6b)
1. Create `/api/analytics` endpoint
2. Update dashboard with real stats
3. Add recent activity feed
4. Add token/cost tracking display

### Phase C: CRM Foundations (Sprint 6c)
1. Add UI pagination to contacts page
2. Add date range filters
3. Add bulk status operations
4. (Optional) Contact tags schema

### Phase D: Appointments Polish (Sprint 6d)
1. Add status management UI
2. Add appointment filtering
3. (Optional) Calendar view

### Phase E: Hardening (Sprint 7)
1. Add rate limiting
2. Add error boundaries
3. Re-enable authentication
4. Security audit

---

## File Ownership by Role

| Role | New Files |
|------|-----------|
| **Data Architect** | `src/lib/jobs/`, `/api/cron/`, `/api/analytics` |
| **Frontend Lead** | Dashboard updates, appointment UI improvements |
| **Analytics Lead** | Analytics calculations, cost tracking logic |
| **QA Lead** | Rate limiting, input validation, error boundaries |
| **Integrations** | Cron scheduling, Vercel configuration |

---

## Estimated Effort

| Feature | Complexity | Files Changed |
|---------|------------|---------------|
| Initial outreach job | Medium | 4-5 new files |
| Follow-up job | Medium | 2-3 files |
| Vercel cron setup | Low | Config + 2 routes |
| Analytics API | Medium | 1-2 files |
| Dashboard updates | Medium | 1-2 files |
| Appointment status UI | Low | 1-2 files |
| Rate limiting | Low | Middleware + config |
| Error boundaries | Low | Component wrapper |

---

## Dependencies

```
Automation → requires: nothing (can start immediately)
Analytics  → requires: nothing (can parallel with automation)
Appointments UI → requires: nothing (can parallel)
Hardening  → should come after features are stable
```

**Recommendation:** Start Automation and Analytics in parallel, as they don't depend on each other.

---

## Success Criteria

| Feature | Metric |
|---------|--------|
| Automation | Pending contacts are processed within 5 min of being added |
| Analytics | Dashboard shows real, accurate percentages |
| Appointments | Can update status without touching database directly |
| Hardening | No unhandled errors visible to users |

---

## Notes

- The database schema already supports all planned features
- Token tracking is already implemented in the orchestrator
- Business hours logic exists in the calendar module
- Message sending infrastructure is complete

The system is well-architected for these additions. The main work is wiring up the automation jobs and exposing existing data through new UI.
