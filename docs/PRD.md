# Levity BookerBot - Product Requirements Document

## Overview

**Product Name:** Levity BookerBot
**Version:** 1.0 MVP
**Last Updated:** January 2026

BookerBot is an AI-powered appointment booking automation platform that helps businesses convert prospects and clients into booked appointments through natural language conversations via SMS, WhatsApp, and Email.

---

## Problem Statement

Businesses struggle to efficiently convert leads and re-engage dormant prospects. Manual outreach is time-consuming, inconsistent, and doesn't scale. Existing automation tools send generic messages that feel impersonal and achieve low conversion rates.

## Solution

An intelligent automation system that:
- Conducts natural, contextual conversations with prospects
- Adapts messaging based on workflow type (cold leads, existing customers, revived leads)
- Qualifies prospects based on configurable criteria
- Books appointments directly into connected calendars
- Tracks all interactions for visibility and optimization

---

## Target Users

### Primary User (Admin)
- **You** - Managing all client businesses, configuring workflows, monitoring performance

### Secondary Users (Future)
- **Client businesses** - White-labeled access to their own section to view results and manage contacts

### End Users
- **Prospects/Customers** - Recipients of automated outreach who interact via SMS/WhatsApp/Email

---

## Business Model

- **Pricing:** Per appointment booked (win-win alignment with clients)
- **Initial Scale:** 3-4 client businesses, 2-3 workflows each
- **Geographic Focus:** UK first (compliance considerations)

---

## Core Features

### 1. Multi-Tenant Client Management
- Each client business has isolated data and configuration
- White-labeling support (brand name, logo) per client
- Timezone and business hours configuration per client
- Twilio phone number assignment per client

### 2. Workflow Configuration
Each workflow represents a specific outreach campaign with:
- **Channel:** SMS, WhatsApp, or Email
- **AI Instructions:** Custom prompt defining tone, goals, qualification criteria
- **Initial Message Template:** First outreach message (personalized via merge fields)
- **Opt-Out Message:** Configurable response when contacts opt out
- **Follow-Up Settings:**
  - Number of follow-ups (e.g., 3)
  - Delay between follow-ups (e.g., 24 hours)
  - Respect business hours and timezones
- **Appointment Duration:** Default meeting length for bookings
- **Qualification Criteria:** What makes a lead "qualified" (defined in instructions)

### 3. Contact Management
- **Import:** CSV upload with mapping to fields
- **Fields:** Phone, email, first name, last name, custom fields
- **Status Tracking:**
  - `pending` - Not yet contacted
  - `contacted` - Initial message sent
  - `in_conversation` - Active dialogue
  - `qualified` - Met qualification criteria
  - `booked` - Appointment scheduled
  - `opted_out` - Requested no contact
  - `unresponsive` - No reply after all follow-ups
  - `handed_off` - Escalated to human
- **Opt-Out Handling:** Automatic detection of STOP/unsubscribe, legally compliant

### 4. AI Conversation Engine
- **Model:** Claude Haiku or Sonnet (configurable per workflow)
- **Capabilities:**
  - Natural language understanding and generation
  - Context retention across conversation
  - Goal-oriented dialogue (drive toward booking)
  - Objection handling based on instructions
  - Qualification assessment
  - Calendar availability checking
  - Appointment booking confirmation
- **Human Handoff:** When AI cannot proceed, notify admin via SMS

### 5. Calendar Integration
- **Provider:** Google Calendar (Outlook future)
- **Features:**
  - Read availability from calendar
  - Create appointments with event details
  - Sync appointment status changes
  - Respect business hours from client settings

### 6. Messaging Infrastructure
- **SMS/WhatsApp:** Twilio
  - Inbound webhook handling
  - Outbound message sending
  - Delivery status tracking
  - Error handling and retry logic
- **Email:** Resend (Phase 2)
  - Transactional email sending
  - Open/click tracking

### 7. Admin Dashboard
- **Overview Stats:**
  - Total clients, contacts, appointments, active workflows
- **Client Management:**
  - CRUD operations for clients
  - View client details, workflows, stats
- **Workflow Management:**
  - CRUD operations for workflows
  - Contact status breakdown per workflow
- **Contact Management:**
  - View all contacts with filtering
  - Manual status updates
  - Conversation history view
- **Appointment Tracking:**
  - List of all appointments
  - Status management (confirmed, cancelled, completed, no-show)
- **Analytics (Future):**
  - Conversion rates per workflow
  - Response rates and timing
  - AI performance metrics

---

## Technical Architecture

### Stack
| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, Radix UI |
| Backend | Next.js API Routes, Server Actions |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| SMS/WhatsApp | Twilio |
| Email | Resend (future) |
| AI | Anthropic Claude API |
| Calendar | Google Calendar API |
| Hosting | Vercel or Railway |

### Database Schema

```
admins
├── id (uuid, PK)
├── email (text, unique)
├── phone (text, nullable)
└── created_at (timestamp)

clients
├── id (uuid, PK)
├── name (text)
├── brand_name (text)
├── brand_logo_url (text, nullable)
├── timezone (text, default: 'Europe/London')
├── business_hours (jsonb)
├── twilio_phone_number (text, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

calendar_connections
├── id (uuid, PK)
├── client_id (uuid, FK → clients)
├── provider (text, default: 'google')
├── access_token (text, encrypted)
├── refresh_token (text, encrypted)
├── token_expires_at (timestamp)
├── calendar_id (text, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

workflows
├── id (uuid, PK)
├── client_id (uuid, FK → clients)
├── name (text)
├── description (text, nullable)
├── status (enum: active, paused, archived)
├── channel (enum: sms, whatsapp, email)
├── instructions (text) -- AI prompt
├── initial_message_template (text)
├── opt_out_message (text)
├── follow_up_count (int, default: 3)
├── follow_up_delay_hours (int, default: 24)
├── appointment_duration_minutes (int, default: 30)
├── qualification_criteria (text, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

contacts
├── id (uuid, PK)
├── workflow_id (uuid, FK → workflows)
├── phone (text, nullable)
├── email (text, nullable)
├── first_name (text, nullable)
├── last_name (text, nullable)
├── custom_fields (jsonb)
├── status (enum: pending, contacted, in_conversation, qualified, booked, opted_out, unresponsive, handed_off)
├── opted_out (boolean, default: false)
├── opted_out_at (timestamp, nullable)
├── follow_ups_sent (int, default: 0)
├── next_follow_up_at (timestamp, nullable)
├── conversation_context (jsonb) -- AI memory
├── created_at (timestamp)
└── last_message_at (timestamp, nullable)

messages
├── id (uuid, PK)
├── contact_id (uuid, FK → contacts)
├── direction (enum: inbound, outbound)
├── channel (enum: sms, whatsapp, email)
├── content (text)
├── status (enum: pending, queued, sent, delivered, failed, received)
├── twilio_sid (text, nullable)
├── error_message (text, nullable)
├── ai_generated (boolean, default: false)
├── tokens_used (int, nullable)
└── created_at (timestamp)

appointments
├── id (uuid, PK)
├── contact_id (uuid, FK → contacts)
├── workflow_id (uuid, FK → workflows)
├── client_id (uuid, FK → clients)
├── calendar_event_id (text, nullable)
├── start_time (timestamp)
├── end_time (timestamp)
├── status (enum: confirmed, cancelled, completed, no_show)
├── notes (text, nullable)
└── created_at (timestamp)
```

### Security Requirements
- Row Level Security (RLS) on all tables
- Encrypted token storage for OAuth credentials
- HTTPS only
- Input validation and sanitization
- Rate limiting on API endpoints
- Audit logging for sensitive operations

---

## Compliance

### UK Regulations
- **PECR (Privacy and Electronic Communications Regulations)**
  - Consent tracking for marketing messages
  - Clear opt-out mechanism
  - Sender identification
- **GDPR**
  - Data minimization
  - Right to erasure
  - Data processing records
- **Opt-Out Handling**
  - Automatic STOP word detection
  - Immediate cessation of messages
  - Configurable opt-out response message

---

## Sprint Plan

### Sprint 1: Foundation (COMPLETED)
**Goal:** Core infrastructure and admin CRUD operations

**Deliverables:**
- [x] Next.js project setup with TypeScript
- [x] Tailwind CSS + Radix UI component library
- [x] Supabase integration (client, server, middleware)
- [x] Database schema with all 7 tables
- [x] TypeScript type definitions
- [x] Admin authentication (Supabase Auth)
- [x] Dashboard layout with sidebar navigation
- [x] Dashboard home with stats cards
- [x] Client CRUD (API + UI)
  - [x] List clients
  - [x] Create client dialog
  - [x] View client details
  - [x] Edit client
  - [x] Delete client
- [x] Workflow CRUD (API + UI)
  - [x] List workflows with client filter
  - [x] Create workflow dialog
  - [x] View workflow details
  - [x] Edit workflow
  - [x] Delete workflow

---

### Sprint 2: Contact Management & CSV Import (COMPLETED)
**Goal:** Manage contacts and import them into workflows

**Deliverables:**
- [x] Contact CRUD API routes
  - [x] GET /api/contacts (with workflow_id, client_id, status, search filters)
  - [x] POST /api/contacts (single and bulk import)
  - [x] GET /api/contacts/[id] (with messages and appointments)
  - [x] PUT /api/contacts/[id]
  - [x] DELETE /api/contacts/[id]
- [x] Contacts UI
  - [x] Contacts list page with filtering/search
  - [x] Contact detail view with conversation history
  - [x] Create contact dialog (individual entry)
  - [x] Edit contact page
  - [x] Delete contact with confirmation
- [x] CSV Import
  - [x] CSV upload component
  - [x] Column mapping interface with auto-detection
  - [x] Validation and preview before import
  - [x] Bulk insert with result summary
- [x] Contact status management
  - [x] Manual status updates (8 statuses)
  - [x] Bulk actions bar for multi-select
  - [x] Bulk status update and deletion

---

### Sprint 3: Twilio Integration & Messaging (COMPLETED)
**Goal:** Send and receive SMS/WhatsApp messages

**Deliverables:**
- [x] Twilio configuration
  - [x] Environment variables setup
  - [x] Twilio client wrapper (`src/lib/twilio/client.ts`)
  - [x] Phone number validation utilities
- [x] Outbound messaging
  - [x] Send SMS function (`src/lib/twilio/message-sender.ts`)
  - [x] Send WhatsApp function
  - [x] Message queue/retry logic
  - [x] Delivery status webhook handler (`/api/webhooks/twilio/status`)
- [x] Inbound messaging
  - [x] Twilio webhook endpoint (`/api/webhooks/twilio/inbound`)
  - [x] Message parsing and storage
  - [x] Contact lookup/creation
- [x] Message management UI
  - [x] Conversation thread view (contact detail page)
  - [x] Message status indicators
  - [x] Manual message sending (outreach endpoints)

---

### Sprint 4: AI Conversation Engine (COMPLETED)
**Goal:** Claude-powered natural language conversations

**Deliverables:**
- [x] Claude API integration
  - [x] Anthropic SDK setup (`src/lib/ai/client.ts`)
  - [x] Prompt engineering utilities (`src/lib/ai/prompt-builder.ts`)
  - [x] Token usage tracking (tokens_used, ai_cost in messages)
- [x] Conversation orchestrator
  - [x] Build context from conversation history (`src/lib/ai/context-manager.ts`)
  - [x] Inject workflow instructions
  - [x] Generate appropriate responses (`src/lib/ai/orchestrator.ts`)
  - [x] Detect intent (`src/lib/ai/intent-detector.ts`)
- [x] Qualification engine
  - [x] Parse qualification criteria from workflow
  - [x] Assess qualification from conversation (`src/lib/ai/qualification-engine.ts`)
  - [x] Update contact status accordingly
- [x] Human handoff
  - [x] Detect escalation triggers
  - [x] Send SMS notification to admin (`src/lib/ai/handoff-handler.ts`)
  - [x] Mark contact as handed_off
- [x] Testing harness
  - [x] AI Playground page (`/ai-playground`)
  - [x] Test API endpoint (`/api/ai/test`)

---

### Sprint 5: Google Calendar Integration (COMPLETED)
**Goal:** Check availability and book appointments

**Deliverables:**
- [x] Google OAuth flow
  - [x] OAuth consent screen setup
  - [x] Authorization endpoint (`/api/auth/google`)
  - [x] Token exchange and storage (`/api/auth/google/callback`)
  - [x] Token refresh logic
- [x] Calendar API wrapper
  - [x] List calendars (`src/lib/calendar/providers/google.ts`)
  - [x] Get free/busy information
  - [x] Create calendar event
  - [x] Update/cancel event
- [x] Availability engine
  - [x] Merge calendar busy times with business hours (`src/lib/calendar/availability.ts`)
  - [x] Generate available slots
  - [x] Format slots for AI conversation
- [x] Booking flow
  - [x] AI proposes available times (`src/lib/ai/booking-handler.ts`)
  - [x] Parse user time selection
  - [x] Confirm and create appointment
  - [x] Send confirmation message
- [x] Calendar connection UI
  - [x] Connect Google Calendar button (`/connect/calendar/[clientId]`)
  - [x] View connected calendars
  - [x] Disconnect/reconnect

---

### Sprint 6: Automation & Scheduling (IN PROGRESS)
**Goal:** Automated outreach and follow-ups

**Deliverables:**
- [ ] Job scheduler setup
  - [ ] Cron job infrastructure (Vercel Cron)
  - [ ] Job runner module (`src/lib/jobs/`)
- [ ] Initial outreach automation
  - [ ] Process pending contacts
  - [ ] Respect business hours and timezone
  - [ ] Send initial messages
  - [ ] Update contact status to contacted
- [ ] Follow-up automation
  - [ ] Check for contacts needing follow-up
  - [ ] Respect follow-up delay settings
  - [ ] Generate and send follow-up messages
  - [ ] Mark unresponsive after max follow-ups
- [ ] Workflow status controls
  - [ ] Pause/resume workflow toggle UI
  - [ ] Archive workflow (stop all activity)
- [ ] Monitoring
  - [ ] Job execution logs
  - [ ] Error alerting

---

### Sprint 7: Analytics & Dashboard (PLANNED)
**Goal:** Real analytics and improved dashboard

**Deliverables:**
- [ ] Analytics API
  - [ ] `/api/analytics` endpoint
  - [ ] Conversion funnel calculations
  - [ ] Response rate metrics
  - [ ] Token/cost aggregation
- [ ] Dashboard updates
  - [ ] Replace placeholder stats with real data
  - [ ] Add real recent activity feed
  - [ ] Per-workflow performance comparison
  - [ ] AI cost tracking display
- [ ] Appointments UI improvements
  - [x] Appointments list page (basic - completed)
  - [ ] Status management dropdown (completed, no-show, cancel)
  - [ ] Appointment filtering (status, client, date range)
  - [ ] Calendar view (optional)

---

### Sprint 8: Production Hardening (PLANNED)
**Goal:** Security and reliability for production

**Deliverables:**
- [ ] Error handling
  - [ ] React error boundaries
  - [ ] Graceful API error responses
  - [ ] User-friendly error messages
- [ ] Rate limiting
  - [ ] Protect webhook endpoints
  - [ ] Protect AI endpoints
  - [ ] Use Upstash or Vercel rate limiting
- [ ] Input validation
  - [ ] Zod schemas for all API inputs
  - [ ] Phone number sanitization
  - [ ] Content sanitization
- [ ] Authentication
  - [ ] Re-enable Supabase auth checks
  - [ ] Protect all API routes
  - [ ] Session management

---

### Future Enhancements (Post-MVP)
- [ ] Email channel via Resend
- [ ] Microsoft Outlook calendar integration
- [ ] Client self-service portal (white-labeled)
- [ ] API/webhook endpoints for CRM integrations
- [ ] Billing/subscription management (Stripe)
- [ ] Advanced analytics and reporting
- [ ] A/B testing for message templates
- [ ] Multi-language support
- [ ] Team member assignment and round-robin

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Appointment booking rate | > 15% of qualified contacts |
| Response rate | > 40% of contacted leads |
| Opt-out rate | < 5% |
| AI resolution rate | > 90% (minimal human handoff) |
| System uptime | > 99.5% |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Twilio deliverability issues | Messages not received | Monitor delivery rates, implement retry logic |
| AI generates inappropriate responses | Brand damage | Careful prompt engineering, response review tools |
| Calendar API rate limits | Booking failures | Caching, request batching |
| GDPR compliance violation | Legal/financial | Consent tracking, data retention policies |
| WhatsApp Business API approval | Channel unavailable | Start with SMS, apply for WhatsApp early |

---

## Appendix

### Environment Variables Required

```
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

# Resend (Future)
RESEND_API_KEY=

# Admin Notifications
ADMIN_PHONE_NUMBER=
```

### Workflow Instructions Example

```
You are a friendly appointment booking assistant for {client.brand_name}.

Goal: Book a 30-minute consultation call with qualified prospects.

Qualification Criteria:
- They are a business owner or decision maker
- They have an active need for our services
- They are available within the next 2 weeks

Tone: Professional but warm. Use their first name. Be concise - this is SMS.

If they ask questions you cannot answer, offer to have a team member call them.

If they are not interested, thank them politely and respect their decision.

Never be pushy. One follow-up is fine, but respect "no" as an answer.
```
