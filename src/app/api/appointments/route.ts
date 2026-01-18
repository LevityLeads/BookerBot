/**
 * Appointments API
 * GET /api/appointments - List appointments with filtering
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const searchParams = request.nextUrl.searchParams
  const clientId = searchParams.get('client_id')
  const workflowId = searchParams.get('workflow_id')
  const contactId = searchParams.get('contact_id')
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('appointments')
    .select(`
      *,
      contacts (
        id,
        first_name,
        last_name,
        phone,
        email
      ),
      workflows (
        id,
        name
      ),
      clients (
        id,
        name,
        brand_name
      )
    `)
    .order('start_time', { ascending: false })
    .range(offset, offset + limit - 1)

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  if (workflowId) {
    query = query.eq('workflow_id', workflowId)
  }

  if (contactId) {
    query = query.eq('contact_id', contactId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
