/**
 * Single Appointment API
 * GET /api/appointments/[id] - Get appointment details
 * PUT /api/appointments/[id] - Update appointment status
 * DELETE /api/appointments/[id] - Cancel appointment
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getCalendarConnectionForClient } from '@/lib/calendar'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
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
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const body = await request.json()

  const allowedUpdates = ['status', 'notes']
  const updateData: Record<string, unknown> = {}

  for (const key of allowedUpdates) {
    if (body[key] !== undefined) {
      updateData[key] = body[key]
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('appointments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()

  // First get the appointment to find calendar event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appointment, error: fetchError } = await (supabase as any)
    .from('appointments')
    .select('*, clients(id)')
    .eq('id', id)
    .single() as { data: { calendar_event_id: string | null; client_id: string; clients: { id: string } } | null; error: Error | null }

  if (fetchError || !appointment) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  // Try to delete calendar event if it exists
  if (appointment.calendar_event_id) {
    try {
      const calendarConnection = await getCalendarConnectionForClient(appointment.client_id)
      if (calendarConnection && calendarConnection.connection.calendar_id) {
        await calendarConnection.provider.deleteEvent(
          calendarConnection.connection.calendar_id,
          appointment.calendar_event_id
        )
      }
    } catch (err) {
      console.error('Failed to delete calendar event:', err)
      // Continue with DB deletion even if calendar delete fails
    }
  }

  // Update status to cancelled instead of hard delete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
