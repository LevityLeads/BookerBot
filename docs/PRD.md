# Levity BookerBot - Product Requirements Document

**Version:** 1.0
**Last Updated:** January 2026
**Status:** MVP Planning

---

## 1. Executive Summary

Levity BookerBot is an AI-powered appointment booking automation platform that engages prospects and clients through natural language conversations via SMS, WhatsApp, and email. The system uses Claude (Haiku/Sonnet) to conduct intelligent, context-aware conversations that qualify leads and book appointments directly into business calendars.

### Core Value Proposition
- **For Businesses**: Automate lead qualification and appointment booking 24/7 without human intervention
- **For End Users**: Natural, conversational booking experience on their preferred channel
- **For Platform Owner**: Scalable SaaS with per-appointment-booked revenue model

---

## 2. Problem Statement

Businesses struggle with:
1. **Lead Response Time**: Manual outreach to leads is slow, causing lost opportunities
2. **Follow-up Consistency**: Staff forget or deprioritize follow-ups
3. **Scale Limitations**: Human capacity limits outreach volume
4. **Lead Revival**: Old databases of unconverted leads sit dormant
5. **Booking Friction**: Multiple back-and-forth messages to find available times

---

## 3. Solution Overview

### System Hierarchy

```
Platform (Levity BookerBot)
└── Client (Business)
    ├── Branding (white-label)
    ├── Calendar Integration
    └── Workflows
        ├── Workflow A (e.g., "New Lead Outreach")
        │   ├── Instructions & Tone
        │   ├── Follow-up Rules
        │   ├── Qualification Criteria
        │   └── Contacts
        └── Workflow B (e.g., "Database Revival")
            └── ...
```

### Communication Flow

```
Contact Upload → Initial Outreach → AI Conversation → Qualification → Booking → Confirmation
                        ↓                  ↓
                   Follow-ups          Human Handoff (if needed)
```

---

## 4. User Personas

### Primary User: Platform Admin (You)
- Manages all clients and workflows
- Configures instructions, messaging, and rules
- Monitors conversations and results
- Receives handoff notifications
- Views analytics across all clients

### Future User: Client Admin
- Manages their own workflows (white-labeled view)
- Uploads contacts
- Views their analytics and booked appointments
- Cannot see other clients' data

### End User: Contact/Prospect
- Receives outreach messages
- Engages in natural conversation
- Books appointments through chat
- Can opt-out at any time

---

## 5. Core Features (MVP)

### 5.1 Client Management

| Feature | Description | Priority |
|---------|-------------|----------|
| Client CRUD | Create, read, update, delete clients | P0 |
| White-label Settings | Logo, business name, reply-to info per client | P0 |
| Calendar Connection | Connect Google Calendar per client | P0 |
| Timezone Settings | Client business timezone | P0 |
| Business Hours | Define available hours for appointments | P0 |

### 5.2 Workflow Management

| Feature | Description | Priority |
|---------|-------------|----------|
| Workflow CRUD | Create multiple workflows per client | P0 |
| Workflow Instructions | System prompt defining tone, goals, qualification criteria | P0 |
| Initial Message Template | First outreach message template with variables | P0 |
| Follow-up Configuration | Number of follow-ups, timing between each | P0 |
| Channel Selection | SMS, WhatsApp, Email (per workflow) | P0 (SMS first) |
| Opt-out Message | Customizable opt-out confirmation | P0 |
| Active/Paused State | Pause workflow without deleting | P1 |

### 5.3 Contact Management (Mini-CRM)

| Feature | Description | Priority |
|---------|-------------|----------|
| CSV Upload | Import contacts with mapping | P0 |
| Contact Fields | Name, phone, email, custom fields | P0 |
| Contact Status | New, In Conversation, Qualified, Booked, Opted Out, Unresponsive | P0 |
| Conversation History | Full message history per contact | P0 |
| Contact Search/Filter | Find contacts by status, workflow, etc. | P1 |
| Manual Notes | Add notes to contacts | P1 |
| Duplicate Detection | Prevent same contact in same workflow | P0 |

### 5.4 Conversation Engine

| Feature | Description | Priority |
|---------|-------------|----------|
| LLM Integration | Claude Haiku/Sonnet for conversation | P0 |
| Context Management | Maintain conversation context | P0 |
| Intent Detection | Identify booking intent, objections, questions | P0 |
| Availability Check | Query Google Calendar for free slots | P0 |
| Slot Offering | Present available times naturally | P0 |
| Booking Confirmation | Confirm and create calendar event | P0 |
| Opt-out Detection | Recognize STOP, unsubscribe, etc. | P0 |
| Human Handoff Trigger | Detect when AI can't handle, notify admin | P0 |
| Variable Injection | Use contact data in messages ({{first_name}}, etc.) | P0 |

### 5.5 Messaging Infrastructure

| Feature | Description | Priority |
|---------|-------------|----------|
| Twilio SMS Integration | Send/receive SMS | P0 |
| Webhook Handling | Process incoming messages | P0 |
| Message Queue | Reliable message delivery | P0 |
| Rate Limiting | Respect carrier/platform limits | P0 |
| Business Hours Respect | Only send during configured hours | P0 |
| Timezone Handling | Send at appropriate local time | P0 |
| Delivery Status Tracking | Track sent, delivered, failed | P1 |

### 5.6 Calendar Integration

| Feature | Description | Priority |
|---------|-------------|----------|
| Google Calendar OAuth | Connect client calendars | P0 |
| Availability Reading | Check free/busy times | P0 |
| Event Creation | Book appointments with details | P0 |
| Buffer Time | Configurable time between appointments | P1 |
| Appointment Duration | Set per workflow | P0 |
| Calendar Event Details | Include contact info, conversation summary | P0 |

### 5.7 Analytics Dashboard

| Feature | Description | Priority |
|---------|-------------|----------|
| Workflow Stats | Contacts, conversations, bookings per workflow | P0 |
| Conversion Funnel | Uploaded → Contacted → Replied → Qualified → Booked | P0 |
| Client Overview | Stats aggregated per client | P0 |
| Recent Activity Feed | Latest conversations, bookings | P1 |
| Export Data | CSV export of results | P1 |

### 5.8 Admin Notifications

| Feature | Description | Priority |
|---------|-------------|----------|
| Handoff Alerts | SMS notification when AI needs help | P0 |
| Daily Summary | Optional daily stats email | P2 |
| Error Alerts | Notify on system issues | P1 |

---

## 6. Data Model

### 6.1 Entity Relationship Diagram

```
┌─────────────────┐
│     admins      │
│─────────────────│
│ id              │
│ email           │
│ phone           │
│ created_at      │
└────────┬────────┘
         │ manages
         ▼
┌─────────────────┐       ┌─────────────────┐
│     clients     │       │calendar_connections│
│─────────────────│       │─────────────────│
│ id              │──────▶│ id              │
│ name            │       │ client_id       │
│ brand_name      │       │ provider        │
│ brand_logo_url  │       │ access_token    │
│ timezone        │       │ refresh_token   │
│ business_hours  │       │ calendar_id     │
│ created_at      │       └─────────────────┘
└────────┬────────┘
         │ has many
         ▼
┌─────────────────┐
│    workflows    │
│─────────────────│
│ id              │
│ client_id       │
│ name            │
│ description     │
│ status          │
│ channel         │
│ instructions    │
│ initial_message │
│ opt_out_message │
│ follow_up_count │
│ follow_up_delay │
│ appointment_duration│
│ qualification_criteria│
│ created_at      │
└────────┬────────┘
         │ has many
         ▼
┌─────────────────┐       ┌─────────────────┐
│    contacts     │       │    messages     │
│─────────────────│       │─────────────────│
│ id              │──────▶│ id              │
│ workflow_id     │       │ contact_id      │
│ phone           │       │ direction       │
│ email           │       │ channel         │
│ first_name      │       │ content         │
│ last_name       │       │ status          │
│ custom_fields   │       │ twilio_sid      │
│ status          │       │ created_at      │
│ opted_out       │       └─────────────────┘
│ opted_out_at    │
│ follow_ups_sent │
│ next_follow_up  │
│ created_at      │
│ last_message_at │
└────────┬────────┘
         │ has many
         ▼
┌─────────────────┐
│  appointments   │
│─────────────────│
│ id              │
│ contact_id      │
│ workflow_id     │
│ client_id       │
│ calendar_event_id│
│ start_time      │
│ end_time        │
│ status          │
│ created_at      │
└─────────────────┘
```

### 6.2 Key Tables Detail

#### `clients`
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  business_hours JSONB NOT NULL DEFAULT '{
    "monday": {"start": "09:00", "end": "17:00"},
    "tuesday": {"start": "09:00", "end": "17:00"},
    "wednesday": {"start": "09:00", "end": "17:00"},
    "thursday": {"start": "09:00", "end": "17:00"},
    "friday": {"start": "09:00", "end": "17:00"},
    "saturday": null,
    "sunday": null
  }',
  twilio_phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `workflows`
```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp', 'email')),

  -- AI Instructions
  instructions TEXT NOT NULL,
  initial_message_template TEXT NOT NULL,
  opt_out_message TEXT NOT NULL DEFAULT 'You have been unsubscribed and will not receive further messages.',

  -- Follow-up Configuration
  follow_up_count INT NOT NULL DEFAULT 2,
  follow_up_delay_hours INT NOT NULL DEFAULT 24,

  -- Appointment Settings
  appointment_duration_minutes INT NOT NULL DEFAULT 30,

  -- Qualification
  qualification_criteria TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `contacts`
```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,

  -- Contact Info
  phone TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  custom_fields JSONB DEFAULT '{}',

  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Uploaded, not yet contacted
    'contacted',      -- Initial message sent
    'in_conversation',-- Actively chatting
    'qualified',      -- Met qualification criteria
    'booked',         -- Appointment booked
    'opted_out',      -- Requested opt-out
    'unresponsive',   -- No reply after all follow-ups
    'handed_off'      -- Requires human intervention
  )),

  -- Opt-out Tracking
  opted_out BOOLEAN DEFAULT FALSE,
  opted_out_at TIMESTAMPTZ,

  -- Follow-up Tracking
  follow_ups_sent INT DEFAULT 0,
  next_follow_up_at TIMESTAMPTZ,

  -- Conversation State
  conversation_context JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,

  UNIQUE(workflow_id, phone)
);
```

#### `messages`
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
  content TEXT NOT NULL,

  -- Delivery Tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'queued', 'sent', 'delivered', 'failed', 'received'
  )),
  twilio_sid TEXT,
  error_message TEXT,

  -- AI Metadata
  ai_generated BOOLEAN DEFAULT FALSE,
  tokens_used INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `appointments`
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  calendar_event_id TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,

  status TEXT DEFAULT 'confirmed' CHECK (status IN (
    'confirmed', 'cancelled', 'completed', 'no_show'
  )),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Technical Architecture

### 7.1 System Architecture

```
                                    ┌─────────────────┐
                                    │   Admin User    │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │    Frontend     │
                                    │    (Next.js)    │
                                    │    on Vercel    │
                                    └────────┬────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                ┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
                │  API Routes     │ │  Supabase       │ │  Scheduled      │
                │  (Next.js)      │ │  Realtime       │ │  Functions      │
                └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                         │                   │                   │
                         └───────────────────┼───────────────────┘
                                             │
                                    ┌────────▼────────┐
                                    │    Supabase     │
                                    │   (Postgres +   │
                                    │   Auth + Edge   │
                                    │   Functions)    │
                                    └────────┬────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
     ┌────────▼────────┐            ┌────────▼────────┐            ┌────────▼────────┐
     │     Twilio      │            │  Google Calendar│            │   Claude API    │
     │   (SMS/WhatsApp)│            │      API        │            │   (Anthropic)   │
     └─────────────────┘            └─────────────────┘            └─────────────────┘
```

### 7.2 Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 14+ (App Router) | Server components, API routes, great DX |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid, consistent, professional UI |
| **Hosting** | Vercel | Seamless Next.js deployment, edge functions |
| **Database** | Supabase (PostgreSQL) | Real-time, auth, row-level security, edge functions |
| **Auth** | Supabase Auth | Simple, secure, supports future client logins |
| **SMS/WhatsApp** | Twilio | Industry standard, reliable |
| **Email** | Resend | Modern, great DX (future) |
| **AI** | Claude API (Anthropic) | Superior conversation quality |
| **Calendar** | Google Calendar API | Wide adoption, good API |
| **Background Jobs** | Supabase Edge Functions + pg_cron | Follow-ups, scheduled sends |
| **File Storage** | Supabase Storage | Logos, CSV uploads |

### 7.3 Key Technical Flows

#### Inbound Message Flow
```
Twilio Webhook → Vercel API Route →
  1. Validate webhook signature
  2. Find contact by phone number
  3. Store message in database
  4. Load conversation context
  5. Load workflow instructions
  6. Call Claude API with context
  7. Check for: opt-out, booking intent, handoff needed
  8. If booking: check calendar, offer slots
  9. Store AI response
  10. Send response via Twilio
  11. Update contact status
```

#### Follow-up Job Flow
```
pg_cron (every 5 min) → Edge Function →
  1. Query contacts where next_follow_up_at <= NOW()
  2. Filter by business hours (client timezone)
  3. For each contact:
     a. Check if max follow-ups reached
     b. Generate follow-up message via Claude
     c. Send via Twilio
     d. Update follow_ups_sent, next_follow_up_at
```

#### Booking Flow
```
AI detects booking intent →
  1. Query Google Calendar for availability
  2. Present 3-4 slot options naturally
  3. User selects slot
  4. Create Google Calendar event
  5. Store appointment in database
  6. Update contact status to 'booked'
  7. Send confirmation message
```

### 7.4 API Route Structure

```
/api
├── /auth
│   └── /callback          # OAuth callbacks
├── /webhooks
│   └── /twilio
│       ├── /inbound       # Incoming SMS/WhatsApp
│       └── /status        # Delivery status updates
├── /clients
│   ├── GET /              # List all clients
│   ├── POST /             # Create client
│   ├── GET /[id]          # Get client details
│   ├── PUT /[id]          # Update client
│   └── DELETE /[id]       # Delete client
├── /workflows
│   ├── GET /              # List workflows (filterable by client)
│   ├── POST /             # Create workflow
│   ├── GET /[id]          # Get workflow details
│   ├── PUT /[id]          # Update workflow
│   ├── DELETE /[id]       # Delete workflow
│   └── POST /[id]/contacts/import  # CSV import
├── /contacts
│   ├── GET /              # List contacts (filterable)
│   ├── GET /[id]          # Get contact with messages
│   ├── PUT /[id]          # Update contact
│   └── POST /[id]/message # Manual message send
├── /appointments
│   ├── GET /              # List appointments
│   └── PUT /[id]          # Update appointment status
├── /calendar
│   ├── GET /connect       # Initiate OAuth flow
│   ├── GET /callback      # OAuth callback
│   └── GET /availability  # Check availability
└── /analytics
    ├── GET /overview      # Platform-wide stats
    └── GET /client/[id]   # Client-specific stats
```

---

## 8. Security & Compliance

### 8.1 Data Security

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | Supabase default (AES-256) |
| Encryption in transit | HTTPS everywhere, TLS 1.3 |
| Access control | Supabase RLS policies |
| API authentication | Supabase JWT tokens |
| Webhook validation | Twilio signature verification |
| Secret management | Environment variables (Vercel) |
| Audit logging | Database triggers on sensitive tables |

### 8.2 GDPR Compliance (UK Focus)

| Requirement | Implementation |
|-------------|----------------|
| Lawful basis | Legitimate interest for B2B outreach |
| Right to erasure | Contact deletion endpoint + cascade |
| Data portability | CSV export of contact data |
| Consent tracking | `opted_out` field with timestamp |
| Data minimization | Only collect necessary fields |
| Processing records | Audit log of all operations |

### 8.3 Messaging Compliance

| Requirement | Implementation |
|-------------|----------------|
| Opt-out handling | Auto-detect STOP, unsubscribe keywords |
| Sender identification | Business name in messages |
| Time restrictions | Business hours enforcement |
| Frequency limits | Configurable follow-up limits |
| Do-not-contact list | Global opt-out tracking |

---

## 9. User Interface Design

### 9.1 Design Principles

1. **Clean & Professional**: Minimal, focused interfaces
2. **Data-Dense but Clear**: Show relevant information without clutter
3. **Real-time Updates**: Live conversation feeds, instant stats
4. **Mobile-Responsive**: Manage on the go when needed
5. **Dark Mode Ready**: Support for future dark mode

### 9.2 Key Screens

#### Dashboard (Home)
```
┌─────────────────────────────────────────────────────────────────┐
│  Levity BookerBot                              [Admin ▼] [⚙️]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │   Clients   │ │  Contacts   │ │   Booked    │ │  Active   │ │
│  │      4      │ │    1,247    │ │     89      │ │Convos: 23 │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
│                                                                 │
│  Recent Activity                                                │
│  ┌─────────────────────────────────────────────────────────────┤
│  │ 🟢 Appointment booked - John Smith (Acme Co)      2 min ago │
│  │ 💬 New reply from Sarah Jones (Beta Inc)          5 min ago │
│  │ ⚠️ Handoff requested - Mike Brown (Acme Co)      12 min ago │
│  │ 📤 Follow-up sent to 15 contacts                 1 hour ago │
│  └─────────────────────────────────────────────────────────────┤
│                                                                 │
│  Clients Overview                                               │
│  ┌──────────────┬──────────┬──────────┬──────────┬───────────┐ │
│  │ Client       │Workflows │ Contacts │ Booked   │ Conv Rate │ │
│  ├──────────────┼──────────┼──────────┼──────────┼───────────┤ │
│  │ Acme Co      │    2     │   523    │    45    │   8.6%    │ │
│  │ Beta Inc     │    3     │   412    │    31    │   7.5%    │ │
│  │ Gamma Ltd    │    2     │   312    │    13    │   4.2%    │ │
│  └──────────────┴──────────┴──────────┴──────────┴───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### Workflow Detail
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Acme Co                                    [Edit]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  New Lead Outreach                              Status: Active  │
│  Channel: SMS  │  Follow-ups: 2  │  Delay: 24h  │  Duration:30m│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┤
│  │ Funnel                                                      │
│  │                                                             │
│  │ Uploaded     Contacted    Replied    Qualified    Booked   │
│  │   523    →     498    →    187    →     92     →    45     │
│  │            (95.2%)      (37.6%)     (49.2%)      (48.9%)   │
│  └─────────────────────────────────────────────────────────────┤
│                                                                 │
│  [+ Upload Contacts]                    Filter: [All Statuses▼]│
│  ┌──────────────┬─────────────┬────────────┬──────────────────┐│
│  │ Contact      │ Phone       │ Status     │ Last Activity    ││
│  ├──────────────┼─────────────┼────────────┼──────────────────┤│
│  │ John Smith   │ +447xxx     │ 🟢 Booked  │ Today, 2:30 PM   ││
│  │ Sarah Jones  │ +447xxx     │ 💬 Active  │ Today, 2:15 PM   ││
│  │ Mike Brown   │ +447xxx     │ ⚠️ Handoff │ Today, 1:45 PM   ││
│  └──────────────┴─────────────┴────────────┴──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### Conversation View
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Workflow                          [Mark as Handoff] │
├─────────────────────────────────────────────────────────────────┤
│  John Smith                                                     │
│  +44 7700 900123  │  Status: In Conversation  │  Acme Co       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                              Jan 15, 2:00 PM││
│  │  Hi John! This is Sarah from Acme Co. I noticed      [Bot] ││
│  │  you enquired about our consulting services last            ││
│  │  week. Do you have 15 minutes this week for a quick        ││
│  │  call to discuss how we might help?                        ││
│  │                                                             ││
│  │                                              Jan 15, 2:15 PM││
│  │  [User] Hi yes I'm interested. What times work?             ││
│  │                                                             ││
│  │                                              Jan 15, 2:16 PM││
│  │  Great to hear from you! I have availability on:    [Bot]  ││
│  │  • Tomorrow (Thu) at 10:00 AM                              ││
│  │  • Tomorrow (Thu) at 2:30 PM                               ││
│  │  • Friday at 11:00 AM                                      ││
│  │  Which works best for you?                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────┐ [Send Manual] │
│  │ Type a message to send manually...          │               │
│  └─────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. AI Conversation Design

### 10.1 System Prompt Structure

The AI receives a structured prompt for each conversation:

```
SYSTEM PROMPT
═══════════════════════════════════════════════════════════════

You are a friendly, professional booking assistant for {{brand_name}}.

## Your Goal
{{workflow_instructions}}

## Qualification Criteria
{{qualification_criteria}}

## Key Information
- Business: {{brand_name}}
- Available Services: [from workflow config]
- Appointment Duration: {{appointment_duration}} minutes

## Communication Guidelines
- Be conversational and natural, not robotic
- Keep messages concise (SMS character limits)
- Use the contact's first name when appropriate
- Mirror their communication style
- Never be pushy; respect their time

## Available Actions
- CHECK_AVAILABILITY: Query calendar for open slots
- BOOK_APPOINTMENT: Confirm and book a time slot
- REQUEST_HANDOFF: If you cannot handle the request
- MARK_OPTED_OUT: If they request to stop messages

## Conversation History
{{conversation_history}}

## Contact Information
Name: {{first_name}} {{last_name}}
Custom Fields: {{custom_fields}}

═══════════════════════════════════════════════════════════════
```

### 10.2 Intent Detection

The AI should detect and act on these intents:

| Intent | Trigger Examples | Action |
|--------|------------------|--------|
| Booking Interest | "Yes", "I'm interested", "What times?" | Check availability, offer slots |
| Time Selection | "Tomorrow at 2", "The 10am works" | Confirm and book |
| Opt-out | "STOP", "Unsubscribe", "Remove me" | Mark opted out, send confirmation |
| Question | "What services?", "How much?", "Where?" | Answer from context or handoff |
| Objection | "Too expensive", "Not now", "Not interested" | Handle gracefully, offer alternative |
| Confusion | "Who is this?", "What?", unclear | Clarify, re-introduce |
| Handoff Request | "Speak to human", "Call me", complex questions | Trigger handoff |

### 10.3 Example Workflow Instructions

**New Lead Outreach:**
```
You are reaching out to people who recently expressed interest in our
consulting services. Your goal is to qualify them and book a 30-minute
discovery call.

Tone: Friendly, professional, helpful. Not salesy.

Qualification: They should be a business owner or decision-maker
interested in growth consulting.

If they're not the right person, politely ask if there's someone
better to speak with.

If they have detailed questions about pricing or specific services,
offer to connect them with a consultant who can answer in detail.
```

**Database Revival:**
```
You are re-engaging leads who enquired 3-6 months ago but didn't
proceed. Your goal is to understand if their situation has changed
and book a call if there's renewed interest.

Tone: Warm, non-pushy, curious. Acknowledge the time gap.

Opening angle: "Checking in to see if [topic they enquired about]
is still relevant for you."

If not interested: Thank them gracefully and offer to reach out
in future if circumstances change.
```

---

## 11. Future Roadmap

### Phase 2: Enhanced Features
- [ ] WhatsApp Business API integration
- [ ] Email channel (Resend)
- [ ] Microsoft Outlook calendar support
- [ ] Client self-service portal (white-labeled)
- [ ] Webhook/API for contact ingestion
- [ ] Advanced analytics with date ranges

### Phase 3: Scale & Intelligence
- [ ] A/B testing for initial messages
- [ ] AI-suggested workflow improvements
- [ ] Multi-language support
- [ ] Team/round-robin booking
- [ ] Integration marketplace (Zapier, Make)
- [ ] Billing/subscription management

### Phase 4: Enterprise
- [ ] SSO authentication
- [ ] Custom domains for white-label
- [ ] Advanced compliance features
- [ ] SLA guarantees
- [ ] Dedicated support channels

---

## 12. Success Metrics

### Primary KPIs
| Metric | Target (MVP) |
|--------|--------------|
| Contact → Booked conversion | >5% |
| Response rate | >30% |
| Average time to booking | <24 hours |
| Human handoff rate | <10% |
| System uptime | >99.5% |

### Tracking Implementation
- All metrics derived from database queries
- Real-time dashboard updates via Supabase realtime
- Daily/weekly automated reports (future)

---

## 13. MVP Scope Summary

### In Scope (v1.0)
✅ Client management with white-labeling
✅ Workflow creation with custom instructions
✅ CSV contact import
✅ SMS conversations via Twilio
✅ Claude-powered AI conversations
✅ Google Calendar integration
✅ Appointment booking
✅ Contact status tracking
✅ Conversation history
✅ Opt-out handling
✅ Human handoff notifications
✅ Basic analytics dashboard
✅ Time-based follow-ups
✅ Business hours respect

### Out of Scope (v1.0)
❌ WhatsApp (requires Meta approval)
❌ Email channel
❌ Client self-service portal
❌ Outlook calendar
❌ API/webhook contact ingestion
❌ Billing integration
❌ A/B testing
❌ Multi-language

---

## 14. Implementation Order

### Sprint 1: Foundation
1. Project setup (Next.js, Supabase, Tailwind, shadcn)
2. Database schema and migrations
3. Authentication (admin only)
4. Client CRUD with UI
5. Workflow CRUD with UI

### Sprint 2: Messaging Core
1. Twilio integration setup
2. Webhook handler for inbound messages
3. Message sending infrastructure
4. Contact management and CSV import
5. Basic conversation view

### Sprint 3: AI & Calendar
1. Claude API integration
2. Conversation context management
3. Google Calendar OAuth
4. Availability checking
5. Appointment booking flow

### Sprint 4: Automation & Polish
1. Follow-up scheduling (pg_cron)
2. Business hours logic
3. Opt-out handling
4. Handoff notifications
5. Analytics dashboard
6. Testing and bug fixes

---

## Appendix A: Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Anthropic
ANTHROPIC_API_KEY=

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# App
NEXT_PUBLIC_APP_URL=
ADMIN_PHONE_NUMBER=  # For handoff notifications

# Future: Resend
# RESEND_API_KEY=
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| Client | A business using BookerBot (your customer) |
| Workflow | A specific outreach campaign within a client |
| Contact | A person being reached by a workflow |
| Handoff | When AI cannot handle and human takes over |
| Follow-up | Subsequent message sent after no response |
| Opt-out | When a contact requests to stop receiving messages |
| Qualification | Determining if a contact meets criteria for booking |

---

*Document prepared for Levity BookerBot MVP development.*
