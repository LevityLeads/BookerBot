import { NextResponse } from 'next/server'
import { orchestrator } from '@/lib/ai'

interface RespondRequest {
  contactId: string
  message: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as RespondRequest

    // Validate input
    if (!body.contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      )
    }

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'message is required and must be a string' },
        { status: 400 }
      )
    }

    // Process message through orchestrator
    const result = await orchestrator.processMessage({
      contactId: body.contactId,
      message: body.message.trim(),
      workflow: undefined as never // Will be loaded by orchestrator
    })

    return NextResponse.json({
      success: true,
      response: result.response,
      intent: result.intent,
      qualification: result.contextUpdate.qualification,
      tokensUsed: result.tokensUsed,
      shouldEscalate: result.shouldEscalate,
      escalationReason: result.escalationReason,
      statusUpdate: result.statusUpdate
    })
  } catch (error) {
    console.error('AI respond error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'

    // Return specific error messages for known conditions
    if (message.includes('opted out')) {
      return NextResponse.json(
        { error: 'Contact has opted out', code: 'OPTED_OUT' },
        { status: 400 }
      )
    }

    if (message.includes('handed off')) {
      return NextResponse.json(
        { error: 'Contact is already handed off to human', code: 'HANDED_OFF' },
        { status: 400 }
      )
    }

    if (message.includes('not found')) {
      return NextResponse.json(
        { error: 'Contact not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (message.includes('not active')) {
      return NextResponse.json(
        { error: 'Workflow is not active', code: 'WORKFLOW_INACTIVE' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate response', details: message },
      { status: 500 }
    )
  }
}
