import Anthropic from '@anthropic-ai/sdk'
import { QualificationState, ConversationContext, ExtractedInfo } from '@/types/ai'
import { Message } from '@/types/database'

interface QualificationAssessment {
  status: QualificationState['status']
  criteriaMatched: string[]
  criteriaUnknown: string[]
  criteriaMissed: string[]
  extractedInfo: Partial<ExtractedInfo>
}

export class QualificationEngine {
  private client: Anthropic | null = null

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set')
      }
      this.client = new Anthropic({ apiKey })
    }
    return this.client
  }

  async assess(
    criteria: string[],
    context: ConversationContext,
    messageHistory: Message[],
    latestMessage: string
  ): Promise<QualificationAssessment> {
    // If no criteria defined, consider qualified by default
    if (!criteria || criteria.length === 0) {
      return {
        status: 'qualified',
        criteriaMatched: [],
        criteriaUnknown: [],
        criteriaMissed: [],
        extractedInfo: {}
      }
    }

    // Build conversation text for analysis
    const conversationText = this.buildConversationText(messageHistory, latestMessage)

    // Use Claude to assess qualification
    try {
      const assessment = await this.assessWithClaude(criteria, conversationText, context)
      return assessment
    } catch (error) {
      console.error('Qualification assessment error:', error)
      // Return current state on error
      return {
        status: context.qualification.status,
        criteriaMatched: context.qualification.criteriaMatched,
        criteriaUnknown: context.qualification.criteriaUnknown,
        criteriaMissed: context.qualification.criteriaMissed,
        extractedInfo: {}
      }
    }
  }

  private buildConversationText(messages: Message[], latestMessage: string): string {
    const sorted = [...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const lines = sorted.map(msg =>
      `${msg.direction === 'inbound' ? 'Contact' : 'Assistant'}: ${msg.content}`
    )

    lines.push(`Contact: ${latestMessage}`)

    return lines.join('\n')
  }

  private async assessWithClaude(
    criteria: string[],
    conversationText: string,
    context: ConversationContext
  ): Promise<QualificationAssessment> {
    const client = this.getClient()

    const systemPrompt = `You are a qualification assessor. Your job is to analyze a conversation and determine if a contact meets qualification criteria.

For each criterion, determine:
1. MATCHED - Clear evidence in conversation that they meet this criterion
2. MISSED - Clear evidence they do NOT meet this criterion
3. UNKNOWN - Not enough information to determine

Also extract any useful information mentioned in the conversation.

Respond in JSON format only:
{
  "criteriaAssessment": [
    {"criterion": "...", "status": "matched|missed|unknown", "evidence": "..."}
  ],
  "extractedInfo": {
    "isDecisionMaker": true/false/null,
    "hasActiveNeed": true/false/null,
    "budget": "string or null",
    "timeline": "string or null",
    "companySize": "string or null",
    "objections": ["objection1"],
    "preferredTimes": ["morning", "Tuesday"],
    "additionalNotes": ["note1"]
  }
}`

    const userPrompt = `Analyze this conversation against the qualification criteria.

CRITERIA TO ASSESS:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

PREVIOUS ASSESSMENT:
- Already matched: ${context.qualification.criteriaMatched.join(', ') || 'None'}
- Previously missed: ${context.qualification.criteriaMissed.join(', ') || 'None'}

CONVERSATION:
${conversationText}

Assess each criterion and extract relevant information.`

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    const textContent = response.content.find(block => block.type === 'text')
    const text = textContent?.type === 'text' ? textContent.text : '{}'

    try {
      const result = JSON.parse(text)
      return this.processAssessment(result, criteria, context)
    } catch {
      // Return current state if parsing fails
      return {
        status: context.qualification.status,
        criteriaMatched: context.qualification.criteriaMatched,
        criteriaUnknown: context.qualification.criteriaUnknown,
        criteriaMissed: context.qualification.criteriaMissed,
        extractedInfo: {}
      }
    }
  }

  private processAssessment(
    result: {
      criteriaAssessment?: Array<{
        criterion: string
        status: string
        evidence?: string
      }>
      extractedInfo?: Partial<ExtractedInfo>
    },
    criteria: string[],
    context: ConversationContext
  ): QualificationAssessment {
    const assessments = result.criteriaAssessment || []

    // Merge with existing assessment
    const matched = new Set(context.qualification.criteriaMatched)
    const missed = new Set(context.qualification.criteriaMissed)
    const unknown = new Set<string>()

    for (const criterion of criteria) {
      const assessment = assessments.find(a =>
        a.criterion.toLowerCase().includes(criterion.toLowerCase().slice(0, 20)) ||
        criterion.toLowerCase().includes(a.criterion.toLowerCase().slice(0, 20))
      )

      if (assessment) {
        switch (assessment.status) {
          case 'matched':
            matched.add(criterion)
            missed.delete(criterion)
            break
          case 'missed':
            missed.add(criterion)
            matched.delete(criterion)
            break
          default:
            if (!matched.has(criterion) && !missed.has(criterion)) {
              unknown.add(criterion)
            }
        }
      } else {
        if (!matched.has(criterion) && !missed.has(criterion)) {
          unknown.add(criterion)
        }
      }
    }

    // Determine overall status
    let status: QualificationState['status']
    if (missed.size > 0) {
      status = 'disqualified'
    } else if (matched.size === criteria.length) {
      status = 'qualified'
    } else if (matched.size > 0) {
      status = 'partial'
    } else {
      status = 'unknown'
    }

    return {
      status,
      criteriaMatched: Array.from(matched),
      criteriaUnknown: Array.from(unknown),
      criteriaMissed: Array.from(missed),
      extractedInfo: result.extractedInfo || {}
    }
  }

  /**
   * Check if a disqualified contact should be given another chance.
   * Returns true if circumstances suggest re-assessment is warranted.
   *
   * Conditions for recovery:
   * 1. Enough time has passed (7+ days since disqualification)
   * 2. New message contains language suggesting circumstances changed
   * 3. Contact explicitly mentions they now meet previously-missed criteria
   */
  shouldAllowRequalification(
    context: ConversationContext,
    latestMessage: string,
    lastMessageAt: string | null
  ): { allow: boolean; resetCriteria: string[] } {
    // Only applies to disqualified contacts
    if (context.qualification.status !== 'disqualified') {
      return { allow: false, resetCriteria: [] }
    }

    // Check for time-based recovery (7+ days since last message)
    const daysSinceLastMessage = lastMessageAt
      ? (Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60 * 24)
      : 0

    const timeBasedRecovery = daysSinceLastMessage >= 7

    // Check for language suggesting changed circumstances
    const changeIndicators = [
      /things?\s+(have\s+)?changed/i,
      /situation\s+(is\s+)?different/i,
      /actually\s+(now|i\s+do|i\s+can|i\s+am)/i,
      /reconsidered/i,
      /changed\s+my\s+mind/i,
      /can\s+now/i,
      /now\s+(i|we)\s+(have|can|am|are)/i,
      /update[d]?\s+(on\s+)?my/i,
      /new\s+(budget|timeline|situation)/i,
      /got\s+(approval|budget|the\s+go-ahead)/i,
      /able\s+to\s+(proceed|move\s+forward)/i
    ]

    const messageBasedRecovery = changeIndicators.some(pattern =>
      pattern.test(latestMessage)
    )

    if (timeBasedRecovery || messageBasedRecovery) {
      // Reset all missed criteria to unknown for re-assessment
      return {
        allow: true,
        resetCriteria: [...context.qualification.criteriaMissed]
      }
    }

    return { allow: false, resetCriteria: [] }
  }

  /**
   * Reset specific criteria from missed to unknown state
   * Called when re-qualification is allowed
   */
  resetCriteriaForReassessment(
    context: ConversationContext,
    criteriaToReset: string[]
  ): ConversationContext {
    const newMissed = context.qualification.criteriaMissed.filter(
      c => !criteriaToReset.includes(c)
    )
    const newUnknown = [
      ...context.qualification.criteriaUnknown,
      ...criteriaToReset
    ].filter((v, i, a) => a.indexOf(v) === i)

    return {
      ...context,
      qualification: {
        ...context.qualification,
        // Revert to partial or unknown status to allow re-qualification
        status: context.qualification.criteriaMatched.length > 0 ? 'partial' : 'unknown',
        criteriaMissed: newMissed,
        criteriaUnknown: newUnknown
      }
    }
  }
}

// Export singleton instance
export const qualificationEngine = new QualificationEngine()
