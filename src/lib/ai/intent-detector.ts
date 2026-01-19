import { Intent, IntentClassification, ConversationContext } from '@/types/ai'
import { classifyIntent as classifyWithClaude } from './client'

// Keywords for fast-path detection
const OPT_OUT_KEYWORDS = [
  'stop',
  'unsubscribe',
  'remove me',
  'opt out',
  'opt-out',
  'dont contact',
  "don't contact",
  'leave me alone',
  'remove my number',
  'take me off',
  'no more messages',
  'stop texting',
  'stop messaging'
]

const HUMAN_REQUEST_KEYWORDS = [
  'speak to someone',
  'talk to a person',
  'real person',
  'human',
  'representative',
  'manager',
  'call me',
  'agent',
  'support',
  'speak to a human',
  'talk to someone real'
]

const BOOKING_KEYWORDS = [
  'book',
  'schedule',
  'appointment',
  'meeting',
  'available',
  'calendar',
  'set up a call',
  'set up a time',
  'when can we',
  'lets meet',
  "let's meet",
  'free time',
  'slot'
]

const RESCHEDULE_KEYWORDS = [
  'reschedule',
  'change the time',
  'change the meeting',
  'change the appointment',
  'change my appointment',
  'change my booking',
  'move the meeting',
  'move the appointment',
  'move my appointment',
  'move it to',
  'different time',
  'different day',
  'can we do',
  'switch to',
  'change to',
  'move to',
  'push back',
  'push it back',
  'postpone',
  'cancel and rebook'
]

// Patterns that indicate someone is selecting/confirming a time
const TIME_SELECTION_PATTERNS = [
  /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i,           // "3pm", "10:30am"
  /\b(?:at|@)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, // "at 3", "@ 2pm"
  /\bthe\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:works?|is good|sounds good|please|slot)?\b/i, // "the 3pm works"
  /\b(?:let'?s?\s+(?:do|go with)|i'?ll?\s+take|works?\s+for\s+me)\b/i, // "let's do", "I'll take", "works for me"
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at|@)?\s*\d{1,2}/i, // "monday at 3"
  /\b(?:tomorrow|today)\s+(?:at|@)?\s*\d{1,2}/i,  // "tomorrow at 2"
  /\bi\s+(?:meant|mean|want|prefer|said)\s+\d{1,2}/i, // "I meant 3pm", "I want 2"
]

const POSITIVE_KEYWORDS = [
  'yes',
  'sure',
  'sounds good',
  'interested',
  'tell me more',
  'go ahead',
  'okay',
  'ok',
  'definitely',
  'absolutely',
  'perfect',
  'great'
]

const NEGATIVE_KEYWORDS = [
  'no thanks',
  'not interested',
  'not for me',
  'pass',
  'maybe later',
  'not right now',
  'busy',
  "can't",
  'cannot'
]

export class IntentDetector {
  async detect(
    message: string,
    context: ConversationContext
  ): Promise<IntentClassification> {
    const normalized = message.toLowerCase().trim()

    // Fast path: Check for explicit patterns first
    const fastResult = this.fastPathDetection(normalized)
    if (fastResult) {
      return fastResult
    }

    // Use Claude for ambiguous cases
    try {
      const contextSummary = context.summary || 'New conversation'
      const claudeResult = await classifyWithClaude(message, contextSummary)

      return {
        intent: this.mapIntentString(claudeResult.intent),
        confidence: claudeResult.confidence,
        entities: {},
        requiresEscalation: claudeResult.requiresEscalation
      }
    } catch (error) {
      console.error('Claude intent classification failed:', error)
      return {
        intent: 'unclear',
        confidence: 0.5,
        entities: {},
        requiresEscalation: false
      }
    }
  }

  private fastPathDetection(normalized: string): IntentClassification | null {
    // Check opt-out (highest priority)
    if (this.matchesKeywords(normalized, OPT_OUT_KEYWORDS)) {
      return {
        intent: 'opt_out',
        confidence: 1.0,
        entities: {},
        requiresEscalation: false
      }
    }

    // Check human request
    if (this.matchesKeywords(normalized, HUMAN_REQUEST_KEYWORDS)) {
      return {
        intent: 'request_human',
        confidence: 0.95,
        entities: {},
        requiresEscalation: true,
        escalationReason: 'Contact requested human assistance'
      }
    }

    // Check for very short positive responses
    if (normalized.length < 10 && this.matchesKeywords(normalized, POSITIVE_KEYWORDS)) {
      return {
        intent: 'positive_response',
        confidence: 0.85,
        entities: {},
        requiresEscalation: false
      }
    }

    // Check for very short negative responses
    if (normalized.length < 20 && this.matchesKeywords(normalized, NEGATIVE_KEYWORDS)) {
      return {
        intent: 'negative_response',
        confidence: 0.85,
        entities: {},
        requiresEscalation: false
      }
    }

    // Check for reschedule request (before booking - more specific)
    if (this.matchesKeywords(normalized, RESCHEDULE_KEYWORDS)) {
      console.log('[IntentDetector] Detected reschedule intent:', normalized)
      return {
        intent: 'reschedule',
        confidence: 0.9,
        entities: this.extractTimeEntities(normalized),
        requiresEscalation: false
      }
    }

    // Check booking interest (keywords)
    if (this.matchesKeywords(normalized, BOOKING_KEYWORDS)) {
      return {
        intent: 'booking_interest',
        confidence: 0.8,
        entities: this.extractTimeEntities(normalized),
        requiresEscalation: false
      }
    }

    // Check for time selection patterns (someone picking/confirming a time)
    if (this.matchesTimeSelection(normalized)) {
      console.log('[IntentDetector] Detected time selection pattern:', normalized)
      return {
        intent: 'booking_interest',
        confidence: 0.85,
        entities: this.extractTimeEntities(normalized),
        requiresEscalation: false
      }
    }

    // Check for questions
    if (normalized.includes('?') || normalized.startsWith('what') ||
        normalized.startsWith('how') || normalized.startsWith('why') ||
        normalized.startsWith('when') || normalized.startsWith('where') ||
        normalized.startsWith('who') || normalized.startsWith('can you')) {
      return {
        intent: 'question',
        confidence: 0.75,
        entities: {},
        requiresEscalation: false
      }
    }

    // Check for simple greetings
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening']
    if (normalized.length < 20 && greetings.some(g => normalized.startsWith(g))) {
      return {
        intent: 'greeting',
        confidence: 0.9,
        entities: {},
        requiresEscalation: false
      }
    }

    // Check for thanks
    const thanks = ['thanks', 'thank you', 'appreciate', 'cheers']
    if (thanks.some(t => normalized.includes(t))) {
      return {
        intent: 'thanks',
        confidence: 0.9,
        entities: {},
        requiresEscalation: false
      }
    }

    // No fast match - need Claude
    return null
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword))
  }

  private matchesTimeSelection(text: string): boolean {
    return TIME_SELECTION_PATTERNS.some(pattern => pattern.test(text))
  }

  private extractTimeEntities(text: string): Record<string, string> {
    const entities: Record<string, string> = {}

    // Days of week
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const day of days) {
      if (text.includes(day)) {
        entities.preferredDay = day
        break
      }
    }

    // Time of day
    if (text.includes('morning')) entities.preferredTime = 'morning'
    else if (text.includes('afternoon')) entities.preferredTime = 'afternoon'
    else if (text.includes('evening')) entities.preferredTime = 'evening'

    // Relative dates
    if (text.includes('tomorrow')) entities.preferredDate = 'tomorrow'
    else if (text.includes('next week')) entities.preferredDate = 'next week'
    else if (text.includes('this week')) entities.preferredDate = 'this week'

    return entities
  }

  private mapIntentString(intent: string): Intent {
    const validIntents: Intent[] = [
      'booking_interest',
      'reschedule',
      'question',
      'objection',
      'positive_response',
      'negative_response',
      'opt_out',
      'request_human',
      'confirmation',
      'unclear',
      'greeting',
      'thanks'
    ]

    if (validIntents.includes(intent as Intent)) {
      return intent as Intent
    }

    return 'unclear'
  }

  // Check if escalation is needed based on context
  checkEscalationTriggers(
    message: string,
    context: ConversationContext
  ): { required: boolean; reason?: string } {
    const normalized = message.toLowerCase()

    // Explicit human request
    if (this.matchesKeywords(normalized, HUMAN_REQUEST_KEYWORDS)) {
      return { required: true, reason: 'Contact requested human assistance' }
    }

    // Too many turns without progress
    if (context.state.turnCount > 15) {
      return { required: true, reason: 'Conversation exceeded turn limit without resolution' }
    }

    // Multiple escalation attempts
    if (context.state.escalationAttempts >= 2) {
      return { required: true, reason: 'Multiple unresolved complex queries' }
    }

    // Angry/frustrated language
    const frustratedKeywords = ['frustrated', 'angry', 'ridiculous', 'waste of time', 'useless']
    if (frustratedKeywords.some(kw => normalized.includes(kw))) {
      return { required: true, reason: 'Contact expressed frustration' }
    }

    return { required: false }
  }
}

// Export singleton instance
export const intentDetector = new IntentDetector()
