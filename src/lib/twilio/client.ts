import twilio from 'twilio'

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const defaultFromNumber = process.env.TWILIO_PHONE_NUMBER
const whatsappFromNumber = process.env.TWILIO_WHATSAPP_NUMBER

// Lazy initialization to avoid errors when env vars aren't set
let twilioClient: twilio.Twilio | null = null

function getClient(): twilio.Twilio {
  if (!twilioClient) {
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.')
    }
    twilioClient = twilio(accountSid, authToken)
  }
  return twilioClient
}

export interface SendMessageParams {
  to: string
  body: string
  channel: 'sms' | 'whatsapp'
  fromNumber?: string
  statusCallback?: string
}

export interface SendMessageResult {
  success: boolean
  sid?: string
  status?: string
  error?: string
}

/**
 * Send an SMS or WhatsApp message via Twilio
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  try {
    const client = getClient()

    // Determine the from number based on channel
    let from: string
    if (params.channel === 'whatsapp') {
      from = params.fromNumber
        ? `whatsapp:${params.fromNumber}`
        : `whatsapp:${whatsappFromNumber}`
      if (!from || from === 'whatsapp:undefined') {
        throw new Error('WhatsApp number not configured')
      }
    } else {
      from = params.fromNumber || defaultFromNumber || ''
      if (!from) {
        throw new Error('SMS number not configured')
      }
    }

    // Format the to number for WhatsApp
    const to = params.channel === 'whatsapp'
      ? `whatsapp:${params.to}`
      : params.to

    const messageOptions: {
      body: string
      from: string
      to: string
      statusCallback?: string
    } = {
      body: params.body,
      from,
      to
    }

    // Add status callback URL if provided
    if (params.statusCallback) {
      messageOptions.statusCallback = params.statusCallback
    }

    const message = await client.messages.create(messageOptions)

    return {
      success: true,
      sid: message.sid,
      status: message.status
    }
  } catch (error) {
    console.error('Twilio send error:', error)

    // Check for specific Twilio error codes
    const errorMessage = error instanceof Error ? error.message : 'Unknown error sending message'

    // Detect opt-out/unsubscribed error (Twilio error code 21610)
    if (errorMessage.includes('unsubscribed') ||
        errorMessage.includes('21610') ||
        errorMessage.includes('blacklist')) {
      return {
        success: false,
        error: 'Recipient has opted out via Twilio. To re-enable messaging, remove them from the opt-out list in Twilio Console → Messaging → Opt-Out Management.'
      }
    }

    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Look up a message by SID to get its current status
 */
export async function getMessageStatus(sid: string): Promise<{
  status: string
  errorCode?: number
  errorMessage?: string
} | null> {
  try {
    const client = getClient()
    const message = await client.messages(sid).fetch()

    return {
      status: message.status,
      errorCode: message.errorCode || undefined,
      errorMessage: message.errorMessage || undefined
    }
  } catch (error) {
    console.error('Error fetching message status:', error)
    return null
  }
}

/**
 * Validate that a request came from Twilio
 * Use this in webhook handlers for security
 */
export function validateTwilioRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken) {
    console.warn('Cannot validate Twilio request: auth token not configured')
    return false
  }

  return twilio.validateRequest(authToken, signature, url, params)
}

/**
 * Format a phone number for E.164 format
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')

  // If it doesn't start with a country code, assume US/UK based on length
  if (cleaned.length === 10) {
    return `+1${cleaned}` // Assume US
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('44')) {
    return `+${cleaned}` // UK
  }
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`
  }

  return cleaned
}

/**
 * Check if Twilio is properly configured
 */
export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken && (defaultFromNumber || whatsappFromNumber))
}

/**
 * Get the configured Twilio phone number for a channel
 */
export function getTwilioNumber(channel: 'sms' | 'whatsapp'): string | undefined {
  if (channel === 'whatsapp') {
    return whatsappFromNumber
  }
  return defaultFromNumber
}
