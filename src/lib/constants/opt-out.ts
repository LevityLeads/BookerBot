/**
 * Centralized opt-out keywords used throughout the system.
 *
 * IMPORTANT: This is the single source of truth for opt-out detection.
 * Update this file when adding/removing opt-out keywords.
 */

/**
 * Standard Twilio opt-out keywords (required by carriers)
 * These are processed by Twilio and also detected by our system.
 */
export const TWILIO_STANDARD_OPT_OUT = [
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit'
] as const

/**
 * Extended opt-out phrases that indicate user wants to stop receiving messages.
 * These are more conversational variations that our AI system detects.
 */
export const EXTENDED_OPT_OUT_PHRASES = [
  'opt out',
  'opt-out',
  'remove me',
  "don't contact",
  'dont contact',
  'leave me alone',
  'remove my number',
  'take me off',
  'no more messages',
  'stop texting',
  'stop messaging',
  'stop contacting',
  'delete my number'
] as const

/**
 * Combined list of all opt-out keywords and phrases.
 * Use this for comprehensive opt-out detection.
 */
export const ALL_OPT_OUT_KEYWORDS = [
  ...TWILIO_STANDARD_OPT_OUT,
  ...EXTENDED_OPT_OUT_PHRASES
] as const

/**
 * Check if a message contains an opt-out request.
 * Handles both exact matches and substring matches for phrases.
 *
 * @param message - The message to check
 * @param strictMode - If true, only matches exact keywords (for webhook processing)
 * @returns True if the message contains an opt-out request
 */
export function isOptOutMessage(message: string, strictMode = false): boolean {
  const normalized = message.toLowerCase().trim()

  if (strictMode) {
    // Strict mode: exact match on Twilio standard keywords only
    // Used for webhook processing where we want to be conservative
    return TWILIO_STANDARD_OPT_OUT.some(kw => normalized === kw)
  }

  // Flexible mode: check all keywords and phrases
  // First check exact matches on single words
  for (const keyword of TWILIO_STANDARD_OPT_OUT) {
    if (normalized === keyword) return true
  }

  // Then check for phrase matches
  for (const phrase of ALL_OPT_OUT_KEYWORDS) {
    if (normalized.includes(phrase)) return true
  }

  return false
}
