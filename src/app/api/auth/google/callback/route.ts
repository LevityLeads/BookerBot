/**
 * Google OAuth Callback
 * GET /api/auth/google/callback?code=xxx&state=clientId
 *
 * Exchanges code for tokens, stores connection, redirects to success page
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleCalendarProvider } from '@/lib/calendar'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') // clientId
  const error = request.nextUrl.searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  // Handle OAuth errors (user denied, etc.)
  if (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(
      `${appUrl}/connect/calendar/error?reason=${encodeURIComponent(error)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/connect/calendar/error?reason=missing_params`
    )
  }

  const clientId = state

  try {
    // Verify client exists
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: client, error: clientError } = await (supabase as any)
      .from('clients')
      .select('id, name, brand_name')
      .eq('id', clientId)
      .single() as { data: { id: string; name: string; brand_name: string | null } | null; error: Error | null }

    if (clientError || !client) {
      console.error('Client not found:', clientId)
      return NextResponse.redirect(
        `${appUrl}/connect/calendar/error?reason=invalid_client`
      )
    }

    // Exchange code for tokens
    const provider = new GoogleCalendarProvider()
    const tokens = await provider.exchangeCodeForTokens(code)

    // Get primary calendar
    provider.setTokens(tokens)
    const calendars = await provider.listCalendars()
    const primaryCalendar = calendars.find((c) => c.primary) || calendars[0]

    if (!primaryCalendar) {
      return NextResponse.redirect(
        `${appUrl}/connect/calendar/error?reason=no_calendars`
      )
    }

    // Check if connection already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingConnection } = await (supabase as any)
      .from('calendar_connections')
      .select('id')
      .eq('client_id', clientId)
      .single() as { data: { id: string } | null }

    if (existingConnection) {
      // Update existing connection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('calendar_connections')
        .update({
          provider: 'google',
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt?.toISOString() || null,
          calendar_id: primaryCalendar.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id)
    } else {
      // Create new connection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('calendar_connections').insert({
        client_id: clientId,
        provider: 'google',
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: tokens.expiresAt?.toISOString() || null,
        calendar_id: primaryCalendar.id,
      })
    }

    // Redirect to success page
    return NextResponse.redirect(
      `${appUrl}/connect/calendar/success?client=${encodeURIComponent(client.brand_name || client.name)}`
    )
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(
      `${appUrl}/connect/calendar/error?reason=exchange_failed`
    )
  }
}
