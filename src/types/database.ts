export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string
          email: string
          phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          phone?: string | null
          created_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          name: string
          brand_name: string
          brand_logo_url: string | null
          timezone: string
          business_hours: Json
          twilio_phone_number: string | null
          // Brand research fields
          brand_url: string | null
          brand_summary: string | null
          brand_services: Json
          brand_target_audience: string | null
          brand_tone: string | null
          brand_usps: Json
          brand_faqs: Json
          brand_dos: Json
          brand_donts: Json
          brand_researched_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          brand_name: string
          brand_logo_url?: string | null
          timezone?: string
          business_hours?: Json
          twilio_phone_number?: string | null
          // Brand research fields
          brand_url?: string | null
          brand_summary?: string | null
          brand_services?: Json
          brand_target_audience?: string | null
          brand_tone?: string | null
          brand_usps?: Json
          brand_faqs?: Json
          brand_dos?: Json
          brand_donts?: Json
          brand_researched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          brand_name?: string
          brand_logo_url?: string | null
          timezone?: string
          business_hours?: Json
          twilio_phone_number?: string | null
          // Brand research fields
          brand_url?: string | null
          brand_summary?: string | null
          brand_services?: Json
          brand_target_audience?: string | null
          brand_tone?: string | null
          brand_usps?: Json
          brand_faqs?: Json
          brand_dos?: Json
          brand_donts?: Json
          brand_researched_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      calendar_connections: {
        Row: {
          id: string
          client_id: string
          provider: string
          access_token: string
          refresh_token: string
          token_expires_at: string | null
          calendar_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          provider?: string
          access_token: string
          refresh_token: string
          token_expires_at?: string | null
          calendar_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          provider?: string
          access_token?: string
          refresh_token?: string
          token_expires_at?: string | null
          calendar_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workflows: {
        Row: {
          id: string
          client_id: string
          name: string
          description: string | null
          status: 'active' | 'paused' | 'archived'
          channel: 'sms' | 'whatsapp' | 'email'
          instructions: string
          initial_message_template: string
          opt_out_message: string
          follow_up_count: number
          follow_up_delay_hours: number
          appointment_duration_minutes: number
          qualification_criteria: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          description?: string | null
          status?: 'active' | 'paused' | 'archived'
          channel?: 'sms' | 'whatsapp' | 'email'
          instructions: string
          initial_message_template: string
          opt_out_message?: string
          follow_up_count?: number
          follow_up_delay_hours?: number
          appointment_duration_minutes?: number
          qualification_criteria?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          description?: string | null
          status?: 'active' | 'paused' | 'archived'
          channel?: 'sms' | 'whatsapp' | 'email'
          instructions?: string
          initial_message_template?: string
          opt_out_message?: string
          follow_up_count?: number
          follow_up_delay_hours?: number
          appointment_duration_minutes?: number
          qualification_criteria?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          workflow_id: string
          phone: string | null
          email: string | null
          first_name: string | null
          last_name: string | null
          custom_fields: Json
          status: 'pending' | 'contacted' | 'in_conversation' | 'qualified' | 'booked' | 'opted_out' | 'unresponsive' | 'handed_off'
          opted_out: boolean
          opted_out_at: string | null
          follow_ups_sent: number
          next_follow_up_at: string | null
          conversation_context: Json
          created_at: string
          last_message_at: string | null
        }
        Insert: {
          id?: string
          workflow_id: string
          phone?: string | null
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          custom_fields?: Json
          status?: 'pending' | 'contacted' | 'in_conversation' | 'qualified' | 'booked' | 'opted_out' | 'unresponsive' | 'handed_off'
          opted_out?: boolean
          opted_out_at?: string | null
          follow_ups_sent?: number
          next_follow_up_at?: string | null
          conversation_context?: Json
          created_at?: string
          last_message_at?: string | null
        }
        Update: {
          id?: string
          workflow_id?: string
          phone?: string | null
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          custom_fields?: Json
          status?: 'pending' | 'contacted' | 'in_conversation' | 'qualified' | 'booked' | 'opted_out' | 'unresponsive' | 'handed_off'
          opted_out?: boolean
          opted_out_at?: string | null
          follow_ups_sent?: number
          next_follow_up_at?: string | null
          conversation_context?: Json
          created_at?: string
          last_message_at?: string | null
        }
      }
      messages: {
        Row: {
          id: string
          contact_id: string
          direction: 'inbound' | 'outbound'
          channel: 'sms' | 'whatsapp' | 'email'
          content: string
          status: 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'received'
          twilio_sid: string | null
          error_message: string | null
          ai_generated: boolean
          tokens_used: number | null
          input_tokens: number | null
          output_tokens: number | null
          ai_model: string | null
          ai_cost: number | null
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          direction: 'inbound' | 'outbound'
          channel: 'sms' | 'whatsapp' | 'email'
          content: string
          status?: 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'received'
          twilio_sid?: string | null
          error_message?: string | null
          ai_generated?: boolean
          tokens_used?: number | null
          input_tokens?: number | null
          output_tokens?: number | null
          ai_model?: string | null
          ai_cost?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          direction?: 'inbound' | 'outbound'
          channel?: 'sms' | 'whatsapp' | 'email'
          content?: string
          status?: 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'received'
          twilio_sid?: string | null
          error_message?: string | null
          ai_generated?: boolean
          tokens_used?: number | null
          input_tokens?: number | null
          output_tokens?: number | null
          ai_model?: string | null
          ai_cost?: number | null
          created_at?: string
        }
      }
      appointments: {
        Row: {
          id: string
          contact_id: string
          workflow_id: string
          client_id: string
          calendar_event_id: string | null
          start_time: string
          end_time: string
          status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          workflow_id: string
          client_id: string
          calendar_event_id?: string | null
          start_time: string
          end_time: string
          status?: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          workflow_id?: string
          client_id?: string
          calendar_event_id?: string | null
          start_time?: string
          end_time?: string
          status?: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          notes?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type Client = Database['public']['Tables']['clients']['Row']
export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']

export type Workflow = Database['public']['Tables']['workflows']['Row']
export type WorkflowInsert = Database['public']['Tables']['workflows']['Insert']
export type WorkflowUpdate = Database['public']['Tables']['workflows']['Update']

export type Contact = Database['public']['Tables']['contacts']['Row']
export type ContactInsert = Database['public']['Tables']['contacts']['Insert']
export type ContactUpdate = Database['public']['Tables']['contacts']['Update']

export type Message = Database['public']['Tables']['messages']['Row']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type MessageUpdate = Database['public']['Tables']['messages']['Update']

export type Appointment = Database['public']['Tables']['appointments']['Row']
export type AppointmentInsert = Database['public']['Tables']['appointments']['Insert']
export type AppointmentUpdate = Database['public']['Tables']['appointments']['Update']

export type CalendarConnection = Database['public']['Tables']['calendar_connections']['Row']

// Business hours type
export type BusinessHours = {
  monday: { start: string; end: string } | null
  tuesday: { start: string; end: string } | null
  wednesday: { start: string; end: string } | null
  thursday: { start: string; end: string } | null
  friday: { start: string; end: string } | null
  saturday: { start: string; end: string } | null
  sunday: { start: string; end: string } | null
}
