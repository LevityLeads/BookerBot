import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateTwilioRequest } from '@/lib/twilio/client'

// Twilio status callback webhook
// Called when message status changes (queued → sent → delivered/failed)
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
        console.error('Invalid Twilio signature on status callback')
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    // Extract status details
    const messageSid = params.MessageSid
    const messageStatus = params.MessageStatus // queued, sent, delivered, undelivered, failed
    const errorCode = params.ErrorCode
    const errorMessage = params.ErrorMessage

    console.log(`Status update for ${messageSid}: ${messageStatus}`)

    if (!messageSid) {
      return NextResponse.json({ error: 'Missing MessageSid' }, { status: 400 })
    }

    const supabase = createClient()

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      queued: 'queued',
      sending: 'queued',
      sent: 'sent',
      delivered: 'delivered',
      undelivered: 'failed',
      failed: 'failed',
      read: 'delivered' // WhatsApp read receipt
    }

    const dbStatus = statusMap[messageStatus] || 'sent'

    // Update the message in our database
    const updateData: {
      status: string
      error_message?: string
    } = {
      status: dbStatus
    }

    // Add error details if the message failed
    if (dbStatus === 'failed' && (errorCode || errorMessage)) {
      updateData.error_message = errorMessage
        ? `${errorCode}: ${errorMessage}`
        : `Error code: ${errorCode}`
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('messages')
      .update(updateData)
      .eq('twilio_sid', messageSid)

    if (error) {
      console.error('Error updating message status:', error)
      // Don't return error to Twilio - it will retry
    }

    // If the message failed, we might want to take action
    if (dbStatus === 'failed') {
      console.error(`Message ${messageSid} failed: ${errorCode} - ${errorMessage}`)

      // Get the message to find the contact
      const { data: messageData } = await supabase
        .from('messages')
        .select('contact_id')
        .eq('twilio_sid', messageSid)
        .single()

      const message = messageData as { contact_id: string } | null

      if (message) {
        // Update contact status if multiple failures (could trigger manual review)
        const { data: failedMessagesData } = await supabase
          .from('messages')
          .select('id')
          .eq('contact_id', message.contact_id)
          .eq('status', 'failed')
          .eq('direction', 'outbound')

        const failedMessages = failedMessagesData as Array<{ id: string }> | null
        const failureCount = failedMessages?.length || 0

        // If 3+ failures, mark contact for review
        if (failureCount >= 3) {
          console.log(`Contact ${message.contact_id} has ${failureCount} failed messages - marking for review`)
          // Could update contact status or add a flag here
        }
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Status webhook error:', error)
    // Return 200 to prevent Twilio retries on our errors
    return NextResponse.json({ success: false })
  }
}
