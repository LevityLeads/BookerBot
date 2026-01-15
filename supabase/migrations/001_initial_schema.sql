-- Levity BookerBot Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ADMINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  }'::jsonb,
  twilio_phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CALENDAR CONNECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  calendar_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORKFLOWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
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

-- ============================================
-- CONTACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- Contact Info
  phone TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,

  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'contacted',
    'in_conversation',
    'qualified',
    'booked',
    'opted_out',
    'unresponsive',
    'handed_off'
  )),

  -- Opt-out Tracking
  opted_out BOOLEAN DEFAULT FALSE,
  opted_out_at TIMESTAMPTZ,

  -- Follow-up Tracking
  follow_ups_sent INT DEFAULT 0,
  next_follow_up_at TIMESTAMPTZ,

  -- Conversation State
  conversation_context JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,

  -- Prevent duplicate contacts in same workflow
  UNIQUE(workflow_id, phone)
);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

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

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  calendar_event_id TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,

  status TEXT DEFAULT 'confirmed' CHECK (status IN (
    'confirmed', 'cancelled', 'completed', 'no_show'
  )),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Clients
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- Workflows
CREATE INDEX IF NOT EXISTS idx_workflows_client_id ON workflows(client_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_workflow_id ON contacts(workflow_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_next_follow_up ON contacts(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_twilio_sid ON messages(twilio_sid) WHERE twilio_sid IS NOT NULL;

-- Appointments
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_workflow_id ON appointments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- For MVP, allow authenticated users full access (admin-only app)
-- These policies allow any authenticated user to manage all data

CREATE POLICY "Allow authenticated read access to admins" ON admins
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated full access to clients" ON clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to calendar_connections" ON calendar_connections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to workflows" ON workflows
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to contacts" ON contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to messages" ON messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to appointments" ON appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role bypass for webhooks and background jobs
CREATE POLICY "Service role bypass for admins" ON admins
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass for clients" ON clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass for calendar_connections" ON calendar_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass for workflows" ON workflows
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass for contacts" ON contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass for messages" ON messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass for appointments" ON appointments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
