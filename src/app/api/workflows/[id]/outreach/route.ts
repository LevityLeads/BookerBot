import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendInitialOutreach } from '@/lib/twilio/message-sender'

interface BulkOutreachRequest {
  contactIds?: string[]  // Specific contacts to send to
  limit?: number         // Max contacts to process (default 10)
}

// POST /api/workflows/[id]/outreach - Bulk send initial outreach to pending contacts
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as BulkOutreachRequest
    const supabase = createClient()

    // Verify workflow exists and is active
    const { data: workflowData, error: workflowError } = await supabase
      .from('workflows')
      .select('id, status, name')
      .eq('id', params.id)
      .single()

    const workflow = workflowData as { id: string; status: string; name: string } | null

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    if (workflow.status !== 'active') {
      return NextResponse.json(
        { error: 'Workflow is not active' },
        { status: 400 }
      )
    }

    // Get pending contacts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('contacts')
      .select('id')
      .eq('workflow_id', params.id)
      .eq('status', 'pending')
      .eq('opted_out', false)

    // If specific contacts provided, filter to those
    if (body.contactIds && body.contactIds.length > 0) {
      query = query.in('id', body.contactIds)
    }

    // Limit the batch size
    const limit = Math.min(body.limit || 10, 100) // Max 100 per request
    query = query.limit(limit)

    const { data: contactsData, error: contactsError } = await query
    const contacts = contactsData as Array<{ id: string }> | null

    if (contactsError) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        results: []
      })
    }

    // Process each contact
    const results: Array<{
      contactId: string
      success: boolean
      messageId?: string
      error?: string
    }> = []

    let sent = 0
    let failed = 0

    for (const contact of contacts) {
      // Add a small delay between messages to avoid rate limiting
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      const result = await sendInitialOutreach(contact.id)

      results.push({
        contactId: contact.id,
        success: result.success,
        messageId: result.messageId,
        error: result.error
      })

      if (result.success) {
        sent++
      } else {
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: contacts.length,
      results
    })

  } catch (error) {
    console.error('Bulk outreach error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk outreach' },
      { status: 500 }
    )
  }
}

// GET /api/workflows/[id]/outreach - Get outreach statistics
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    // Get contact status counts
    const { data: contactsData, error } = await supabase
      .from('contacts')
      .select('status, opted_out')
      .eq('workflow_id', params.id)

    const contacts = contactsData as Array<{ status: string; opted_out: boolean }> | null

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    const stats = {
      total: contacts?.length || 0,
      pending: 0,
      contacted: 0,
      in_conversation: 0,
      qualified: 0,
      booked: 0,
      opted_out: 0,
      unresponsive: 0,
      handed_off: 0
    }

    for (const contact of contacts || []) {
      const status = contact.status as keyof typeof stats
      if (status in stats) {
        stats[status]++
      }
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error fetching outreach stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
