/**
 * Availability Engine
 * Generates available time slots by merging calendar busy times with business hours
 */

import { CalendarProvider, TimeSlot } from './types'
import { BusinessHours } from '@/types/database'

const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

interface AvailabilityOptions {
  /** Calendar provider with tokens set */
  provider: CalendarProvider
  /** Calendar ID to check */
  calendarId: string
  /** Client's business hours */
  businessHours: BusinessHours
  /** Client's timezone (e.g., 'Europe/London') */
  timezone: string
  /** Appointment duration in minutes */
  durationMinutes: number
  /** How many days ahead to look (default: 14) */
  daysAhead?: number
  /** Maximum slots to return (default: 10) */
  maxSlots?: number
  /** Minimum hours from now to first slot (default: 2) */
  minLeadTimeHours?: number
}

/**
 * Get available time slots for booking
 */
export async function getAvailableSlots(
  options: AvailabilityOptions
): Promise<TimeSlot[]> {
  const {
    provider,
    calendarId,
    businessHours,
    timezone,
    durationMinutes,
    daysAhead = 14,
    maxSlots = 10,
    minLeadTimeHours = 2,
  } = options

  const now = new Date()
  const startDate = new Date(now.getTime() + minLeadTimeHours * 60 * 60 * 1000)
  const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  // Fetch busy times from calendar
  const busySlots = await provider.getFreeBusy(calendarId, startDate, endDate)

  // Generate available slots
  const slots: TimeSlot[] = []
  const slotDuration = durationMinutes * 60 * 1000

  // Iterate through each day
  const currentDate = new Date(startDate)
  currentDate.setHours(0, 0, 0, 0)

  while (currentDate < endDate && slots.length < maxSlots) {
    const dayOfWeek = DAYS_OF_WEEK[currentDate.getDay()] as DayOfWeek
    const dayHours = businessHours[dayOfWeek]

    if (dayHours) {
      // Parse business hours
      const [startHour, startMinute] = dayHours.start.split(':').map(Number)
      const [endHour, endMinute] = dayHours.end.split(':').map(Number)

      // Create day start/end in client's timezone
      const dayStart = new Date(currentDate)
      dayStart.setHours(startHour, startMinute, 0, 0)

      const dayEnd = new Date(currentDate)
      dayEnd.setHours(endHour, endMinute, 0, 0)

      // Generate slots for this day
      let slotStart = new Date(Math.max(dayStart.getTime(), startDate.getTime()))

      // Round up to next 30-minute interval
      const minutes = slotStart.getMinutes()
      if (minutes % 30 !== 0) {
        slotStart.setMinutes(minutes + (30 - (minutes % 30)), 0, 0)
      }

      while (slotStart.getTime() + slotDuration <= dayEnd.getTime() && slots.length < maxSlots) {
        const slotEnd = new Date(slotStart.getTime() + slotDuration)

        // Check if slot conflicts with any busy time
        const isAvailable = !busySlots.some(
          (busy) => slotStart < busy.end && slotEnd > busy.start
        )

        if (isAvailable && slotStart > startDate) {
          slots.push({
            start: new Date(slotStart),
            end: slotEnd,
            formatted: formatSlot(slotStart, timezone),
          })
        }

        // Move to next 30-minute slot
        slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000)
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return slots
}

/**
 * Format a time slot for display in conversation
 */
function formatSlot(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    })
    return formatter.format(date)
  } catch {
    // Fallback if timezone is invalid
    return date.toLocaleString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
}

/**
 * Format multiple slots for AI to present in conversation
 */
export function formatSlotsForConversation(slots: TimeSlot[]): string {
  if (slots.length === 0) {
    return 'No available times in the next two weeks.'
  }

  // Group by day
  const byDay: Record<string, TimeSlot[]> = {}
  for (const slot of slots) {
    const dayKey = slot.start.toDateString()
    if (!byDay[dayKey]) {
      byDay[dayKey] = []
    }
    byDay[dayKey].push(slot)
  }

  // Format as readable list
  const lines: string[] = []
  for (const [, daySlots] of Object.entries(byDay)) {
    const day = daySlots[0].formatted.split(' at ')[0]
    const times = daySlots.map((s) => s.formatted.split(' at ')[1]).join(', ')
    lines.push(`${day}: ${times}`)
  }

  return lines.join('\n')
}

/**
 * Parse a user's time selection from conversation
 * Returns the matching slot or null if not found
 *
 * IMPORTANT: This function should only return a slot if we're CONFIDENT
 * the user is selecting that specific slot. If they request a time that
 * isn't available, we return null so the AI can redirect them.
 */
export function parseTimeSelection(
  input: string,
  availableSlots: TimeSlot[]
): TimeSlot | null {
  const normalizedInput = input.toLowerCase().trim()

  // Try to parse as a numbered selection first (most reliable)
  // e.g., "option 1", "the first one", "#2", "1", "number 3"
  const numberMatch = normalizedInput.match(/(?:option|number|#)?\s*(\d+)|(?:the\s+)?(first|second|third|fourth|fifth|sixth)/i)
  if (numberMatch) {
    let index: number
    if (numberMatch[2]) {
      const ordinals: Record<string, number> = {
        first: 0,
        second: 1,
        third: 2,
        fourth: 3,
        fifth: 4,
        sixth: 5,
      }
      index = ordinals[numberMatch[2].toLowerCase()] ?? -1
    } else {
      index = parseInt(numberMatch[1], 10) - 1
    }

    if (index >= 0 && index < availableSlots.length) {
      return availableSlots[index]
    }
  }

  // Try to match against formatted slots (exact match)
  for (const slot of availableSlots) {
    const normalizedSlot = slot.formatted.toLowerCase()

    if (
      normalizedInput.includes(normalizedSlot) ||
      normalizedSlot.includes(normalizedInput)
    ) {
      return slot
    }
  }

  // Parse time from input - handle various formats
  // "2pm", "2:00pm", "2:00 pm", "14:00", "2 pm", "at 2", "12"
  const timePatterns = [
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,  // 2pm, 2:00pm, 2:00 pm
    /at\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?/i,  // at 2, at 2pm
  ]

  let inputHour: number | null = null
  let inputMinute = 0
  let hasMeridiem = false

  for (const pattern of timePatterns) {
    const match = normalizedInput.match(pattern)
    if (match) {
      inputHour = parseInt(match[1], 10)
      inputMinute = match[2] ? parseInt(match[2], 10) : 0
      const meridiem = match[3]?.toLowerCase()
      hasMeridiem = !!meridiem

      // Convert to 24-hour if needed
      if (meridiem === 'pm' && inputHour < 12) {
        inputHour += 12
      } else if (meridiem === 'am' && inputHour === 12) {
        inputHour = 0
      }
      break
    }
  }

  // Extract day from input
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const inputDay = dayNames.find(day => normalizedInput.includes(day))

  // If user specified a time, we MUST match that time (or return null)
  // We can't just book them for a different time!
  if (inputHour !== null) {
    // Find slots that match the requested time
    const timeMatches: TimeSlot[] = []

    for (const slot of availableSlots) {
      const slotHour = slot.start.getHours()
      const slotMinute = slot.start.getMinutes()

      // Check if time matches
      const exactTimeMatch = slotHour === inputHour && slotMinute === inputMinute
      const hourMatch = slotHour === inputHour

      // Also check for ambiguous times without am/pm (e.g., "at 2" could be 2am or 2pm)
      const ambiguousMatch = !hasMeridiem && (
        slotHour === inputHour ||
        slotHour === (inputHour + 12) % 24 ||
        slotHour === (inputHour - 12 + 24) % 24
      )

      if (exactTimeMatch || (hourMatch && inputMinute === 0) || ambiguousMatch) {
        // If day is also specified, it must match
        if (inputDay) {
          const normalizedSlot = slot.formatted.toLowerCase()
          const slotDay = dayNames.find(day => normalizedSlot.includes(day))
          if (slotDay === inputDay) {
            timeMatches.push(slot)
          }
        } else {
          timeMatches.push(slot)
        }
      }
    }

    // If we found exactly one match, return it
    if (timeMatches.length === 1) {
      return timeMatches[0]
    }

    // If multiple matches (e.g., same time on different days), prefer earliest
    if (timeMatches.length > 1) {
      return timeMatches[0]
    }

    // User specified a time that doesn't exist in our slots - return null
    // so the AI can tell them that time isn't available
    return null
  }

  // If they only specified a day without a time, don't auto-select
  // Let the AI ask them which time on that day works
  if (inputDay) {
    return null
  }

  return null
}
