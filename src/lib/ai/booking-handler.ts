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

    const selectedSlot = parseTimeSelection(message, bookingState.offeredSlots)

    if (!selectedSlot) {
      // Couldn't parse selection - let AI continue
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
        const event = await connection.provider.createEvent(
          connection.connection.calendar_id,
          {
            summary: `${contact.workflows.name} - ${contact.first_name || 'Contact'} ${contact.last_name || ''}`.trim(),
            description: `Booked via BookerBot\n\nContact: ${contact.first_name || ''} ${contact.last_name || ''}\nPhone: ${contact.phone || 'N/A'}\nEmail: ${contact.email || 'N/A'}`,
            start: slot.start,
            end: slot.end,
            attendeeEmail: contact.email || undefined,
            attendeeName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || undefined,
          }
        )
        calendarEventId = event.id
      } catch (error) {
        console.error('Failed to create calendar event:', error)
        // Continue without calendar event - still create DB record
      }
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
   */
  private buildSlotOfferMessage(
    firstName: string,
    slots: TimeSlot[]
  ): string {
    // Group slots by day for a cleaner message
    const slotsByDay = new Map<string, TimeSlot[]>()
    for (const slot of slots) {
      const dayKey = slot.start.toDateString()
      if (!slotsByDay.has(dayKey)) {
        slotsByDay.set(dayKey, [])
      }
      slotsByDay.get(dayKey)!.push(slot)
    }

    // Vary the opening to sound more natural
    const openers = [
      `${firstName}, here's what I've got available:`,
      `Let me check the calendar... Here's what works:`,
      `${firstName}, I've got these times open:`,
    ]
    const opener = openers[Math.floor(Math.random() * openers.length)]

    // Build message
    const lines: string[] = []
    lines.push(opener)
    lines.push('')

    let slotNum = 1
    Array.from(slotsByDay.values()).forEach((daySlots) => {
      for (const slot of daySlots) {
        lines.push(`${slotNum}. ${slot.formatted}`)
        slotNum++
      }
    })

    lines.push('')
    lines.push('Which works for you?')

    return lines.join('\n')
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
    }
  }
}

export const bookingHandler = new BookingHandler()
