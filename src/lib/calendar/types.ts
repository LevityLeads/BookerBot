/**
 * Calendar Integration Types
 * Provider-agnostic interfaces for calendar operations
 */

export type CalendarProviderType = 'google' | 'outlook'

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: Date | null
}

export interface Calendar {
  id: string
  name: string
  primary: boolean
  timeZone?: string
}

export interface BusySlot {
  start: Date
  end: Date
}

export interface TimeSlot {
  start: Date
  end: Date
  formatted: string // e.g., "Monday Jan 20 at 2:00 PM"
}

export interface EventInput {
  summary: string
  description?: string
  start: Date
  end: Date
  attendeeEmail?: string
  attendeeName?: string
  timeZone?: string
  addGoogleMeet?: boolean
}

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: Date
  end: Date
  htmlLink?: string
}

/**
 * Abstract interface that all calendar providers must implement
 */
export interface CalendarProvider {
  readonly providerType: CalendarProviderType

  // OAuth
  getAuthUrl(state: string): string
  exchangeCodeForTokens(code: string): Promise<TokenSet>
  refreshTokens(refreshToken: string): Promise<TokenSet>

  // Calendar operations (require tokens to be set)
  setTokens(tokens: TokenSet): void
  listCalendars(): Promise<Calendar[]>
  getFreeBusy(calendarId: string, start: Date, end: Date): Promise<BusySlot[]>
  createEvent(calendarId: string, event: EventInput): Promise<CalendarEvent>
  updateEvent(calendarId: string, eventId: string, event: EventInput): Promise<CalendarEvent>
  deleteEvent(calendarId: string, eventId: string): Promise<void>
}
