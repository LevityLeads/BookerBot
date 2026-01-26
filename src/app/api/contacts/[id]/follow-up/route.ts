import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendFollowUpMessage, FollowUpContact } from '@/lib/jobs/follow-up'

/**
 * POST /api/contacts/[id]/follow-up
 * Manually trigger the next follow-up message for a contact
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const contactId = params.id

  // 1. Fetch contact with workflow and client data
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
    return NextResponse.json(
      { error: 'Contact not found' },
      { status: 404 }
    )
  }

  const typedContact = contact as unknown as FollowUpContact

  // 2. Validate contact is eligible for follow-up
  if (typedContact.opted_out) {
    return NextResponse.json(
      { error: 'Contact has opted out and cannot receive follow-ups' },
      { status: 400 }
    )
  }

  if (typedContact.status === 'booked') {
    return NextResponse.json(
      { error: 'Contact has already booked - no follow-up needed' },
      { status: 400 }
    )
  }

  if (typedContact.status === 'handed_off') {
    return NextResponse.json(
      { error: 'Contact has been handed off to human - cannot send automated follow-up' },
      { status: 400 }
    )
  }

  if (typedContact.status === 'unresponsive') {
    return NextResponse.json(
      { error: 'Contact is marked as unresponsive - max follow-ups already sent' },
      { status: 400 }
    )
  }

  if (typedContact.workflows.status !== 'active') {
    return NextResponse.json(
      { error: 'Workflow is not active' },
      { status: 400 }
    )
  }

  // 3. Check if follow-up limit reached
  if (typedContact.follow_ups_sent >= typedContact.workflows.follow_up_count) {
    return NextResponse.json(
      {
        error: `Maximum follow-ups (${typedContact.workflows.follow_up_count}) already sent`,
        follow_ups_sent: typedContact.follow_ups_sent,
        max_follow_ups: typedContact.workflows.follow_up_count
      },
      { status: 400 }
    )
  }

  // 4. Send the follow-up
  const result = await sendFollowUpMessage(typedContact)

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error || 'Failed to send follow-up',
        followUpNumber: result.followUpNumber,
        maxFollowUps: result.maxFollowUps
      },
      { status: 500 }
    )
  }

  // 5. Return success with details
  return NextResponse.json({
    success: true,
    followUpNumber: result.followUpNumber,
    maxFollowUps: result.maxFollowUps,
    aiGenerated: result.aiGenerated,
    message: `Follow-up #${result.followUpNumber} of ${result.maxFollowUps} sent successfully`
  })
}

interface ContactFollowUpStatus {
  id: string
  follow_ups_sent: number
  next_follow_up_at: string | null
  status: string
  opted_out: boolean
  workflows: {
    follow_up_count: number
    follow_up_delay_hours: number
    follow_up_templates: Array<{ message: string; delay_hours: number }> | null
    status: string
  }
}

/**
 * GET /api/contacts/[id]/follow-up
 * Get follow-up status for a contact
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const contactId = params.id

  const { data: contactData, error: contactError } = await supabase
    .from('contacts')
    .select(`
      id,
      follow_ups_sent,
      next_follow_up_at,
      status,
      opted_out,
      workflows (
        follow_up_count,
        follow_up_delay_hours,
        follow_up_templates,
        status
      )
    `)
    .eq('id', contactId)
    .single()

  if (contactError || !contactData) {
    return NextResponse.json(
      { error: 'Contact not found' },
      { status: 404 }
    )
  }

  const contact = contactData as unknown as ContactFollowUpStatus
  const workflow = contact.workflows

  // Determine if next follow-up can be sent
  const canSendFollowUp =
    !contact.opted_out &&
    contact.status !== 'booked' &&
    contact.status !== 'handed_off' &&
    contact.status !== 'unresponsive' &&
    workflow?.status === 'active' &&
    contact.follow_ups_sent < (workflow?.follow_up_count || 0)

  // Get next template info if available
  const templates = workflow?.follow_up_templates || []
  const nextTemplateIndex = contact.follow_ups_sent
  const nextTemplate = templates[nextTemplateIndex]

  return NextResponse.json({
    contactId: contact.id,
    followUpsSent: contact.follow_ups_sent,
    maxFollowUps: workflow?.follow_up_count || 0,
    nextFollowUpAt: contact.next_follow_up_at,
    canSendFollowUp,
    status: contact.status,
    nextFollowUpNumber: contact.follow_ups_sent + 1,
    hasCustomTemplate: !!nextTemplate?.message,
    reason: !canSendFollowUp ? getIneligibilityReason(contact, workflow) : null
  })
}

function getIneligibilityReason(
  contact: { opted_out: boolean; status: string; follow_ups_sent: number },
  workflow: { status: string; follow_up_count: number } | null
): string {
  if (contact.opted_out) return 'Contact has opted out'
  if (contact.status === 'booked') return 'Contact has booked an appointment'
  if (contact.status === 'handed_off') return 'Contact handed off to human'
  if (contact.status === 'unresponsive') return 'Max follow-ups already sent'
  if (!workflow || workflow.status !== 'active') return 'Workflow is not active'
  if (contact.follow_ups_sent >= workflow.follow_up_count) return 'Max follow-ups reached'
  return 'Unknown'
}
