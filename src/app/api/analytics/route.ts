import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Status counts type
interface StatusCounts {
  pending: number
  contacted: number
  in_conversation: number
  qualified: number
  booked: number
  opted_out: number
  unresponsive: number
  handed_off: number
}

// Analytics response type
interface AnalyticsResponse {
  overview: {
    totalContacts: number
    pending: number
    contacted: number
    inConversation: number
    qualified: number
    booked: number
    optedOut: number
    unresponsive: number
    handedOff: number
  }
  rates: {
    responseRate: number
    qualificationRate: number
    bookingRate: number
    optOutRate: number
  }
  aiUsage: {
    totalTokens: number
    inputTokens: number
    outputTokens: number
    totalCost: number
    totalMessages: number
    averageTokensPerMessage: number
  }
  appointments: {
    total: number
    confirmed: number
    completed: number
    cancelled: number
    noShow: number
  }
  recentActivity: Array<{
    id: string
    type: 'message_sent' | 'message_received' | 'status_change' | 'appointment_booked'
    content: string
    contactName: string
    contactId: string
    timestamp: string
    channel?: string
  }>
}

// GET /api/analytics - Get analytics data for a client
export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const clientId = searchParams.get('client_id')

  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  try {
    // Get all workflows for this client
    const { data: workflowsData, error: workflowError } = await supabase
      .from('workflows')
      .select('id')
      .eq('client_id', clientId)

    if (workflowError) {
      return NextResponse.json({ error: workflowError.message }, { status: 500 })
    }

    const workflows = workflowsData as { id: string }[] | null
    const workflowIds = workflows?.map(w => w.id) || []

    if (workflowIds.length === 0) {
      // Return empty analytics if no workflows
      return NextResponse.json(getEmptyAnalytics())
    }

    // Get contacts for these workflows
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('id, status, first_name, last_name')
      .in('workflow_id', workflowIds)

    if (contactsError) {
      return NextResponse.json({ error: contactsError.message }, { status: 500 })
    }

    const contacts = (contactsData || []) as Array<{
      id: string
      status: string
      first_name: string | null
      last_name: string | null
    }>
    const contactIds = contacts.map(c => c.id)

    // Fetch remaining data in parallel
    const [messagesResult, appointmentsResult, recentMessagesResult] = await Promise.all([
      // Get AI message statistics (only if we have contacts)
      contactIds.length > 0
        ? supabase
            .from('messages')
            .select('id, tokens_used, input_tokens, output_tokens, ai_cost, ai_generated, direction')
            .in('contact_id', contactIds)
        : Promise.resolve({ data: [], error: null }),

      // Get appointments
      supabase
        .from('appointments')
        .select('id, status')
        .eq('client_id', clientId),

      // Get recent messages for activity feed (with contact info via join)
      contactIds.length > 0
        ? supabase
            .from('messages')
            .select(`
              id,
              content,
              direction,
              channel,
              created_at,
              contact_id,
              contacts(id, first_name, last_name)
            `)
            .in('contact_id', contactIds)
            .order('created_at', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
    ])

    // Process contacts by status
    const statusCounts: StatusCounts = {
      pending: 0,
      contacted: 0,
      in_conversation: 0,
      qualified: 0,
      booked: 0,
      opted_out: 0,
      unresponsive: 0,
      handed_off: 0,
    }

    contacts.forEach(contact => {
      const status = contact.status as keyof StatusCounts
      if (status in statusCounts) {
        statusCounts[status]++
      }
    })

    const totalContacts = contacts.length

    // Calculate rates
    // Engaged = anyone who was contacted and responded (in_conversation, qualified, booked, handed_off)
    const engaged = statusCounts.in_conversation + statusCounts.qualified + statusCounts.booked + statusCounts.handed_off
    // Contacted = anyone who received an initial message (not pending)
    const contacted = totalContacts - statusCounts.pending

    // Response rate: contacts who responded / contacts who were contacted
    const responseRate = contacted > 0 ? (engaged / contacted) * 100 : 0

    // Qualification rate: qualified / (engaged contacts, excluding opted_out)
    const qualificationEligible = engaged
    const qualificationRate = qualificationEligible > 0
      ? ((statusCounts.qualified + statusCounts.booked) / qualificationEligible) * 100
      : 0

    // Booking rate: booked / qualified (or qualified + booked)
    const qualifiedTotal = statusCounts.qualified + statusCounts.booked
    const bookingRate = qualifiedTotal > 0
      ? (statusCounts.booked / qualifiedTotal) * 100
      : 0

    // Opt-out rate: opted_out / contacted
    const optOutRate = contacted > 0 ? (statusCounts.opted_out / contacted) * 100 : 0

    // Process AI usage from messages
    const messages = (messagesResult.data || []) as Array<{
      id: string
      tokens_used: number | null
      input_tokens: number | null
      output_tokens: number | null
      ai_cost: number | null
      ai_generated: boolean
      direction: string
    }>
    let totalTokens = 0
    let inputTokens = 0
    let outputTokens = 0
    let totalCost = 0
    let aiMessageCount = 0

    messages.forEach(msg => {
      if (msg.ai_generated) {
        aiMessageCount++
        totalTokens += msg.tokens_used || 0
        inputTokens += msg.input_tokens || 0
        outputTokens += msg.output_tokens || 0
        totalCost += msg.ai_cost || 0
      }
    })

    // Process appointments
    const appointments = (appointmentsResult.data || []) as Array<{
      id: string
      status: string
    }>
    const appointmentCounts = {
      total: appointments.length,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
    }

    appointments.forEach(apt => {
      switch (apt.status) {
        case 'confirmed':
          appointmentCounts.confirmed++
          break
        case 'completed':
          appointmentCounts.completed++
          break
        case 'cancelled':
          appointmentCounts.cancelled++
          break
        case 'no_show':
          appointmentCounts.noShow++
          break
      }
    })

    // Process recent activity
    const recentMessages = (recentMessagesResult.data || []) as Array<{
      id: string
      content: string
      direction: string
      channel: string
      created_at: string
      contact_id: string
      contacts: {
        id: string
        first_name: string | null
        last_name: string | null
      } | null
    }>

    const recentActivity = recentMessages.map((msg) => {
      const contact = msg.contacts
      const contactName = contact?.first_name || contact?.last_name
        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
        : 'Unknown Contact'

      return {
        id: msg.id,
        type: (msg.direction === 'inbound' ? 'message_received' : 'message_sent') as 'message_sent' | 'message_received',
        content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content,
        contactName,
        contactId: msg.contact_id,
        timestamp: msg.created_at,
        channel: msg.channel,
      }
    })

    const response: AnalyticsResponse = {
      overview: {
        totalContacts,
        pending: statusCounts.pending,
        contacted: statusCounts.contacted,
        inConversation: statusCounts.in_conversation,
        qualified: statusCounts.qualified,
        booked: statusCounts.booked,
        optedOut: statusCounts.opted_out,
        unresponsive: statusCounts.unresponsive,
        handedOff: statusCounts.handed_off,
      },
      rates: {
        responseRate: Math.round(responseRate * 10) / 10,
        qualificationRate: Math.round(qualificationRate * 10) / 10,
        bookingRate: Math.round(bookingRate * 10) / 10,
        optOutRate: Math.round(optOutRate * 10) / 10,
      },
      aiUsage: {
        totalTokens,
        inputTokens,
        outputTokens,
        totalCost: Math.round(totalCost * 10000) / 10000, // Round to 4 decimal places
        totalMessages: aiMessageCount,
        averageTokensPerMessage: aiMessageCount > 0
          ? Math.round(totalTokens / aiMessageCount)
          : 0,
      },
      appointments: appointmentCounts,
      recentActivity,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

function getEmptyAnalytics(): AnalyticsResponse {
  return {
    overview: {
      totalContacts: 0,
      pending: 0,
      contacted: 0,
      inConversation: 0,
      qualified: 0,
      booked: 0,
      optedOut: 0,
      unresponsive: 0,
      handedOff: 0,
    },
    rates: {
      responseRate: 0,
      qualificationRate: 0,
      bookingRate: 0,
      optOutRate: 0,
    },
    aiUsage: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      totalMessages: 0,
      averageTokensPerMessage: 0,
    },
    appointments: {
      total: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
    },
    recentActivity: [],
  }
}
