import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { BusinessHours } from '@/types/database'

interface CreateClientBody {
  name: string
  brand_name: string
  brand_url?: string
  brand_logo_url?: string
  timezone?: string
  business_hours?: BusinessHours
  twilio_phone_number?: string
}

// GET /api/clients - List all clients
export async function GET() {
  const supabase = createClient()

  // Auth disabled for now
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(clients)
}

// POST /api/clients - Create a new client
export async function POST(request: Request) {
  const supabase = createClient()

  // Auth disabled for now
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  try {
    const body = await request.json() as CreateClientBody

    // Auto-add https:// if URL provided without protocol
    let brandUrl = body.brand_url || null
    if (brandUrl && !brandUrl.startsWith('http://') && !brandUrl.startsWith('https://')) {
      brandUrl = 'https://' + brandUrl
    }

    const insertData = {
      name: body.name,
      brand_name: body.brand_name,
      brand_url: brandUrl,
      brand_logo_url: body.brand_logo_url || null,
      timezone: body.timezone || 'Europe/London',
      business_hours: body.business_hours || {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' },
        saturday: null,
        sunday: null,
      },
      twilio_phone_number: body.twilio_phone_number || null,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: client, error } = await (supabase as any)
      .from('clients')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(client, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
