/**
 * Google Calendar Provider
 * Implements CalendarProvider interface for Google Calendar API
 */

import {
  CalendarProvider,
  CalendarProviderType,
  TokenSet,
  Calendar,
  BusySlot,
  EventInput,
  CalendarEvent,
} from '../types'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

export class GoogleCalendarProvider implements CalendarProvider {
  readonly providerType: CalendarProviderType = 'google'
  private tokens: TokenSet | null = null

  private get clientId(): string {
    const id = process.env.GOOGLE_CLIENT_ID
    if (!id) throw new Error('GOOGLE_CLIENT_ID not configured')
    return id
  }

  private get clientSecret(): string {
    const secret = process.env.GOOGLE_CLIENT_SECRET
    if (!secret) throw new Error('GOOGLE_CLIENT_SECRET not configured')
    return secret
  }

  private get redirectUri(): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not configured')
    return `${appUrl}/api/auth/google/callback`
  }

  /**
   * Generate Google OAuth authorization URL
   */
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent', // Force consent to get refresh token
      state,
    })
    return `${GOOGLE_AUTH_URL}?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<TokenSet> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to exchange code: ${error}`)
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
    }
  }

  /**
   * Refresh expired access token
   */
  async refreshTokens(refreshToken: string): Promise<TokenSet> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to refresh token: ${error}`)
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Google may not return new refresh token
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
    }
  }

  /**
   * Set tokens for authenticated requests
   */
  setTokens(tokens: TokenSet): void {
    this.tokens = tokens
  }

  /**
   * Make authenticated request to Google Calendar API
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.tokens) {
      throw new Error('Tokens not set. Call setTokens() first.')
    }

    const response = await fetch(`${GOOGLE_CALENDAR_API}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google Calendar API error: ${error}`)
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  /**
   * List all calendars the user has access to
   */
  async listCalendars(): Promise<Calendar[]> {
    const data = await this.apiRequest<{
      items: Array<{
        id: string
        summary: string
        primary?: boolean
        timeZone?: string
      }>
    }>('/users/me/calendarList')

    return data.items.map((cal) => ({
      id: cal.id,
      name: cal.summary,
      primary: cal.primary || false,
      timeZone: cal.timeZone,
    }))
  }

  /**
   * Get busy times for a calendar in a date range
   */
  async getFreeBusy(
    calendarId: string,
    start: Date,
    end: Date
  ): Promise<BusySlot[]> {
    const data = await this.apiRequest<{
      calendars: {
        [key: string]: {
          busy: Array<{ start: string; end: string }>
        }
      }
    }>('/freeBusy', {
      method: 'POST',
      body: JSON.stringify({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: calendarId }],
      }),
    })

    const busyTimes = data.calendars[calendarId]?.busy || []
    return busyTimes.map((slot) => ({
      start: new Date(slot.start),
      end: new Date(slot.end),
    }))
  }

  /**
   * Create a calendar event
   */
  async createEvent(
    calendarId: string,
    event: EventInput
  ): Promise<CalendarEvent> {
    const attendees = event.attendeeEmail
      ? [{ email: event.attendeeEmail, displayName: event.attendeeName }]
      : undefined

    const data = await this.apiRequest<{
      id: string
      summary: string
      description?: string
      start: { dateTime: string }
      end: { dateTime: string }
      htmlLink?: string
    }>(`/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
        attendees,
        reminders: {
          useDefault: true,
        },
      }),
    })

    return {
      id: data.id,
      summary: data.summary,
      description: data.description,
      start: new Date(data.start.dateTime),
      end: new Date(data.end.dateTime),
      htmlLink: data.htmlLink,
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: EventInput
  ): Promise<CalendarEvent> {
    const data = await this.apiRequest<{
      id: string
      summary: string
      description?: string
      start: { dateTime: string }
      end: { dateTime: string }
      htmlLink?: string
    }>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.start.toISOString() },
          end: { dateTime: event.end.toISOString() },
        }),
      }
    )

    return {
      id: data.id,
      summary: data.summary,
      description: data.description,
      start: new Date(data.start.dateTime),
      end: new Date(data.end.dateTime),
      htmlLink: data.htmlLink,
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.apiRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' }
    )
  }
}
