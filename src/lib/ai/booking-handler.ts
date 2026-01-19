/**
 * Booking Handler
 * Manages the appointment booking flow within conversations
 */

import { createClient } from '@/lib/supabase/server'
import {
  getCalendarConnectionForClient,
  getAvailableSlots,
  parseTimeSelection,
  TimeSlot,
} from '@/lib/calendar'
import { Contact, Workflow, Client, BusinessHours } from '@/types/database'

type ContactWithWorkflow = Contact & {
  workflows: Workflow & {
    clients: Client
  }
}

export interface BookingState {
  /** Whether booking flow is active */
  isActive: boolean
  /** Available slots offered to contact */
  offeredSlots: TimeSlot[]
  /** When slots were offered */
  slotsOfferedAt: string | null
  /** Selected slot (if any) */
  selectedSlot: TimeSlot | null
  /** Number of times we've offered slots */
  offerAttempts: number
  /** Last specific slot offered as an alternative (for handling "yeah that works") */
  lastOfferedSlot: TimeSlot | null
}

export interface BookingFlowResult {
  /** Message to send to contact */
  message: string
  /** Updated booking state */
  bookingState: BookingState
  /** Whether an appointment was created */
  appointmentCreated: boolean
  /** Appointment ID if created */
  appointmentId?: string
  /** Whether to continue with normal AI response */
  continueWithAI: boolean
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { start: '09:00', end: '17:00' },
  tuesday: { start: '09:00', end: '17:00' },
  wednesday: { start: '09:00', end: '17:00' },
  thursday: { start: '09:00', end: '17:00' },
  friday: { start: '09:00', end: '17:00' },
  saturday: null,
  sunday: null,
}

class BookingHandler {
  /**
   * Check if calendar is connected for a client
   */
  async isCalendarConnected(clientId: string): Promise<boolean> {
    const connection = await getCalendarConnectionForClient(clientId)
    return connection !== null
  }

  /**
   * Handle booking interest - offer available time slots
   */
  async offerTimeSlots(
    contact: ContactWithWorkflow,
    bookingState: BookingState
  ): Promise<BookingFlowResult> {
    const client = contact.workflows.clients
    const connection = await getCalendarConnectionForClient(client.id)

    if (!connection) {
      // No calendar connected - can't offer slots
      return {
        message: '',
        bookingState,
        appointmentCreated: false,
        continueWithAI: true, // Let AI handle naturally
      }
    }

    try {
      const businessHours = (client.business_hours as BusinessHours) || DEFAULT_BUSINESS_HOURS

      const slots = await getAvailableSlots({
        provider: connection.provider,
        calendarId: connection.connection.calendar_id || 'primary',
        businessHours,
        timezone: client.timezone || 'Europe/London',
        durationMinutes: contact.workflows.appointment_duration_minutes || 30,
        daysAhead: 14,
        maxSlots: 6,
      })

      if (slots.length === 0) {
        return {
          message: "Calendar's pretty packed for the next couple weeks. Want me to have someone reach out to find a time that works?",
          bookingState: {
            ...bookingState,
            isActive: true,
            offerAttempts: bookingState.offerAttempts + 1,
          },
          appointmentCreated: false,
          continueWithAI: false,
        }
      }

      const firstName = contact.first_name || 'there'

      // Build a natural message offering slots
      const message = this.buildSlotOfferMessage(firstName, slots)

      return {
        message,
        bookingState: {
          isActive: true,
          offeredSlots: slots,
          slotsOfferedAt: new Date().toISOString(),
          selectedSlot: null,
          offerAttempts: bookingState.offerAttempts + 1,
          lastOfferedSlot: null, // Clear when offering new set of slots
        },
        appointmentCreated: false,
        continueWithAI: false,
      }
    } catch (error) {
      console.error('Failed to get available slots:', error)
      return {
        message: '',
        bookingState,
        appointmentCreated: false,
        continueWithAI: true, // Let AI handle naturally
      }
    }
  }

  /**
   * Try to parse a time selection from user's message
   */
  async handleTimeSelection(
    contact: ContactWithWorkflow,
    message: string,
    bookingState: BookingState
  ): Promise<BookingFlowResult> {
    if (!bookingState.isActive || bookingState.offeredSlots.length === 0) {
      return {
        message: '',
        bookingState,
        appointmentCreated: false,
        continueWithAI: true,
      }
    }

    // Pass lastOfferedSlot to handle affirmative responses
    const selectedSlot = parseTimeSelection(
      message,
      bookingState.offeredSlots,
      bookingState.lastOfferedSlot || undefined
    )

    if (!selectedSlot) {
      // Check if user requested a specific time that we don't have
      const requestedTime = this.parseRequestedTime(message)

      if (requestedTime) {
        // Find the closest available slot to what they requested
        const closestSlot = this.findClosestSlot(requestedTime, bookingState.offeredSlots)

        if (closestSlot) {
          // Offer the closest alternative and track it
          const alternativeMessage = this.buildAlternativeOfferMessage(
            contact.first_name || 'there',
            requestedTime,
            closestSlot
          )

          return {
            message: alternativeMessage,
            bookingState: {
              ...bookingState,
              lastOfferedSlot: closestSlot, // Track for "yeah that works" responses
            },
            appointmentCreated: false,
            continueWithAI: false,
          }
        }
      }

      // Couldn't parse selection and no clear alternative - let AI continue
      return {
        message: '',
        bookingState,
        appointmentCreated: false,
        continueWithAI: true,
      }
    }

    // Create the appointment
    try {
      const appointment = await this.createAppointment(contact, selectedSlot)
      const confirmationMessage = this.buildConfirmationMessage(
        contact.first_name || 'there',
        selectedSlot
      )

      return {
        message: confirmationMessage,
        bookingState: {
          ...bookingState,
          selectedSlot,
          isActive: false, // Flow complete
          lastOfferedSlot: null,
        },
        appointmentCreated: true,
        appointmentId: appointment.id,
        continueWithAI: false,
      }
    } catch (error) {
      console.error('Failed to create appointment:', error)
      return {
        message: "Hmm, something went wrong on my end. Let me have someone reach out to lock in your appointment.",
        bookingState,
        appointmentCreated: false,
        continueWithAI: false,
      }
    }
  }

  /**
   * Parse the time the user is requesting (even if not available)
   */
  private parseRequestedTime(message: string): { hour: number; minute: number; day?: string } | null {
    const normalized = message.toLowerCase()

    // Extract time patterns
    const timePatterns = [
      /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
      /\bat\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?\b/i,
    ]

    let hour: number | null = null
    let minute = 0

    for (const pattern of timePatterns) {
      const match = normalized.match(pattern)
      if (match) {
        hour = parseInt(match[1], 10)
        minute = match[2] ? parseInt(match[2], 10) : 0
        const meridiem = match[3]?.toLowerCase()

        if (meridiem === 'pm' && hour < 12) {
          hour += 12
        } else if (meridiem === 'am' && hour === 12) {
          hour = 0
        }
        break
      }
    }

    if (hour === null) {
      return null
    }

    // Extract day if mentioned
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const day = dayNames.find(d => normalized.includes(d))

    return { hour, minute, day }
  }

  /**
   * Find the closest available slot to a requested time
   */
  private findClosestSlot(
    requested: { hour: number; minute: number; day?: string },
    slots: TimeSlot[]
  ): TimeSlot | null {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

    // Filter by day if specified
    let candidates = slots
    if (requested.day) {
      candidates = slots.filter(slot => {
        const slotDay = dayNames[slot.start.getDay()]
        return slotDay === requested.day
      })
    }

    if (candidates.length === 0) {
      return null
    }

    // Find slot closest in time
    const requestedMinutes = requested.hour * 60 + requested.minute

    let closest: TimeSlot | null = null
    let closestDiff = Infinity

    for (const slot of candidates) {
      const slotMinutes = slot.start.getHours() * 60 + slot.start.getMinutes()
      const diff = Math.abs(slotMinutes - requestedMinutes)

      if (diff < closestDiff) {
        closestDiff = diff
        closest = slot
      }
    }

    return closest
  }

  /**
   * Build a message offering an alternative when requested time isn't available
   */
  private buildAlternativeOfferMessage(
    firstName: string,
    requested: { hour: number; minute: number; day?: string },
    alternative: TimeSlot
  ): string {
    const requestedTime = this.formatSimpleTime(requested.hour, requested.minute)

    // Get just the time part from the alternative
    const altHour = alternative.start.getHours()
    const altMinute = alternative.start.getMinutes()
    const altTime = this.formatSimpleTime(altHour, altMinute)

    const templates = [
      `${requestedTime} isn't available - closest I've got is ${altTime}. Would that work?`,
      `Unfortunately ${requestedTime} is taken. How about ${altTime} instead?`,
      `I don't have ${requestedTime} open, but ${altTime} works - sound good?`,
    ]

    return templates[Math.floor(Math.random() * templates.length)]
  }

  /**
   * Format hour/minute as simple time string
   */
  private formatSimpleTime(hour: number, minute: number): string {
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    const meridiem = hour >= 12 ? 'pm' : 'am'

    if (minute === 0) {
      return `${displayHour}${meridiem}`
    }
    return `${displayHour}:${minute.toString().padStart(2, '0')}${meridiem}`
  }

  /**
   * Create an appointment in the database and calendar
   */
  private async createAppointment(
    contact: ContactWithWorkflow,
    slot: TimeSlot
  ): Promise<{ id: string; calendarEventId?: string }> {
    const supabase = await createClient()
    const client = contact.workflows.clients

    // Try to create calendar event
    let calendarEventId: string | undefined
    const connection = await getCalendarConnectionForClient(client.id)

    if (connection && connection.connection.calendar_id) {
      try {
        const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Contact'
        const clientTimezone = client.timezone || 'Europe/London'

        console.log('Creating calendar event:', {
          calendarId: connection.connection.calendar_id,
          clientId: client.id,
          contactId: contact.id,
          startTime: slot.start.toISOString(),
          timezone: clientTimezone,
        })

        const event = await connection.provider.createEvent(
          connection.connection.calendar_id,
          {
            summary: `Call with ${client.name}`,
            description: `Booked via BookerBot\n\nContact: ${contactName}\nPhone: ${contact.phone || 'N/A'}\nEmail: ${contact.email || 'N/A'}`,
            start: slot.start,
            end: slot.end,
            attendeeEmail: contact.email || undefined,
            attendeeName: contactName || undefined,
            timeZone: clientTimezone,
          }
        )
        calendarEventId = event.id
        console.log('Calendar event created successfully:', event.id)
      } catch (error) {
        console.error('Failed to create calendar event:', {
          error: error instanceof Error ? error.message : error,
          clientId: client.id,
          contactId: contact.id,
          calendarId: connection.connection.calendar_id,
        })
        // Continue without calendar event - still create DB record
      }
    } else {
      console.log('Skipping calendar event creation:', {
        hasConnection: !!connection,
        hasCalendarId: connection?.connection?.calendar_id,
        clientId: client.id,
      })
    }

    // Create appointment in database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: appointment, error } = await (supabase as any)
      .from('appointments')
      .insert({
        contact_id: contact.id,
        workflow_id: contact.workflow_id,
        client_id: client.id,
        calendar_event_id: calendarEventId || null,
        start_time: slot.start.toISOString(),
        end_time: slot.end.toISOString(),
        status: 'confirmed',
        notes: `Booked automatically via conversation`,
      })
      .select('id')
      .single() as { data: { id: string } | null; error: Error | null }

    if (error || !appointment) {
      throw new Error(`Failed to create appointment: ${error?.message || 'Unknown error'}`)
    }

    // Update contact status to booked
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update({ status: 'booked' })
      .eq('id', contact.id)

    return {
      id: appointment.id,
      calendarEventId,
    }
  }

  /**
   * Build a natural message offering time slots
   * Selects 3-4 diverse options across different days like a human would
   */
  private buildSlotOfferMessage(
    firstName: string,
    slots: TimeSlot[]
  ): string {
    // Select diverse slots across different days (aim for 3-4 options)
    const selectedSlots = this.selectDiverseSlots(slots, 4)

    if (selectedSlots.length === 0) {
      return `${firstName}, let me check on some times and get back to you.`
    }

    // Build a conversational message
    return this.formatSlotsNaturally(firstName, selectedSlots)
  }

  /**
   * Select diverse slots across different days
   * Picks times from different days and varies morning/afternoon
   */
  private selectDiverseSlots(slots: TimeSlot[], maxSlots: number): TimeSlot[] {
    if (slots.length <= maxSlots) {
      return slots
    }

    // Group by day
    const slotsByDay = new Map<string, TimeSlot[]>()
    for (const slot of slots) {
      const dayKey = slot.start.toDateString()
      if (!slotsByDay.has(dayKey)) {
        slotsByDay.set(dayKey, [])
      }
      slotsByDay.get(dayKey)!.push(slot)
    }

    const selected: TimeSlot[] = []
    const days = Array.from(slotsByDay.keys())

    // Strategy: Pick 1-2 slots from each day, preferring variety
    // Try to get morning and afternoon options
    for (const day of days) {
      if (selected.length >= maxSlots) break

      const daySlots = slotsByDay.get(day)!

      // Separate into morning (before 12pm) and afternoon
      const morning = daySlots.filter(s => s.start.getHours() < 12)
      const afternoon = daySlots.filter(s => s.start.getHours() >= 12)

      // Pick one from each period if available, otherwise just pick one
      if (morning.length > 0 && selected.length < maxSlots) {
        // Pick a mid-morning slot if multiple options
        const midIdx = Math.floor(morning.length / 2)
        selected.push(morning[midIdx])
      }
      if (afternoon.length > 0 && selected.length < maxSlots) {
        // Pick an early afternoon slot if multiple options
        const midIdx = Math.floor(afternoon.length / 2)
        selected.push(afternoon[midIdx])
      }
      if (morning.length === 0 && afternoon.length === 0 && daySlots.length > 0) {
        selected.push(daySlots[0])
      }
    }

    return selected
  }

  /**
   * Format slots in a conversational way like a human would
   */
  private formatSlotsNaturally(firstName: string, slots: TimeSlot[]): string {
    // Group by day for natural phrasing
    const slotsByDay = new Map<string, TimeSlot[]>()
    for (const slot of slots) {
      const dayKey = slot.start.toDateString()
      if (!slotsByDay.has(dayKey)) {
        slotsByDay.set(dayKey, [])
      }
      slotsByDay.get(dayKey)!.push(slot)
    }

    // Build day phrases like "Monday at 10 or 2"
    const dayPhrases: string[] = []

    Array.from(slotsByDay.values()).forEach((daySlots) => {
      // Get day name from first slot
      const dayName = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(daySlots[0].start)

      // Format times simply
      const times = daySlots.map(s => {
        const hour = s.start.getHours()
        const minute = s.start.getMinutes()
        if (minute === 0) {
          return hour >= 12 ? `${hour === 12 ? 12 : hour - 12}pm` : `${hour}am`
        }
        const displayHour = hour >= 12 ? (hour === 12 ? 12 : hour - 12) : hour
        const meridiem = hour >= 12 ? 'pm' : 'am'
        return `${displayHour}:${minute.toString().padStart(2, '0')}${meridiem}`
      })

      if (times.length === 1) {
        dayPhrases.push(`${dayName} at ${times[0]}`)
      } else {
        dayPhrases.push(`${dayName} at ${times.join(' or ')}`)
      }
    })

    // Combine into natural sentence
    let timeOptions: string
    if (dayPhrases.length === 1) {
      timeOptions = dayPhrases[0]
    } else if (dayPhrases.length === 2) {
      timeOptions = `${dayPhrases[0]} or ${dayPhrases[1]}`
    } else {
      const last = dayPhrases.pop()
      timeOptions = `${dayPhrases.join(', ')}, or ${last}`
    }

    // Vary the phrasing
    const templates = [
      `${firstName}, does ${timeOptions} work for you?`,
      `How about ${timeOptions}? Any of those work?`,
      `I've got ${timeOptions} open - any of those suit you?`,
    ]

    return templates[Math.floor(Math.random() * templates.length)]
  }

  /**
   * Build a confirmation message after booking
   */
  private buildConfirmationMessage(firstName: string, slot: TimeSlot): string {
    const confirmations = [
      `Done - you're booked for ${slot.formatted}. Calendar invite coming your way.`,
      `Locked in for ${slot.formatted}, ${firstName}. You'll get a calendar invite shortly.`,
      `${slot.formatted} it is. I'll send over a calendar invite now.`,
    ]
    return confirmations[Math.floor(Math.random() * confirmations.length)]
  }

  /**
   * Initialize empty booking state
   */
  createEmptyState(): BookingState {
    return {
      isActive: false,
      offeredSlots: [],
      slotsOfferedAt: null,
      selectedSlot: null,
      offerAttempts: 0,
      lastOfferedSlot: null,
    }
  }

  /**
   * Serialize booking state for storage in conversation context
   */
  serializeState(state: BookingState): Record<string, unknown> {
    return {
      isActive: state.isActive,
      offeredSlots: state.offeredSlots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        formatted: s.formatted,
      })),
      slotsOfferedAt: state.slotsOfferedAt,
      selectedSlot: state.selectedSlot
        ? {
            start: state.selectedSlot.start.toISOString(),
            end: state.selectedSlot.end.toISOString(),
            formatted: state.selectedSlot.formatted,
          }
        : null,
      offerAttempts: state.offerAttempts,
      lastOfferedSlot: state.lastOfferedSlot
        ? {
            start: state.lastOfferedSlot.start.toISOString(),
            end: state.lastOfferedSlot.end.toISOString(),
            formatted: state.lastOfferedSlot.formatted,
          }
        : null,
    }
  }

  /**
   * Deserialize booking state from conversation context
   */
  deserializeState(data: Record<string, unknown> | undefined): BookingState {
    if (!data) {
      return this.createEmptyState()
    }

    const parseSlot = (s: { start: string; end: string; formatted: string }): TimeSlot => ({
      start: new Date(s.start),
      end: new Date(s.end),
      formatted: s.formatted,
    })

    return {
      isActive: Boolean(data.isActive),
      offeredSlots: Array.isArray(data.offeredSlots)
        ? data.offeredSlots.map(parseSlot)
        : [],
      slotsOfferedAt: (data.slotsOfferedAt as string) || null,
      selectedSlot: data.selectedSlot
        ? parseSlot(data.selectedSlot as { start: string; end: string; formatted: string })
        : null,
      offerAttempts: (data.offerAttempts as number) || 0,
      lastOfferedSlot: data.lastOfferedSlot
        ? parseSlot(data.lastOfferedSlot as { start: string; end: string; formatted: string })
        : null,
    }
  }
}

export const bookingHandler = new BookingHandler()
