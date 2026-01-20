/**
 * Business Hours Checker
 * Determines if current time is within a client's business hours
 */

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

/**
 * Check if the current time is within a client's business hours
 * @param businessHours The client's business hours configuration
 * @param timezone The client's timezone (e.g., 'Europe/London', 'America/New_York')
 * @returns true if current time is within business hours
 */
export function isWithinBusinessHours(
  businessHours: BusinessHours,
  timezone: string
): boolean {
  try {
    const now = new Date()

    // Get current time in client's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    const parts = formatter.formatToParts(now)
    const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase() as DayOfWeek
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10)
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10)

    // Get business hours for this day
    const dayHours = businessHours[weekday]

    if (!dayHours) {
      // No business hours defined for this day (closed)
      return false
    }

    // Parse start and end times
    const [startHour, startMinute] = dayHours.start.split(':').map(Number)
    const [endHour, endMinute] = dayHours.end.split(':').map(Number)

    // Convert to minutes since midnight for easy comparison
    const currentMinutes = hour * 60 + minute
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute

    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  } catch (error) {
    console.error(`Error checking business hours for timezone ${timezone}:`, error)
    // Default to allowing in case of error (fail open)
    return true
  }
}

/**
 * Get the next business hours start time for a client
 * Useful for scheduling follow-ups
 */
export function getNextBusinessHoursStart(
  businessHours: BusinessHours,
  timezone: string
): Date | null {
  try {
    const now = new Date()

    // Check today and the next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000)

      // Get day of week in client's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
      })
      const weekday = formatter.format(checkDate).toLowerCase() as DayOfWeek

      const dayHours = businessHours[weekday]
      if (!dayHours) continue

      // Parse start time
      const [startHour, startMinute] = dayHours.start.split(':').map(Number)

      // Create a date for this day's business hours start
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const parts = timeFormatter.formatToParts(checkDate)
      const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10)
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10)

      // Create UTC date for start of business hours
      const businessStart = new Date(Date.UTC(year, month, day, startHour, startMinute))

      // Adjust for timezone offset
      const offset = getTimezoneOffset(businessStart, timezone)
      const adjustedStart = new Date(businessStart.getTime() + offset)

      // If this start time is in the future, return it
      if (adjustedStart > now) {
        return adjustedStart
      }

      // If it's today and we're already past start, check if still within hours
      if (dayOffset === 0) {
        const [endHour, endMinute] = dayHours.end.split(':').map(Number)
        const businessEnd = new Date(Date.UTC(year, month, day, endHour, endMinute))
        const adjustedEnd = new Date(businessEnd.getTime() + offset)

        // If we're within hours today, return now (it's business hours)
        if (now < adjustedEnd) {
          return now
        }
      }
    }

    return null
  } catch (error) {
    console.error(`Error getting next business hours for timezone ${timezone}:`, error)
    return null
  }
}

/**
 * Get timezone offset in milliseconds
 */
function getTimezoneOffset(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const parts = formatter.formatToParts(date)
    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10)

    const tzYear = getPart('year')
    const tzMonth = getPart('month') - 1
    const tzDay = getPart('day')
    const tzHour = getPart('hour')
    const tzMinute = getPart('minute')
    const tzSecond = getPart('second')

    const utcDate = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, tzSecond)
    return date.getTime() - utcDate
  } catch {
    return 0
  }
}
