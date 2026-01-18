/**
 * Google OAuth Initiation
 * GET /api/auth/google?clientId=xxx
 *
 * Redirects user to Google OAuth consent screen
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleCalendarProvider } from '@/lib/calendar'

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json(
      { error: 'clientId is required' },
      { status: 400 }
    )
  }

  try {
    const provider = new GoogleCalendarProvider()
    const authUrl = provider.getAuthUrl(clientId)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Failed to initiate Google OAuth:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Google OAuth. Check server configuration.' },
      { status: 500 }
    )
  }
}
