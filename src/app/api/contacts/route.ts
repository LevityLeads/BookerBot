import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Json } from '@/types/database'

interface CreateContactBody {
  workflow_id: string
  phone?: string
  email?: string
  first_name?: string
  last_name?: string
  custom_fields?: Json
}

interface BulkCreateContactBody {
  workflow_id: string
  contacts: Omit<CreateContactBody, 'workflow_id'>[]
}

// GET /api/contacts - List contacts with optional filters
export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const workflowId = searchParams.get('workflow_id')
  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')

  // Date range filters
  const createdAfter = searchParams.get('created_after')
  const createdBefore = searchParams.get('created_before')
  const lastMessageAfter = searchParams.get('last_message_after')
  const lastMessageBefore = searchParams.get('last_message_before')

  let query = supabase
    .from('contacts')
    .select(`
      *,
      workflows!inner(
        id,
        name,
        client_id,
        channel,
        clients(id, name, brand_name)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (workflowId) {
    query = query.eq('workflow_id', workflowId)
  }

  if (clientId) {
    query = query.eq('workflows.client_id', clientId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
  }

  // Apply date filters
  if (createdAfter) {
    query = query.gte('created_at', createdAfter)
  }
  if (createdBefore) {
    query = query.lte('created_at', createdBefore)
  }
  if (lastMessageAfter) {
    query = query.gte('last_message_at', lastMessageAfter)
  }
  if (lastMessageBefore) {
    query = query.lte('last_message_at', lastMessageBefore)
  }

  const { data: contacts, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ contacts, total: count })
}

// POST /api/contacts - Create a new contact or bulk import
export async function POST(request: Request) {
  const supabase = createClient()

  try {
    const body = await request.json()

    // Check if this is a bulk import
    if (Array.isArray(body.contacts)) {
      const { workflow_id, contacts } = body as BulkCreateContactBody

      if (!workflow_id) {
        return NextResponse.json({ error: 'workflow_id is required' }, { status: 400 })
      }

      const insertData = contacts.map((contact) => ({
        workflow_id,
        phone: contact.phone || null,
        email: contact.email || null,
        first_name: contact.first_name || null,
        last_name: contact.last_name || null,
        custom_fields: (contact.custom_fields || {}) as Json,
        status: 'pending' as const,
        opted_out: false,
        follow_ups_sent: 0,
        conversation_context: {} as Json,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: createdContacts, error } = await (supabase as any)
        .from('contacts')
        .insert(insertData)
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        contacts: createdContacts,
        imported: createdContacts.length
      }, { status: 201 })
    }

    // Single contact creation
    const { workflow_id, phone, email, first_name, last_name, custom_fields } = body as CreateContactBody

    if (!workflow_id) {
      return NextResponse.json({ error: 'workflow_id is required' }, { status: 400 })
    }

    if (!phone && !email) {
      return NextResponse.json({ error: 'Either phone or email is required' }, { status: 400 })
    }

    const insertData = {
      workflow_id,
      phone: phone || null,
      email: email || null,
      first_name: first_name || null,
      last_name: last_name || null,
      custom_fields: (custom_fields || {}) as Json,
      status: 'pending' as const,
      opted_out: false,
      follow_ups_sent: 0,
      conversation_context: {} as Json,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact, error } = await (supabase as any)
      .from('contacts')
      .insert(insertData)
      .select(`
        *,
        workflows(id, name, client_id, channel)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(contact, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
