import { NextResponse } from 'next/server'
import { retryFailedMessage } from '@/lib/twilio/message-sender'

// POST /api/messages/[id]/retry - Retry sending a failed message
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await retryFailedMessage(params.id)

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        twilioSid: result.twilioSid
      })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Retry error:', error)
    return NextResponse.json(
      { error: 'Failed to retry message' },
      { status: 500 }
    )
  }
}
