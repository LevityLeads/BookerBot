import {
  ConversationContext,
  ExtractedInfo,
  QualificationState,
  ConversationState,
  ConversationGoal,
  Intent,
  createInitialContext
} from '@/types/ai'
import { Json } from '@/types/database'

export class ContextManager {
  // Parse existing context from database or initialize new one
  parse(jsonb: Json | null): ConversationContext {
    if (!jsonb || typeof jsonb !== 'object' || Array.isArray(jsonb)) {
      return createInitialContext()
    }

    const data = jsonb as Record<string, unknown>

    return {
      extractedInfo: this.parseExtractedInfo(data.extractedInfo),
      qualification: this.parseQualification(data.qualification),
      state: this.parseState(data.state),
      summary: typeof data.summary === 'string' ? data.summary : '',
      messageCount: typeof data.messageCount === 'number' ? data.messageCount : 0
    }
  }

  // Serialize context for database storage
  serialize(context: ConversationContext): Json {
    return context as unknown as Json
  }

  // Update context after a conversation turn
  update(
    current: ConversationContext,
    params: {
      intent: Intent
      userMessage: string
      aiResponse: string
      qualificationUpdate?: Partial<QualificationState>
      extractedInfoUpdate?: Partial<ExtractedInfo>
    }
  ): ConversationContext {
    const newState: ConversationState = {
      ...current.state,
      turnCount: current.state.turnCount + 1,
      lastIntent: params.intent,
      lastMessageAt: new Date().toISOString()
    }

    // Update goal based on intent and current state
    newState.currentGoal = this.determineNextGoal(
      current.state.currentGoal,
      params.intent,
      current.qualification.status
    )

    // Merge extracted info
    const newExtractedInfo: ExtractedInfo = {
      ...current.extractedInfo,
      ...params.extractedInfoUpdate,
      objections: [
        ...current.extractedInfo.objections,
        ...(params.extractedInfoUpdate?.objections || [])
      ].filter((v, i, a) => a.indexOf(v) === i), // Deduplicate
      additionalNotes: [
        ...current.extractedInfo.additionalNotes,
        ...(params.extractedInfoUpdate?.additionalNotes || [])
      ].filter((v, i, a) => a.indexOf(v) === i)
    }

    // Merge qualification state with proper pruning
    // When criteria transition between states (matched↔missed↔unknown),
    // remove from old state to prevent ambiguity
    const newQualification: QualificationState = params.qualificationUpdate
      ? (() => {
          const newMatched = new Set([
            ...current.qualification.criteriaMatched,
            ...(params.qualificationUpdate.criteriaMatched || [])
          ])
          const newMissed = new Set([
            ...current.qualification.criteriaMissed,
            ...(params.qualificationUpdate.criteriaMissed || [])
          ])
          const newUnknown = new Set([
            ...current.qualification.criteriaUnknown,
            ...(params.qualificationUpdate.criteriaUnknown || [])
          ])

          // If newly matched, remove from missed and unknown
          for (const criterion of params.qualificationUpdate.criteriaMatched || []) {
            newMissed.delete(criterion)
            newUnknown.delete(criterion)
          }

          // If newly missed, remove from matched and unknown
          for (const criterion of params.qualificationUpdate.criteriaMissed || []) {
            newMatched.delete(criterion)
            newUnknown.delete(criterion)
          }

          // If newly unknown (re-evaluation), remove from matched and missed
          // This allows criteria to be re-assessed if circumstances change
          for (const criterion of params.qualificationUpdate.criteriaUnknown || []) {
            // Only reset if explicitly marked as unknown in this update
            // (not carried over from previous state)
            if (!current.qualification.criteriaUnknown.includes(criterion)) {
              newMatched.delete(criterion)
              newMissed.delete(criterion)
            }
          }

          return {
            status: params.qualificationUpdate.status || current.qualification.status,
            criteriaMatched: Array.from(newMatched),
            criteriaUnknown: Array.from(newUnknown),
            criteriaMissed: Array.from(newMissed)
          }
        })()
      : current.qualification

    // Generate updated summary
    const summary = this.generateSummary(newExtractedInfo, newQualification, newState)

    return {
      extractedInfo: newExtractedInfo,
      qualification: newQualification,
      state: newState,
      summary,
      messageCount: current.messageCount + 1
    }
  }

  // Increment escalation attempts
  incrementEscalationAttempts(context: ConversationContext): ConversationContext {
    return {
      ...context,
      state: {
        ...context.state,
        escalationAttempts: context.state.escalationAttempts + 1
      }
    }
  }

  // Increment follow-ups sent
  incrementFollowUps(context: ConversationContext): ConversationContext {
    return {
      ...context,
      state: {
        ...context.state,
        followUpsSent: context.state.followUpsSent + 1,
        currentGoal: 'follow_up'
      }
    }
  }

  private parseExtractedInfo(data: unknown): ExtractedInfo {
    if (!data || typeof data !== 'object') {
      return { objections: [], additionalNotes: [] }
    }

    const info = data as Record<string, unknown>
    return {
      isDecisionMaker: typeof info.isDecisionMaker === 'boolean' ? info.isDecisionMaker : undefined,
      hasActiveNeed: typeof info.hasActiveNeed === 'boolean' ? info.hasActiveNeed : undefined,
      budget: typeof info.budget === 'string' ? info.budget : undefined,
      timeline: typeof info.timeline === 'string' ? info.timeline : undefined,
      companySize: typeof info.companySize === 'string' ? info.companySize : undefined,
      objections: Array.isArray(info.objections) ? info.objections as string[] : [],
      preferredContactMethod: typeof info.preferredContactMethod === 'string' ? info.preferredContactMethod : undefined,
      preferredTimes: Array.isArray(info.preferredTimes) ? info.preferredTimes as string[] : undefined,
      additionalNotes: Array.isArray(info.additionalNotes) ? info.additionalNotes as string[] : []
    }
  }

  private parseQualification(data: unknown): QualificationState {
    if (!data || typeof data !== 'object') {
      return {
        status: 'unknown',
        criteriaMatched: [],
        criteriaUnknown: [],
        criteriaMissed: []
      }
    }

    const qual = data as Record<string, unknown>
    return {
      status: this.isValidQualificationStatus(qual.status) ? qual.status : 'unknown',
      criteriaMatched: Array.isArray(qual.criteriaMatched) ? qual.criteriaMatched as string[] : [],
      criteriaUnknown: Array.isArray(qual.criteriaUnknown) ? qual.criteriaUnknown as string[] : [],
      criteriaMissed: Array.isArray(qual.criteriaMissed) ? qual.criteriaMissed as string[] : []
    }
  }

  private parseState(data: unknown): ConversationState {
    if (!data || typeof data !== 'object') {
      return {
        currentGoal: 'initial_engagement',
        turnCount: 0,
        lastIntent: 'unclear',
        escalationAttempts: 0,
        followUpsSent: 0,
        lastMessageAt: null
      }
    }

    const state = data as Record<string, unknown>
    return {
      currentGoal: this.isValidGoal(state.currentGoal) ? state.currentGoal : 'initial_engagement',
      turnCount: typeof state.turnCount === 'number' ? state.turnCount : 0,
      lastIntent: this.isValidIntent(state.lastIntent) ? state.lastIntent : 'unclear',
      escalationAttempts: typeof state.escalationAttempts === 'number' ? state.escalationAttempts : 0,
      followUpsSent: typeof state.followUpsSent === 'number' ? state.followUpsSent : 0,
      lastMessageAt: typeof state.lastMessageAt === 'string' ? state.lastMessageAt : null
    }
  }

  private isValidQualificationStatus(value: unknown): value is QualificationState['status'] {
    return ['unknown', 'partial', 'qualified', 'disqualified'].includes(value as string)
  }

  private isValidGoal(value: unknown): value is ConversationGoal {
    return [
      'initial_engagement',
      'qualify_lead',
      'handle_objection',
      'answer_question',
      'offer_booking',
      'confirm_booking',
      'follow_up',
      'closing'
    ].includes(value as string)
  }

  private isValidIntent(value: unknown): value is Intent {
    return [
      'booking_interest',
      'question',
      'objection',
      'positive_response',
      'negative_response',
      'opt_out',
      'request_human',
      'confirmation',
      'unclear',
      'greeting',
      'thanks',
      'reschedule'
    ].includes(value as string)
  }

  private determineNextGoal(
    currentGoal: ConversationGoal,
    intent: Intent,
    qualificationStatus: QualificationState['status']
  ): ConversationGoal {
    // If they want to opt out or need human, we're done
    if (intent === 'opt_out') return 'closing'
    if (intent === 'request_human') return 'closing'

    // If they want to reschedule, go to booking flow
    if (intent === 'reschedule') return 'offer_booking'

    // If they're showing booking interest and qualified, offer booking
    if (intent === 'booking_interest' && qualificationStatus === 'qualified') {
      return 'offer_booking'
    }

    // If they have a question, answer it
    if (intent === 'question') return 'answer_question'

    // If they have an objection, handle it
    if (intent === 'objection') return 'handle_objection'

    // If they're confirming, we might be booking
    if (intent === 'confirmation' && currentGoal === 'offer_booking') {
      return 'confirm_booking'
    }

    // If we haven't qualified yet and they're positive, try to qualify
    if (intent === 'positive_response' && qualificationStatus !== 'qualified') {
      return 'qualify_lead'
    }

    // If qualified and positive, offer booking
    if (intent === 'positive_response' && qualificationStatus === 'qualified') {
      return 'offer_booking'
    }

    // Default: stay on current goal or move to qualification
    if (currentGoal === 'initial_engagement') return 'qualify_lead'

    return currentGoal
  }

  private generateSummary(
    extractedInfo: ExtractedInfo,
    qualification: QualificationState,
    state: ConversationState
  ): string {
    const parts: string[] = []

    // Qualification status
    if (qualification.status === 'qualified') {
      parts.push('Contact is QUALIFIED.')
    } else if (qualification.status === 'partial') {
      parts.push(`Partially qualified (${qualification.criteriaMatched.length} criteria met).`)
    } else if (qualification.status === 'disqualified') {
      parts.push('Contact does NOT meet qualification criteria.')
    }

    // Key extracted info
    if (extractedInfo.isDecisionMaker === true) {
      parts.push('Is a decision maker.')
    }
    if (extractedInfo.hasActiveNeed === true) {
      parts.push('Has an active need.')
    }
    if (extractedInfo.timeline) {
      parts.push(`Timeline: ${extractedInfo.timeline}.`)
    }
    if (extractedInfo.budget) {
      parts.push(`Budget: ${extractedInfo.budget}.`)
    }

    // Objections
    if (extractedInfo.objections.length > 0) {
      parts.push(`Objections raised: ${extractedInfo.objections.join(', ')}.`)
    }

    // Preferred times
    if (extractedInfo.preferredTimes && extractedInfo.preferredTimes.length > 0) {
      parts.push(`Prefers: ${extractedInfo.preferredTimes.join(', ')}.`)
    }

    // Current state
    parts.push(`Turn ${state.turnCount}. Goal: ${state.currentGoal.replace(/_/g, ' ')}.`)

    return parts.join(' ')
  }
}

// Export singleton instance
export const contextManager = new ContextManager()
