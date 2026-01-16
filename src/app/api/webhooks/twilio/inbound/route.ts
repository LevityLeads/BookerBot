import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orchestrator } from '@/lib/ai/orchestrator'
import { sendMessage, validateTwilioRequest, formatPhoneNumber } from '@/lib/twilio/client'

// Standard Twilio opt-out keywords
const OPT_OUT_KEYWORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']

// Contact type for query results
interface ContactResult {
  id: string
  phone: string | null
  workflow_id: string
  status: string
  opted_out: boolean
}

// Twilio webhook for inbound SMS/WhatsApp messages
export async function POST(request: Request) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    // Validate the request came from Twilio (in production)
    if (process.env.NODE_ENV === 'production') {
      const signature = request.headers.get('x-twilio-signature') || ''
      const url = request.url
      if (!validateTwilioRequest(signature, url, params)) {
        console.error('Invalid Twilio signature')
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    // Extract message details
    const messageSid = params.MessageSid
    const from = params.From // e.g., "+1234567890" or "whatsapp:+1234567890"
    const body = params.Body
    const numMedia = parseInt(params.NumMedia || '0', 10)
    const optOutType = params.OptOutType // Set if Twilio detected opt-out

    // Determine channel from the message
    const isWhatsApp = from.startsWith('whatsapp:')
    const channel: 'sms' | 'whatsapp' = isWhatsApp ? 'whatsapp' : 'sms'

    // Clean the phone number
    const cleanedFrom = from.replace('whatsapp:', '')
    const formattedPhone = formatPhoneNumber(cleanedFrom)

    console.log(`Inbound ${channel} from ${formattedPhone}: ${body}`)

    const supabase = createClient()

    // Check for Twilio's built-in opt-out detection or our keywords
    const normalizedBody = body.toLowerCase().trim()
    const isOptOut = optOutType === 'STOP' ||
      OPT_OUT_KEYWORDS.includes(normalizedBody) ||
      OPT_OUT_KEYWORDS.some(kw => normalizedBody === kw)

    if (isOptOut) {
      console.log(`Opt-out detected from ${formattedPhone}`)

      // Find and opt out all contacts with this phone number
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('id, workflow_id')
        .eq('phone', formattedPhone)
        .eq('opted_out', false)

      const optOutContacts = contactsData as Array<{ id: string; workflow_id: string }> | null

      if (optOutContacts && optOutContacts.length > 0) {
        // Save the opt-out message and update contacts
        for (const contact of optOutContacts) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('messages').insert({
            contact_id: contact.id,
            direction: 'inbound',
            channel,
            content: body,
            status: 'received',
            twilio_sid: messageSid,
            ai_generated: false
          })

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('contacts')
            .update({
              status: 'opted_out',
              opted_out: true,
              opted_out_at: new Date().toISOString()
            })
            .eq('id', contact.id)
        }
      }

      // Return empty response - Twilio handles STOP automatically
      return twimlResponse()
    }

    // Handle media attachments (log for now)
    if (numMedia > 0) {
      console.log(`Message includes ${numMedia} media attachments`)
    }

    // Find the contact by phone number
    const { data: contactsData, error: contactError } = await supabase
      .from('contacts')
      .select('id, phone, workflow_id, status, opted_out')
      .eq('phone', formattedPhone)
      .neq('status', 'opted_out')
      .limit(1)

    const contacts = contactsData as ContactResult[] | null

    if (contactError) {
      console.error('Error finding contact:', contactError)
      return twimlResponse("We couldn't process your message. Please try again later.")
    }

    if (!contacts || contacts.length === 0) {
      // No active contact found - this could be a new lead or unknown number
      console.log(`No active contact found for ${formattedPhone}`)
      return twimlResponse() // Empty response - don't reply to unknown numbers
    }

    const contact = contacts[0]

    // Check if contact has opted out
    if (contact.opted_out || contact.status === 'opted_out') {
      console.log(`Contact ${formattedPhone} has opted out`)
      return twimlResponse() // Don't reply to opted out contacts
    }

    // Verify workflow is active
    const { data: workflowData } = await supabase
      .from('workflows')
      .select('id, channel, status')
      .eq('id', contact.workflow_id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workflow = workflowData as any

    if (!workflow || workflow.status !== 'active' || workflow.channel !== channel) {
      console.log(`Workflow not active or channel mismatch for contact ${contact.id}`)
      return twimlResponse()
    }

    // Save inbound message first (for tracking)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      contact_id: contact.id,
      direction: 'inbound',
      channel,
      content: body,
      status: 'received',
      twilio_sid: messageSid,
      ai_generated: false
    })

    // Process the message through the AI orchestrator
    const result = await orchestrator.processMessage({
      contactId: contact.id,
      message: body
    })

    // The orchestrator already saved the outbound message to the database
    // Now we need to send it via Twilio

    // Get the workflow to find the client's Twilio number
    const { data: workflowWithClient } = await supabase
      .from('workflows')
      .select('*, clients (twilio_phone_number)')
      .eq('id', contact.workflow_id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientPhone = (workflowWithClient as any)?.clients?.twilio_phone_number

    // Construct the status callback URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'
    const statusCallback = `${baseUrl}/api/webhooks/twilio/status`

    // Send the AI response via Twilio
    const sendResult = await sendMessage({
      to: formattedPhone,
      body: result.response,
      channel,
      fromNumber: clientPhone,
      statusCallback
    })

    if (sendResult.success && sendResult.sid) {
      // Update the message record with the Twilio SID and status
      const { data: lastMessageData } = await supabase
        .from('messages')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastMessage = lastMessageData as { id: string } | null

      if (lastMessage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('messages')
          .update({
            twilio_sid: sendResult.sid,
            status: 'queued'
          })
          .eq('id', lastMessage.id)
      }
    } else {
      console.error('Failed to send response:', sendResult.error)
      // Update message status to failed
      const { data: lastMessageData } = await supabase
        .from('messages')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastMessage = lastMessageData as { id: string } | null

      if (lastMessage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('messages')
          .update({
            status: 'failed',
            error_message: sendResult.error
          })
          .eq('id', lastMessage.id)
      }
    }

    // Return empty TwiML - we're sending the response ourselves
    return twimlResponse()

  } catch (error) {
    console.error('Webhook error:', error)
    return twimlResponse("We're experiencing technical difficulties. Please try again later.")
  }
}

// Helper to return TwiML response
function twimlResponse(message?: string): NextResponse {
  const twiml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'text/xml'
    }
  })
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
