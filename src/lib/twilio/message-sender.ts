import { createClient } from '@/lib/supabase/server'
import { sendMessage, isTwilioConfigured } from './client'
import { Contact, Workflow, Client } from '@/types/database'

type ContactWithWorkflow = Contact & {
  workflows: Workflow & {
    clients: Client
  }
}

interface SendOutboundParams {
  contactId: string
  message: string
  channel: 'sms' | 'whatsapp'
  aiGenerated?: boolean
  tokensUsed?: number
}

interface SendOutboundResult {
  success: boolean
  messageId?: string
  twilioSid?: string
  error?: string
}

/**
 * Send an outbound message to a contact and save to database
 */
export async function sendOutboundMessage(params: SendOutboundParams): Promise<SendOutboundResult> {
  const supabase = createClient()

  // 1. Get the contact with workflow and client info
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select(`
      *,
      workflows (
        *,
        clients (*)
      )
    `)
    .eq('id', params.contactId)
    .single()

  if (contactError || !contact) {
    return {
      success: false,
      error: `Contact not found: ${params.contactId}`
    }
  }

  const typedContact = contact as unknown as ContactWithWorkflow

  // 2. Check if contact can receive messages
  if (typedContact.opted_out || typedContact.status === 'opted_out') {
    return {
      success: false,
      error: 'Contact has opted out'
    }
  }

  if (!typedContact.phone) {
    return {
      success: false,
      error: 'Contact has no phone number'
    }
  }

  // 3. Save message to database first (with pending status)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messageRecord, error: insertError } = await (supabase as any)
    .from('messages')
    .insert({
      contact_id: params.contactId,
      direction: 'outbound',
      channel: params.channel,
      content: params.message,
      status: 'pending',
      ai_generated: params.aiGenerated ?? true,
      tokens_used: params.tokensUsed ?? null
    })
    .select('id')
    .single()

  if (insertError || !messageRecord) {
    return {
      success: false,
      error: `Failed to save message: ${insertError?.message}`
    }
  }

  // 4. If Twilio is not configured, mark as sent (for testing)
  if (!isTwilioConfigured()) {
    console.log(`[TEST MODE] Would send ${params.channel} to ${typedContact.phone}: ${params.message}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('messages')
      .update({ status: 'sent' })
      .eq('id', messageRecord.id)

    return {
      success: true,
      messageId: messageRecord.id
    }
  }

  // 5. Get the client's Twilio number
  const clientPhone = typedContact.workflows.clients?.twilio_phone_number

  // 6. Construct status callback URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const statusCallback = baseUrl ? `${baseUrl}/api/webhooks/twilio/status` : undefined

  // 7. Send via Twilio
  const sendResult = await sendMessage({
    to: typedContact.phone,
    body: params.message,
    channel: params.channel,
    fromNumber: clientPhone || undefined,
    statusCallback
  })

  // 8. Update message record with result
  if (sendResult.success && sendResult.sid) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('messages')
      .update({
        twilio_sid: sendResult.sid,
        status: 'queued'
      })
      .eq('id', messageRecord.id)

    // Update contact last_message_at
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', params.contactId)

    return {
      success: true,
      messageId: messageRecord.id,
      twilioSid: sendResult.sid
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('messages')
      .update({
        status: 'failed',
        error_message: sendResult.error
      })
      .eq('id', messageRecord.id)

    return {
      success: false,
      messageId: messageRecord.id,
      error: sendResult.error
    }
  }
}

/**
 * Send initial outreach message to a contact
 */
export async function sendInitialOutreach(contactId: string): Promise<SendOutboundResult> {
  const supabase = createClient()

  // Get contact with workflow
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select(`
      *,
      workflows (
        *,
        clients (*)
      )
    `)
    .eq('id', contactId)
    .single()

  if (contactError || !contact) {
    return {
      success: false,
      error: `Contact not found: ${contactId}`
    }
  }

  const typedContact = contact as unknown as ContactWithWorkflow

  // Check if contact is in valid state for initial outreach
  if (typedContact.status !== 'pending') {
    return {
      success: false,
      error: `Contact is not in pending state (current: ${typedContact.status})`
    }
  }

  if (typedContact.opted_out) {
    return {
      success: false,
      error: 'Contact has opted out'
    }
  }

  if (typedContact.workflows.status !== 'active') {
    return {
      success: false,
      error: 'Workflow is not active'
    }
  }

  // Parse the initial message template with contact variables
  const initialMessage = parseTemplate(
    typedContact.workflows.initial_message_template,
    {
      first_name: typedContact.first_name || '',
      last_name: typedContact.last_name || '',
      company_name: typedContact.workflows.clients?.brand_name || typedContact.workflows.clients?.name || '',
      full_name: [typedContact.first_name, typedContact.last_name].filter(Boolean).join(' ') || 'there'
    }
  )

  // Verify channel is supported for Twilio
  const channel = typedContact.workflows.channel
  if (channel === 'email') {
    return {
      success: false,
      error: 'Email channel not supported for Twilio - use email provider instead'
    }
  }

  // Send the message
  const result = await sendOutboundMessage({
    contactId,
    message: initialMessage,
    channel,
    aiGenerated: false // Initial template is not AI-generated
  })

  // Update contact status to 'contacted' if successful
  if (result.success) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update({
        status: 'contacted',
        last_message_at: new Date().toISOString()
      })
      .eq('id', contactId)
  }

  return result
}

/**
 * Parse a template string, replacing {{variable}} placeholders
 */
function parseTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match
  })
}

/**
 * Retry sending a failed message
 */
export async function retryFailedMessage(messageId: string): Promise<SendOutboundResult> {
  const supabase = createClient()

  // Get the failed message
  const { data: messageData, error: messageError } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .eq('status', 'failed')
    .eq('direction', 'outbound')
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = messageData as any

  if (messageError || !message) {
    return {
      success: false,
      error: 'Failed message not found'
    }
  }

  // Get the contact
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select(`
      *,
      workflows (
        *,
        clients (*)
      )
    `)
    .eq('id', message.contact_id)
    .single()

  if (contactError || !contact) {
    return {
      success: false,
      error: 'Contact not found'
    }
  }

  const typedContact = contact as unknown as ContactWithWorkflow

  // Check if Twilio is configured
  if (!isTwilioConfigured()) {
    return {
      success: false,
      error: 'Twilio not configured'
    }
  }

  // Get client phone
  const clientPhone = typedContact.workflows.clients?.twilio_phone_number

  // Construct status callback
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const statusCallback = baseUrl ? `${baseUrl}/api/webhooks/twilio/status` : undefined

  // Retry sending
  const sendResult = await sendMessage({
    to: typedContact.phone!,
    body: message.content,
    channel: message.channel,
    fromNumber: clientPhone || undefined,
    statusCallback
  })

  // Update message record
  if (sendResult.success && sendResult.sid) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('messages')
      .update({
        twilio_sid: sendResult.sid,
        status: 'queued',
        error_message: null
      })
      .eq('id', messageId)

    return {
      success: true,
      messageId,
      twilioSid: sendResult.sid
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('messages')
      .update({
        error_message: `Retry failed: ${sendResult.error}`
      })
      .eq('id', messageId)

    return {
      success: false,
      messageId,
      error: sendResult.error
    }
  }
}
