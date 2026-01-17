import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface UpdateWorkflowBody {
  name?: string
  channel?: 'sms' | 'whatsapp' | 'email'
  status?: 'active' | 'paused' | 'archived'
  instructions?: string
  qualification_criteria?: string
  initial_message_template?: string
  description?: string
}

// GET /api/workflows/[id] - Get a single workflow
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Auth disabled for now
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: workflow, error } = await supabase
    .from('workflows')
    .select('*, clients(name, brand_name)')
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(workflow)
}

// PUT /api/workflows/[id] - Update a workflow
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Auth disabled for now
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  try {
    const body = await request.json() as UpdateWorkflowBody

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.channel !== undefined) updateData.channel = body.channel
    if (body.status !== undefined) updateData.status = body.status
    if (body.instructions !== undefined) updateData.instructions = body.instructions
    if (body.qualification_criteria !== undefined) updateData.qualification_criteria = body.qualification_criteria
    if (body.initial_message_template !== undefined) updateData.initial_message_template = body.initial_message_template
    if (body.description !== undefined) updateData.description = body.description

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workflow, error } = await (supabase as any)
      .from('workflows')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(workflow)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

// DELETE /api/workflows/[id] - Delete a workflow
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Auth disabled for now
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
