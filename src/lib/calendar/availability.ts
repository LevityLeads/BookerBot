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

  // Try to match against formatted slots
  for (const slot of availableSlots) {
    const normalizedSlot = slot.formatted.toLowerCase()

    // Exact or contains match
    if (
      normalizedInput.includes(normalizedSlot) ||
      normalizedSlot.includes(normalizedInput)
    ) {
      return slot
    }
  }

  // Extract day and time components from input for flexible matching
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const inputDay = dayNames.find(day => normalizedInput.includes(day))

  // Parse time from input - handle various formats
  // "2pm", "2:00pm", "2:00 pm", "14:00", "2 pm", "at 2"
  const timePatterns = [
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,  // 2pm, 2:00pm, 2:00 pm
    /at\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?/i,  // at 2, at 2pm
  ]

  let inputHour: number | null = null
  let inputMinute = 0

  for (const pattern of timePatterns) {
    const match = normalizedInput.match(pattern)
    if (match) {
      inputHour = parseInt(match[1], 10)
      inputMinute = match[2] ? parseInt(match[2], 10) : 0
      const meridiem = match[3]?.toLowerCase()

      // Convert to 24-hour if needed
      if (meridiem === 'pm' && inputHour < 12) {
        inputHour += 12
      } else if (meridiem === 'am' && inputHour === 12) {
        inputHour = 0
      }
      break
    }
  }

  // Score each slot based on how well it matches
  let bestMatch: TimeSlot | null = null
  let bestScore = 0

  for (const slot of availableSlots) {
    const normalizedSlot = slot.formatted.toLowerCase()
    let score = 0

    // Check day match
    const slotDay = dayNames.find(day => normalizedSlot.includes(day))
    if (inputDay && slotDay === inputDay) {
      score += 10
    }

    // Check time match
    if (inputHour !== null) {
      const slotHour = slot.start.getHours()
      const slotMinute = slot.start.getMinutes()

      if (slotHour === inputHour && slotMinute === inputMinute) {
        score += 20  // Exact time match
      } else if (slotHour === inputHour) {
        score += 10  // Hour matches (e.g., "2pm" matches "2:00 pm" and "2:30 pm")
      }
    }

    // Partial text matches
    const slotParts = normalizedSlot.split(/\s+/)
    for (const part of slotParts) {
      if (part.length > 2 && normalizedInput.includes(part)) {
        score += 2
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = slot
    }
  }

  // Only return if we have a reasonable confidence match
  // Day + exact time = 30, Day + hour = 20, just day = 10
  if (bestScore >= 10) {
    return bestMatch
  }

  return null
}
