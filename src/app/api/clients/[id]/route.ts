import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { BusinessHours } from '@/types/database'

interface UpdateClientBody {
  name: string
  brand_name: string
  brand_logo_url?: string
  timezone: string
  business_hours: BusinessHours
  twilio_phone_number?: string
}

// GET /api/clients/[id] - Get a single client
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(client)
}

// PUT /api/clients/[id] - Update a client
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as UpdateClientBody

    const updateData = {
      name: body.name,
      brand_name: body.brand_name,
      brand_logo_url: body.brand_logo_url,
      timezone: body.timezone,
      business_hours: body.business_hours,
      twilio_phone_number: body.twilio_phone_number,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: client, error } = await (supabase as any)
      .from('clients')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(client)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

// DELETE /api/clients/[id] - Delete a client
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
