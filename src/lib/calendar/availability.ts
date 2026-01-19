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
  availableSlots: TimeSlot[],
  lastOfferedSlot?: TimeSlot
): TimeSlot | null {
  const normalizedInput = input.toLowerCase().trim()

  // Check for affirmative responses first (e.g., "yeah that works", "yes", "sure")
  // These confirm the last offered slot
  const affirmativePatterns = [
    /^(yes|yeah|yep|yup|sure|ok|okay|sounds good|that works|perfect|great|fine|let'?s do it|book it|confirmed?)$/i,
    /^(yes|yeah|yep|yup|sure|ok|okay)[,!.]?\s*(that|it)?\s*(works|sounds good)?/i,
    /that\s*(works|sounds good|'?s good|'?s fine|'?s perfect)/i,
    /^(sounds?|looks?)\s+(good|great|fine|perfect)/i,
    /^(let'?s|i'?ll)\s+(do|take|book)\s+(it|that|this)/i,
  ]

  for (const pattern of affirmativePatterns) {
    if (pattern.test(normalizedInput)) {
      // User is confirming - use the last offered slot if available, otherwise first available
      if (lastOfferedSlot) {
        return lastOfferedSlot
      }
      // If only one slot available, book it
      if (availableSlots.length === 1) {
        return availableSlots[0]
      }
      // Multiple slots but no specific last offer - can't determine which one
      return null
    }
  }

  // Try to parse as a numbered selection (most reliable)
  // Only match explicit slot references like "option 1", "#2", "the first one"
  // or standalone numbers at the start/end (not numbers within dates)
  const explicitNumberPatterns = [
    /^(?:option|number|#|slot)\s*(\d)$/i,  // "option 1", "#2", "slot 3"
    /^(\d)$/,  // Just a single digit
    /^(?:the\s+)?(first|second|third|fourth|fifth|sixth)(?:\s+one)?$/i,  // "the first one"
  ]

  for (const pattern of explicitNumberPatterns) {
    const match = normalizedInput.match(pattern)
    if (match) {
      let index: number
      if (match[1] && /^\d$/.test(match[1])) {
        index = parseInt(match[1], 10) - 1
      } else if (match[1]) {
        const ordinals: Record<string, number> = {
          first: 0, second: 1, third: 2, fourth: 3, fifth: 4, sixth: 5,
        }
        index = ordinals[match[1].toLowerCase()] ?? -1
      } else {
        continue
      }

      if (index >= 0 && index < availableSlots.length) {
        return availableSlots[index]
      }
    }
  }

  // Try to match against formatted slots (strict match only)
  // We require near-exact matches to avoid false positives like "tues" matching "Tuesday, 20 Jan, 10:00 am"
  // Only match if the user typed the full formatted slot or something very close
  for (const slot of availableSlots) {
    const normalizedSlot = slot.formatted.toLowerCase()

    // Require substantial overlap - the input should be most of the formatted slot
    // This handles cases like "Tuesday 20 Jan 10am" matching "Tuesday, 20 Jan, 10:00 am"
    if (normalizedInput.length >= normalizedSlot.length * 0.7) {
      // Check if input contains most key parts of the slot
      const slotParts = normalizedSlot.split(/[\s,]+/).filter(p => p.length > 2)
      const matchCount = slotParts.filter(part => normalizedInput.includes(part)).length
      if (matchCount >= slotParts.length * 0.6) {
        return slot
      }
    }
  }

  // Parse time from input - handle various formats
  // "2pm", "2:00pm", "2:00 pm", "14:00", "2 pm", "at 2"
  // Use word boundaries to avoid matching numbers in dates like "19th"
  const timePatterns = [
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,  // 2pm, 2:00pm, 2:00 pm
    /\bat\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?\b/i,  // at 2, at 2pm
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

  // Extract day from input (using centralized function that handles abbreviations)
  const inputDay = extractDayFromMessage(normalizedInput)

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
      const hourMatch = slotHour === inputHour && inputMinute === 0

      // Also check for ambiguous times without am/pm (e.g., "at 2" could be 2am or 2pm)
      const ambiguousMatch = !hasMeridiem && inputMinute === 0 && (
        slotHour === inputHour ||
        slotHour === (inputHour + 12) % 24
      )

      if (exactTimeMatch || hourMatch || ambiguousMatch) {
        // If day is also specified, it must match
        if (inputDay) {
          // Get the canonical day name from the slot's date
          const slotDay = DAYS_OF_WEEK[slot.start.getDay()]
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
