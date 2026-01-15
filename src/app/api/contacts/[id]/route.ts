import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Contact } from '@/types/database'

type ContactStatus = Contact['status']

interface UpdateContactBody {
  phone?: string
  email?: string
  first_name?: string
  last_name?: string
  custom_fields?: Record<string, unknown>
  status?: ContactStatus
  opted_out?: boolean
}

// GET /api/contacts/[id] - Get a single contact with messages
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: contact, error } = await supabase
    .from('contacts')
    .select(`
      *,
      workflows(
        id,
        name,
        client_id,
        channel,
        status,
        clients(id, name, brand_name)
      ),
      messages(
        id,
        direction,
        channel,
        content,
        status,
        ai_generated,
        created_at
      ),
      appointments(
        id,
        start_time,
        end_time,
        status,
        notes,
        created_at
      )
    `)
    .eq('id', params.id)
    .order('created_at', { foreignTable: 'messages', ascending: true })
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(contact)
}

// PUT /api/contacts/[id] - Update a contact
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  try {
    const body = await request.json() as UpdateContactBody

    const updateData: Record<string, unknown> = {}

    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.email !== undefined) updateData.email = body.email
    if (body.first_name !== undefined) updateData.first_name = body.first_name
    if (body.last_name !== undefined) updateData.last_name = body.last_name
    if (body.custom_fields !== undefined) updateData.custom_fields = body.custom_fields
    if (body.status !== undefined) updateData.status = body.status
    if (body.opted_out !== undefined) {
      updateData.opted_out = body.opted_out
      if (body.opted_out) {
        updateData.opted_out_at = new Date().toISOString()
        updateData.status = 'opted_out'
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact, error } = await (supabase as any)
      .from('contacts')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        workflows(id, name, client_id, channel)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(contact)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

// DELETE /api/contacts/[id] - Delete a contact
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
