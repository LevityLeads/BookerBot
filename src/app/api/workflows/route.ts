import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface CreateWorkflowBody {
  client_id: string
  name: string
  channel: 'sms' | 'whatsapp' | 'email'
  status?: 'active' | 'paused' | 'archived'
  instructions?: string
  initial_message_template?: string
  description?: string
}

// GET /api/workflows - List all workflows
export async function GET(request: Request) {
  const supabase = createClient()

  // Auth disabled for now
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('workflows')
    .select('*, clients(name, brand_name)')
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data: workflows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(workflows)
}

// POST /api/workflows - Create a new workflow
export async function POST(request: Request) {
  const supabase = createClient()

  // Auth disabled for now
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  try {
    const body = await request.json() as CreateWorkflowBody

    const insertData = {
      client_id: body.client_id,
      name: body.name,
      channel: body.channel,
      status: body.status || 'paused',
      instructions: body.instructions || 'You are a helpful booking assistant.',
      initial_message_template: body.initial_message_template || 'Hi {first_name}, this is {brand_name}. We noticed you expressed interest in booking an appointment.',
      description: body.description || null,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workflow, error } = await (supabase as any)
      .from('workflows')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(workflow, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
