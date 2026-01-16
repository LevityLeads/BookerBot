import { NextResponse } from 'next/server'
import { sendInitialOutreach } from '@/lib/twilio/message-sender'

// POST /api/contacts/[id]/outreach - Send initial outreach to a contact
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await sendInitialOutreach(params.id)

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
    console.error('Outreach error:', error)
    return NextResponse.json(
      { error: 'Failed to send outreach' },
      { status: 500 }
    )
  }
}

// POST /api/contacts/[id]/outreach/bulk - Bulk send to multiple contacts
// This is defined separately below

// Create a separate route for bulk operations at workflow level
