import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { BusinessHours } from '@/types/database'

interface UpdateClientBody {
  name?: string
  brand_name?: string
  brand_url?: string
  brand_logo_url?: string
  brand_summary?: string
  brand_services?: string[]
  brand_target_audience?: string
  brand_tone?: string
  brand_usps?: string[]
  brand_faqs?: Array<{ question: string; answer: string }>
  brand_dos?: string[]
  brand_donts?: string[]
  brand_researched_at?: string
  timezone?: string
  business_hours?: BusinessHours
  twilio_phone_number?: string
}

// GET /api/clients/[id] - Get a single client
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Auth disabled for now
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

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

  // Auth disabled for now
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  try {
    const body = await request.json() as UpdateClientBody

    // Only include fields that were provided (allows partial updates)
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.brand_name !== undefined) updateData.brand_name = body.brand_name
    if (body.brand_url !== undefined) updateData.brand_url = body.brand_url
    if (body.brand_logo_url !== undefined) updateData.brand_logo_url = body.brand_logo_url
    if (body.brand_summary !== undefined) updateData.brand_summary = body.brand_summary
    if (body.brand_services !== undefined) updateData.brand_services = body.brand_services
    if (body.brand_target_audience !== undefined) updateData.brand_target_audience = body.brand_target_audience
    if (body.brand_tone !== undefined) updateData.brand_tone = body.brand_tone
    if (body.brand_usps !== undefined) updateData.brand_usps = body.brand_usps
    if (body.brand_faqs !== undefined) updateData.brand_faqs = body.brand_faqs
    if (body.brand_dos !== undefined) updateData.brand_dos = body.brand_dos
    if (body.brand_donts !== undefined) updateData.brand_donts = body.brand_donts
    if (body.brand_researched_at !== undefined) updateData.brand_researched_at = body.brand_researched_at
    if (body.timezone !== undefined) updateData.timezone = body.timezone
    if (body.business_hours !== undefined) updateData.business_hours = body.business_hours
    if (body.twilio_phone_number !== undefined) updateData.twilio_phone_number = body.twilio_phone_number

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

  // Auth disabled for now
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
