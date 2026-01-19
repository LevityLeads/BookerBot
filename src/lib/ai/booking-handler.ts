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
  /** Whether this is a reschedule (not new booking) */
  isRescheduling: boolean
  /** Existing appointment ID being rescheduled */
  existingAppointmentId: string | null
  /** Existing calendar event ID being rescheduled */
  existingCalendarEventId: string | null
}

export interface BookingFlowResult {
  /** Message to send to contact */
  message: string
  /** Updated booking state */
  bookingState: BookingState
  /** Whether an appointment was created */
  appointmentCreated: boolean
  /** Whether an appointment was rescheduled */
  appointmentRescheduled: boolean
  /** Appointment ID if created or rescheduled */
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

/**
 * Day name variations - maps common abbreviations and variations to canonical day names
 */
const DAY_VARIATIONS: Record<string, string> = {
  // Monday
  'monday': 'monday',
  'mon': 'monday',
  // Tuesday
  'tuesday': 'tuesday',
  'tue': 'tuesday',
  'tues': 'tuesday',
  // Wednesday
  'wednesday': 'wednesday',
  'wed': 'wednesday',
  'weds': 'wednesday',
  'wednes': 'wednesday',
  // Thursday
  'thursday': 'thursday',
  'thu': 'thursday',
  'thur': 'thursday',
  'thurs': 'thursday',
  // Friday
  'friday': 'friday',
  'fri': 'friday',
  // Saturday
  'saturday': 'saturday',
  'sat': 'saturday',
  // Sunday
  'sunday': 'sunday',
  'sun': 'sunday',
}

/**
 * Extract canonical day name from message text
 * Handles full names, abbreviations, and common variations
 */
function extractDayFromMessage(message: string): string | null {
  const normalized = message.toLowerCase()

  // Check for "tomorrow" and "today" first
  if (/\btomorrow\b/.test(normalized)) return 'tomorrow'
  if (/\btoday\b/.test(normalized)) return 'today'

  // Sort by length descending to match longer patterns first (e.g., "wednesday" before "wed")
  const sortedVariations = Object.keys(DAY_VARIATIONS).sort((a, b) => b.length - a.length)

  for (const variation of sortedVariations) {
    // Use word boundary to avoid matching partial words
    const pattern = new RegExp(`\\b${variation}\\b`, 'i')
    if (pattern.test(normalized)) {
      return DAY_VARIATIONS[variation]
    }
  }

  return null
}

class BookingHandler {
  /**
   * Check if calendar is connected for a client
   */
  async isCalendarConnected(clientId: string): Promise<boolean> {
    console.log('[BookingHandler] Checking calendar connection for client:', clientId)
    const connection = await getCalendarConnectionForClient(clientId)
    console.log('[BookingHandler] Calendar connection result:', {
      clientId,
      hasConnection: !!connection,
      calendarId: connection?.connection?.calendar_id || 'N/A',
    })
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
    console.log('[BookingHandler] offerTimeSlots called:', {
      contactId: contact.id,
      clientId: client.id,
      contactEmail: contact.email || 'NO EMAIL',
    })

    const connection = await getCalendarConnectionForClient(client.id)

    if (!connection) {
      console.log('[BookingHandler] No calendar connection found - skipping slot offer')
      // No calendar connected - can't offer slots
      return {
        message: '',
        bookingState,
        appointmentCreated: false,
        appointmentRescheduled: false,
        continueWithAI: true, // Let AI handle naturally
      }
    }

    try {
      const businessHours = (client.business_hours as BusinessHours) || DEFAULT_BUSINESS_HOURS

      console.log('[BookingHandler] Fetching available slots:', {
        calendarId: connection.connection.calendar_id || 'primary',
        timezone: client.timezone || 'Europe/London',
        durationMinutes: contact.workflows.appointment_duration_minutes || 30,
      })

      const slots = await getAvailableSlots({
        provider: connection.provider,
        calendarId: connection.connection.calendar_id || 'primary',
        businessHours,
        timezone: client.timezone || 'Europe/London',
        durationMinutes: contact.workflows.appointment_duration_minutes || 30,
        daysAhead: 14,
        maxSlots: 6,
      })

      console.log('[BookingHandler] Available slots found:', slots.length)

      if (slots.length === 0) {
        return {
          message: "Calendar's pretty packed for the next couple weeks. Want me to have someone reach out to find a time that works?",
          bookingState: {
            ...bookingState,
            isActive: true,
            offerAttempts: bookingState.offerAttempts + 1,
          },
          appointmentCreated: false,
          appointmentRescheduled: false,
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
          isRescheduling: false,
          existingAppointmentId: null,
          existingCalendarEventId: null,
        },
        appointmentCreated: false,
        appointmentRescheduled: false,
        continueWithAI: false,
      }
    } catch (error) {
      console.error('Failed to get available slots:', error)
      return {
        message: '',
        bookingState,
        appointmentCreated: false,
        appointmentRescheduled: false,
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
        appointmentRescheduled: false,
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
            appointmentRescheduled: false,
            continueWithAI: false,
          }
        }
      }

      // Check if user mentioned a day without a specific time
      const dayOnly = this.parseDayOnly(message)
      if (dayOnly) {
        const slotsOnDay = this.filterSlotsByDay(dayOnly, bookingState.offeredSlots)
        if (slotsOnDay.length > 0) {
          // Ask them to pick a specific time on that day
          const dayOfferMessage = this.buildDayTimesMessage(
            contact.first_name || 'there',
            dayOnly,
            slotsOnDay
          )
          return {
            message: dayOfferMessage,
            bookingState: {
              ...bookingState,
              // If only one slot on that day, set it as lastOfferedSlot for "yes" response
              lastOfferedSlot: slotsOnDay.length === 1 ? slotsOnDay[0] : null,
            },
            appointmentCreated: false,
            appointmentRescheduled: false,
            continueWithAI: false,
          }
        } else {
          // No slots on that day - offer alternatives
          const noSlotsMessage = this.buildNoSlotsOnDayMessage(
            contact.first_name || 'there',
            dayOnly,
            bookingState.offeredSlots
          )
          return {
            message: noSlotsMessage,
            bookingState,
            appointmentCreated: false,
            appointmentRescheduled: false,
            continueWithAI: false,
          }
        }
      }

      // Check for affirmative response without lastOfferedSlot
      const isAffirmative = this.isAffirmativeResponse(message)
      if (isAffirmative && bookingState.offeredSlots.length > 0) {
        // They said "yes" or "sounds good" but we don't know which slot
        // Ask them to clarify
        const clarifyMessage = this.buildClarifySlotMessage(
          contact.first_name || 'there',
          bookingState.offeredSlots
        )
        return {
          message: clarifyMessage,
          bookingState,
          appointmentCreated: false,
          appointmentRescheduled: false,
          continueWithAI: false,
        }
      }

      // Couldn't parse selection and no clear alternative - let AI continue
      // BUT flag that we're in booking mode so AI doesn't confirm a booking
      return {
        message: '',
        bookingState,
        appointmentCreated: false,
        appointmentRescheduled: false,
        continueWithAI: true,
      }
    }

    // Create or reschedule the appointment
    const isRescheduling = bookingState.isRescheduling
    console.log(`[BookingHandler] ${isRescheduling ? 'Rescheduling' : 'Creating'} appointment for slot:`, {
      contactId: contact.id,
      contactEmail: contact.email || 'NO EMAIL - INVITE WILL NOT BE SENT',
      slotStart: selectedSlot.start.toISOString(),
      slotFormatted: selectedSlot.formatted,
      isRescheduling,
      existingAppointmentId: bookingState.existingAppointmentId,
    })
    try {
      const appointment = await this.createAppointment(
        contact,
        selectedSlot,
        bookingState.existingAppointmentId,
        bookingState.existingCalendarEventId
      )
      const confirmationMessage = isRescheduling
        ? this.buildRescheduleConfirmationMessage(contact.first_name || 'there', selectedSlot)
        : this.buildConfirmationMessage(contact.first_name || 'there', selectedSlot)

      return {
        message: confirmationMessage,
        bookingState: {
          ...bookingState,
          selectedSlot,
          isActive: false, // Flow complete
          lastOfferedSlot: null,
        },
        appointmentCreated: !bookingState.isRescheduling,
        appointmentRescheduled: bookingState.isRescheduling,
        appointmentId: appointment.id,
        continueWithAI: false,
      }
    } catch (error) {
      console.error('Failed to create appointment:', error)
      return {
        message: "Hmm, something went wrong on my end. Let me have someone reach out to lock in your appointment.",
        bookingState,
        appointmentCreated: false,
        appointmentRescheduled: false,
        continueWithAI: false,
      }
    }
  }

  /**
   * Parse the time the user is requesting (even if not available)
   * Handles day abbreviations (e.g., "weds at 3pm", "thurs 2pm")
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

    // Extract day if mentioned (using centralized function that handles abbreviations)
    const day = extractDayFromMessage(message)

    // Only include day if it's an actual day name (not "tomorrow"/"today" - those are handled separately)
    const canonicalDay = day && day !== 'tomorrow' && day !== 'today' ? day : undefined

    return { hour, minute, day: canonicalDay }
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
   * Parse if user only mentioned a day without a specific time
   * Handles full day names and abbreviations (e.g., "weds", "thurs", "fri")
   */
  private parseDayOnly(message: string): string | null {
    const normalized = message.toLowerCase()

    // Use the centralized day extraction that handles abbreviations
    const mentionedDay = extractDayFromMessage(message)
    if (!mentionedDay) {
      return null
    }

    // Check if they also included a specific time - if so, this isn't day-only
    const hasTime = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(normalized) ||
                   /\bat\s+\d{1,2}\b/i.test(normalized)

    if (hasTime) {
      return null // They specified a time, not day-only
    }

    return mentionedDay
  }

  /**
   * Filter slots to a specific day
   */
  private filterSlotsByDay(day: string, slots: TimeSlot[]): TimeSlot[] {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

    if (day === 'tomorrow') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return slots.filter(slot =>
        slot.start.toDateString() === tomorrow.toDateString()
      )
    }

    if (day === 'today') {
      const today = new Date()
      return slots.filter(slot =>
        slot.start.toDateString() === today.toDateString()
      )
    }

    return slots.filter(slot => {
      const slotDay = dayNames[slot.start.getDay()]
      return slotDay === day
    })
  }

  /**
   * Build message asking for specific time on a day
   */
  private buildDayTimesMessage(firstName: string, day: string, slots: TimeSlot[]): string {
    const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1)

    const times = slots.map(s => {
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
      return `${dayCapitalized} works - I've got ${times[0]}. Does that time work for you?`
    }

    const timeList = times.slice(0, -1).join(', ') + ' or ' + times[times.length - 1]

    const templates = [
      `${dayCapitalized} works - what time? I've got ${timeList}.`,
      `I can do ${dayCapitalized} at ${timeList}. Which works better?`,
      `${dayCapitalized} it is. I have ${timeList} open - which one?`,
    ]

    return templates[Math.floor(Math.random() * templates.length)]
  }

  /**
   * Build message when requested day has no slots
   */
  private buildNoSlotsOnDayMessage(firstName: string, day: string, slots: TimeSlot[]): string {
    const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1)

    // Get unique days from available slots
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const availableDays = Array.from(new Set(slots.map(s => dayNames[s.start.getDay()])))

    if (availableDays.length === 1) {
      return `${dayCapitalized} is fully booked - I've only got ${availableDays[0]} open. Would that work?`
    }

    const dayList = availableDays.slice(0, 3).join(' or ')
    return `${dayCapitalized} is packed. How about ${dayList} instead?`
  }

  /**
   * Check if message is an affirmative response
   */
  private isAffirmativeResponse(message: string): boolean {
    const normalized = message.toLowerCase().trim()
    const affirmativePatterns = [
      /^(yes|yeah|yep|yup|sure|ok|okay|sounds good|that works|perfect|great|fine)$/i,
      /^(yes|yeah|yep|yup|sure|ok|okay)[,!.]?\s*(that|it)?\s*(works|sounds good)?/i,
      /that\s*(works|sounds good|'?s good|'?s fine|'?s perfect)/i,
      /^(sounds?|looks?)\s+(good|great|fine|perfect)/i,
      /^(let'?s|i'?ll)\s+(do|take|book)\s+(it|that|this)/i,
    ]

    return affirmativePatterns.some(pattern => pattern.test(normalized))
  }

  /**
   * Build message asking to clarify which slot
   */
  private buildClarifySlotMessage(firstName: string, slots: TimeSlot[]): string {
    // Get a sample of available times
    const sampleSlots = slots.slice(0, 3)
    const times = sampleSlots.map(s => s.formatted.split(' at ')[1] || s.formatted)

    const templates = [
      `Which time works for you? I've got ${times.join(', ')} available.`,
      `Just to confirm - which slot? ${times.join(', ')}?`,
      `Which one? I have ${times.join(', ')}.`,
    ]

    return templates[Math.floor(Math.random() * templates.length)]
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
   * Create or reschedule an appointment in the database and calendar
   */
  private async createAppointment(
    contact: ContactWithWorkflow,
    slot: TimeSlot,
    existingAppointmentId?: string | null,
    existingCalendarEventId?: string | null
  ): Promise<{ id: string; calendarEventId?: string }> {
    const supabase = await createClient()
    const client = contact.workflows.clients
    const isReschedule = !!existingAppointmentId

    // Try to create/update calendar event
    let calendarEventId: string | undefined = existingCalendarEventId || undefined
    const connection = await getCalendarConnectionForClient(client.id)

    if (connection && connection.connection.calendar_id) {
      try {
        const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Contact'
        const clientTimezone = client.timezone || 'Europe/London'

        if (isReschedule && existingCalendarEventId) {
          // Update existing calendar event
          console.log('Updating calendar event:', {
            eventId: existingCalendarEventId,
            calendarId: connection.connection.calendar_id,
            clientId: client.id,
            contactId: contact.id,
            newStartTime: slot.start.toISOString(),
            timezone: clientTimezone,
          })

          const event = await connection.provider.updateEvent(
            connection.connection.calendar_id,
            existingCalendarEventId,
            {
              summary: `Call with ${client.name}`,
              description: `Contact: ${contactName}\nPhone: ${contact.phone || 'N/A'}\nEmail: ${contact.email || 'N/A'}`,
              start: slot.start,
              end: slot.end,
              attendeeEmail: contact.email || undefined,
              attendeeName: contactName || undefined,
              timeZone: clientTimezone,
            }
          )
          calendarEventId = event.id
          console.log('Calendar event updated successfully:', event.id)
        } else {
          // Create new calendar event
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
              description: `Contact: ${contactName}\nPhone: ${contact.phone || 'N/A'}\nEmail: ${contact.email || 'N/A'}`,
              start: slot.start,
              end: slot.end,
              attendeeEmail: contact.email || undefined,
              attendeeName: contactName || undefined,
              timeZone: clientTimezone,
              addGoogleMeet: true,
            }
          )
          calendarEventId = event.id
          console.log('Calendar event created successfully:', event.id)
        }
      } catch (error) {
        console.error('Failed to create/update calendar event:', {
          error: error instanceof Error ? error.message : error,
          clientId: client.id,
          contactId: contact.id,
          calendarId: connection.connection.calendar_id,
          isReschedule,
        })
        // Continue without calendar event - still update DB record
      }
    } else {
      console.log('Skipping calendar event creation:', {
        hasConnection: !!connection,
        hasCalendarId: connection?.connection?.calendar_id,
        clientId: client.id,
      })
    }

    let appointmentId: string

    if (isReschedule && existingAppointmentId) {
      // Update existing appointment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('appointments')
        .update({
          start_time: slot.start.toISOString(),
          end_time: slot.end.toISOString(),
          calendar_event_id: calendarEventId || null,
          notes: `Rescheduled automatically via conversation`,
        })
        .eq('id', existingAppointmentId)

      if (error) {
        throw new Error(`Failed to reschedule appointment: ${error.message}`)
      }
      appointmentId = existingAppointmentId
      console.log('Appointment rescheduled successfully:', appointmentId)
    } else {
      // Create new appointment in database
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
      appointmentId = appointment.id
    }

    // Update contact status to booked
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update({ status: 'booked' })
      .eq('id', contact.id)

    return {
      id: appointmentId,
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
   * Build a confirmation message after rescheduling
   */
  private buildRescheduleConfirmationMessage(firstName: string, slot: TimeSlot): string {
    const confirmations = [
      `Done - I've moved your appointment to ${slot.formatted}. Updated invite on its way.`,
      `All sorted, ${firstName}. You're now booked for ${slot.formatted}.`,
      `Changed to ${slot.formatted}. I'll send you an updated calendar invite.`,
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
      isRescheduling: false,
      existingAppointmentId: null,
      existingCalendarEventId: null,
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
      isRescheduling: state.isRescheduling,
      existingAppointmentId: state.existingAppointmentId,
      existingCalendarEventId: state.existingCalendarEventId,
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
      isRescheduling: Boolean(data.isRescheduling),
      existingAppointmentId: (data.existingAppointmentId as string) || null,
      existingCalendarEventId: (data.existingCalendarEventId as string) || null,
    }
  }

  /**
   * Start the reschedule flow - find existing appointment and offer new slots
   * @param message - The user's reschedule request message (used to extract day preference)
   */
  async startReschedule(
    contact: ContactWithWorkflow,
    bookingState: BookingState,
    message?: string
  ): Promise<BookingFlowResult> {
    const client = contact.workflows.clients
    const supabase = await createClient()

    // Extract day preference from the reschedule request (e.g., "Can we reschedule to Tuesday?")
    const preferredDay = message ? extractDayFromMessage(message) : null

    console.log('[BookingHandler] startReschedule called:', {
      contactId: contact.id,
      clientId: client.id,
      preferredDay,
    })

    // Find the existing appointment for this contact
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingAppointment, error: appointmentError } = await (supabase as any)
      .from('appointments')
      .select('id, calendar_event_id, start_time')
      .eq('contact_id', contact.id)
      .eq('status', 'confirmed')
      .order('start_time', { ascending: false })
      .limit(1)
      .single()

    if (appointmentError || !existingAppointment) {
      console.log('[BookingHandler] No existing appointment found for reschedule:', appointmentError?.message)
      return {
        message: "I don't see an existing booking for you. Would you like to schedule a new appointment?",
        bookingState,
        appointmentCreated: false,
        appointmentRescheduled: false,
        continueWithAI: false,
      }
    }

    console.log('[BookingHandler] Found existing appointment:', {
      appointmentId: existingAppointment.id,
      calendarEventId: existingAppointment.calendar_event_id,
      currentStartTime: existingAppointment.start_time,
    })

    const connection = await getCalendarConnectionForClient(client.id)

    if (!connection) {
      console.log('[BookingHandler] No calendar connection found - cannot reschedule')
      return {
        message: "I can't reschedule right now - let me have someone reach out to help you change the time.",
        bookingState,
        appointmentCreated: false,
        appointmentRescheduled: false,
        continueWithAI: false,
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

      console.log('[BookingHandler] Available slots for reschedule:', slots.length)

      if (slots.length === 0) {
        return {
          message: "Calendar's pretty packed for the next couple weeks. Want me to have someone reach out to find a new time?",
          bookingState: {
            ...bookingState,
            isActive: true,
            isRescheduling: true,
            existingAppointmentId: existingAppointment.id,
            existingCalendarEventId: existingAppointment.calendar_event_id,
            offerAttempts: bookingState.offerAttempts + 1,
          },
          appointmentCreated: false,
          appointmentRescheduled: false,
          continueWithAI: false,
        }
      }

      // If user requested a specific day, filter to that day first
      let slotsToOffer = slots
      let noSlotsOnPreferredDay = false

      if (preferredDay && preferredDay !== 'tomorrow' && preferredDay !== 'today') {
        const filteredSlots = this.filterSlotsByDay(preferredDay, slots)
        if (filteredSlots.length > 0) {
          slotsToOffer = filteredSlots
          console.log('[BookingHandler] Filtered to preferred day:', preferredDay, 'slots:', filteredSlots.length)
        } else {
          // No slots on the requested day - we'll offer alternatives
          noSlotsOnPreferredDay = true
          console.log('[BookingHandler] No slots on preferred day:', preferredDay)
        }
      } else if (preferredDay === 'tomorrow') {
        const filteredSlots = this.filterSlotsByDay('tomorrow', slots)
        if (filteredSlots.length > 0) {
          slotsToOffer = filteredSlots
        } else {
          noSlotsOnPreferredDay = true
        }
      } else if (preferredDay === 'today') {
        const filteredSlots = this.filterSlotsByDay('today', slots)
        if (filteredSlots.length > 0) {
          slotsToOffer = filteredSlots
        } else {
          noSlotsOnPreferredDay = true
        }
      }

      const firstName = contact.first_name || 'there'
      const responseMessage = this.buildRescheduleOfferMessage(firstName, slotsToOffer, preferredDay, noSlotsOnPreferredDay)

      return {
        message: responseMessage,
        bookingState: {
          isActive: true,
          offeredSlots: slotsToOffer,
          slotsOfferedAt: new Date().toISOString(),
          selectedSlot: null,
          offerAttempts: bookingState.offerAttempts + 1,
          lastOfferedSlot: null,
          isRescheduling: true,
          existingAppointmentId: existingAppointment.id,
          existingCalendarEventId: existingAppointment.calendar_event_id,
        },
        appointmentCreated: false,
        appointmentRescheduled: false,
        continueWithAI: false,
      }
    } catch (error) {
      console.error('Failed to get available slots for reschedule:', error)
      return {
        message: "Something went wrong checking availability. Let me have someone reach out to help reschedule.",
        bookingState,
        appointmentCreated: false,
        appointmentRescheduled: false,
        continueWithAI: false,
      }
    }
  }

  /**
   * Build message offering new times for rescheduling
   * @param preferredDay - The day the user requested (if any)
   * @param noSlotsOnPreferredDay - True if user requested a day but no slots available
   */
  private buildRescheduleOfferMessage(
    firstName: string,
    slots: TimeSlot[],
    preferredDay?: string | null,
    noSlotsOnPreferredDay?: boolean
  ): string {
    const selectedSlots = this.selectDiverseSlots(slots, 4)

    if (selectedSlots.length === 0) {
      return `${firstName}, let me check on some times and get back to you.`
    }

    // If user requested a specific day and we have slots on that day
    if (preferredDay && !noSlotsOnPreferredDay) {
      const dayDisplay = preferredDay.charAt(0).toUpperCase() + preferredDay.slice(1)
      if (selectedSlots.length === 1) {
        return `Sure, I've got ${selectedSlots[0].formatted} available on ${dayDisplay}. Does that work?`
      }
      // Format times only (not full dates since they're all on the same day)
      const times = selectedSlots.map(s => {
        const timePart = s.formatted.split(',').pop()?.trim() || s.formatted
        return timePart
      })
      if (times.length === 2) {
        return `Sure, on ${dayDisplay} I've got ${times[0]} or ${times[1]}. Which works better?`
      }
      const lastTime = times.pop()
      return `Sure, on ${dayDisplay} I've got ${times.join(', ')}, or ${lastTime}. Which works?`
    }

    // If user requested a day but we don't have slots - offer alternatives
    if (preferredDay && noSlotsOnPreferredDay) {
      const dayDisplay = preferredDay.charAt(0).toUpperCase() + preferredDay.slice(1)
      return `${dayDisplay}'s fully booked, but I've got ${this.formatSlotOptions(selectedSlots)}. Any of those work instead?`
    }

    // Default: no specific day requested
    const timeOptions = this.formatSlotsNaturally(firstName, selectedSlots)
      .replace(/does .* work for you\?/i, 'work instead?')
      .replace(/Any of those work\?/i, 'Any of those work instead?')
      .replace(/any of those suit you\?/i, 'any of those suit you instead?')

    const templates = [
      `No problem - when works better? I've got ${this.formatSlotOptions(selectedSlots)}.`,
      `Sure thing. ${timeOptions}`,
      `Let me move that for you. ${timeOptions}`,
    ]

    return templates[Math.floor(Math.random() * templates.length)]
  }

  /**
   * Format slot options as a simple list
   */
  private formatSlotOptions(slots: TimeSlot[]): string {
    const options = slots.map(s => s.formatted)
    if (options.length === 1) return options[0]
    if (options.length === 2) return `${options[0]} or ${options[1]}`
    const last = options.pop()
    return `${options.join(', ')}, or ${last}`
  }
}

export const bookingHandler = new BookingHandler()
