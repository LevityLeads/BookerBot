import {
  PromptConfig,
  AIModel,
  ConversationContext,
  WorkflowKnowledge,
  MessageForPrompt
} from '@/types/ai'
import { Contact, Message } from '@/types/database'

interface PromptBuildParams {
  knowledge: WorkflowKnowledge
  contact: Contact
  context: ConversationContext
  messageHistory: Message[]
  currentMessage: string
  channel: 'sms' | 'whatsapp' | 'email'
  appointmentDuration: number
  workflowInstructions?: string // Custom instructions from the workflow
}

export class PromptBuilder {
  build(params: PromptBuildParams): PromptConfig {
    const systemPrompt = this.buildSystemPrompt(params)
    const messages = this.buildConversationHistory(params.messageHistory)

    // Add current message to history
    messages.push({
      role: 'user',
      content: params.currentMessage,
      timestamp: new Date().toISOString()
    })

    return {
      model: this.selectModel(params.channel),
      maxTokens: this.getMaxTokens(params.channel),
      temperature: 0.7,
      systemPrompt,
      messages
    }
  }

  private buildSystemPrompt(params: PromptBuildParams): string {
    const { knowledge, contact, context, channel, appointmentDuration, workflowInstructions } = params

    const contactName = contact.first_name || 'there'
    const channelConstraints = this.getChannelConstraints(channel)
    const conversationPhase = this.determineConversationPhase(context, knowledge)
    const phaseDirectives = this.getPhaseDirectives(conversationPhase, knowledge, appointmentDuration)

    // Build the system prompt with clear structure and priorities
    let prompt = `You're texting on behalf of ${knowledge.companyName}. Your job is to have a real, human conversation via ${channel.toUpperCase()} - not to sound like a chatbot or customer service rep.

## CRITICAL: YOUR PRIMARY DIRECTIVE
${phaseDirectives}

## CUSTOM INSTRUCTIONS FROM THE BUSINESS
${workflowInstructions || 'No additional instructions provided.'}

## ABOUT THE BUSINESS
Company: ${knowledge.companyName}
${knowledge.brandSummary ? `About: ${knowledge.brandSummary}` : ''}
${knowledge.services.length > 0 ? `Services: ${knowledge.services.join(', ')}` : ''}
${knowledge.targetAudience ? `Target Audience: ${knowledge.targetAudience}` : ''}

## COMMUNICATION STYLE
Tone: ${knowledge.tone}
${channelConstraints}

## CONTACT YOU'RE SPEAKING WITH
Name: ${contactName}${contact.last_name ? ' ' + contact.last_name : ''}
`

    // Add qualification section if criteria exist
    if (knowledge.qualificationCriteria.length > 0) {
      prompt += `
## QUALIFICATION CRITERIA (You must discover these through natural conversation)
${knowledge.qualificationCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## CURRENT QUALIFICATION STATUS
${this.formatQualificationStatus(context, knowledge)}
`
    }

    // Add conversation context
    prompt += `
## CONVERSATION CONTEXT
${context.summary || 'This is a new conversation - they just replied to your initial outreach.'}
Total messages exchanged: ${context.messageCount}
`

    // Add FAQs if available
    if (knowledge.faqs.length > 0) {
      prompt += `
## FAQS YOU CAN REFERENCE
${knowledge.faqs.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')}
`
    }

    // Add behavioral guidelines
    prompt += `
## BEHAVIORAL GUIDELINES
DO:
${knowledge.dos.map(d => `- ${d}`).join('\n')}

DON'T:
${knowledge.donts.map(d => `- ${d}`).join('\n')}

## IMPORTANT RULES
1. If they want to opt out (STOP, unsubscribe, etc.) - acknowledge politely and confirm removal
2. If they ask something you cannot answer - offer to have someone call them
3. If they explicitly ask for a human/person - acknowledge and say someone will reach out
4. Never be pushy or aggressive about booking - let the conversation flow naturally

## CRITICAL: SOUND LIKE A REAL HUMAN, NOT AN AI
You must write like a real person texting, not like a corporate chatbot or AI assistant.

NEVER use these AI-sounding patterns:
- "Great!" "Absolutely!" "Fantastic!" "Perfect!" (overly enthusiastic openers)
- "I'd be happy to help you with that"
- "That sounds exactly like..." or "This sounds like a great fit"
- "I completely understand"
- "Thank you for sharing that"
- "Based on what you've told me..."
- "I appreciate you..."
- Exclamation marks on every sentence
- Repeating back what they said before responding
- Being overly formal or corporate
- Perfect grammar in casual SMS (real people use incomplete sentences)

INSTEAD, write like a friendly coworker would text:
- Start mid-thought sometimes ("So you're looking at..." not "Great! So you're looking at...")
- Use casual language ("yeah" "gotcha" "makes sense" "cool")
- Be direct, not overly polite
- Show personality - be a bit informal
- It's OK to be brief. Real texts are often just a few words.
- Match their energy - if they're casual, be casual back

Examples of BAD vs GOOD responses:
BAD: "Great! Thank you for sharing that. It sounds like you're really interested in growing your business. I'd love to learn more about your situation!"
GOOD: "Nice, so you're looking to scale up. What's been the main bottleneck for you?"

BAD: "Absolutely! I completely understand. Based on what you've told me, it sounds like we could be a great fit."
GOOD: "Yeah that makes sense. We work with a lot of people in similar situations."

BAD: "That's fantastic! I appreciate you taking the time to explain your needs."
GOOD: "Gotcha. And roughly how many are you doing per month right now?"

## RESPONSE FORMAT
- Address them by name (${contactName}) occasionally but not every message
- Keep it conversational - you're texting, not writing an email
- Ask ONE question at a time to keep things natural
- Match their vibe and energy level`

    return prompt
  }

  private determineConversationPhase(
    context: ConversationContext,
    knowledge: WorkflowKnowledge
  ): 'rapport' | 'qualifying' | 'qualified' | 'booking' {
    const criteria = knowledge.qualificationCriteria
    const matched = context.qualification.criteriaMatched.length
    const total = criteria.length

    // No criteria = skip straight to rapport/booking
    if (total === 0) {
      return context.messageCount < 2 ? 'rapport' : 'booking'
    }

    // Early conversation - build rapport first
    if (context.messageCount < 2) {
      return 'rapport'
    }

    // Check qualification progress
    const qualificationProgress = total > 0 ? matched / total : 1

    if (qualificationProgress >= 1.0) {
      return 'qualified'
    } else if (context.qualification.status === 'qualified') {
      return 'qualified'
    } else {
      return 'qualifying'
    }
  }

  private getPhaseDirectives(
    phase: 'rapport' | 'qualifying' | 'qualified' | 'booking',
    knowledge: WorkflowKnowledge,
    appointmentDuration: number
  ): string {
    const hasQualificationCriteria = knowledge.qualificationCriteria.length > 0

    switch (phase) {
      case 'rapport':
        return `You are in the RAPPORT BUILDING phase.

Your goal right now:
- Respond naturally like you're texting a potential client
- Show genuine interest without being over-the-top about it
- Start understanding what they need through casual conversation
${hasQualificationCriteria ? '- Begin naturally discovering qualification criteria (see below)' : ''}

DO NOT mention booking or appointments yet. Just have a normal conversation first.`

      case 'qualifying':
        return `You are in the QUALIFICATION phase.

Your goal right now:
- Keep chatting naturally while figuring out if they're a good fit
- Ask questions that help you understand their situation (but don't sound like a survey)
- Actually listen to what they say - don't just wait to ask your next question
- DO NOT suggest booking until you've confirmed they meet the criteria below

You still need to learn more about them. Work the qualifying questions into normal conversation - don't rapid-fire questions at them. One question per message, max.`

      case 'qualified':
        return `They seem like a good fit based on what you've learned.

Your goal right now:
- If the vibe is right, casually mention hopping on a ${appointmentDuration}-min call
- Don't force it - if they're not feeling it, just keep talking
- Let them lead if they want to

You've learned what you needed. If it makes sense, steer toward scheduling something.`

      case 'booking':
        return `You can bring up booking whenever it feels natural.

Your goal:
- Have a real conversation
- If they seem interested, mention a ${appointmentDuration}-min call
- No pressure, no sales tactics`
    }
  }

  private formatQualificationStatus(
    context: ConversationContext,
    knowledge: WorkflowKnowledge
  ): string {
    const criteria = knowledge.qualificationCriteria
    const matched = context.qualification.criteriaMatched
    const missed = context.qualification.criteriaMissed

    if (criteria.length === 0) {
      return 'No qualification criteria set - focus on helpful conversation.'
    }

    let status = `Progress: ${matched.length}/${criteria.length} criteria confirmed\n`

    if (matched.length > 0) {
      status += `\n✓ CONFIRMED (don't need to ask about these again):\n${matched.map(c => `  - ${c}`).join('\n')}`
    }

    // Calculate truly unknown criteria
    const stillUnknown = criteria.filter(c => !matched.includes(c) && !missed.includes(c))
    if (stillUnknown.length > 0) {
      status += `\n\n? STILL NEED TO DISCOVER (weave these into natural conversation):\n${stillUnknown.map(c => `  - ${c}`).join('\n')}`
    }

    if (missed.length > 0) {
      status += `\n\n✗ NOT MET (they don't qualify on these):\n${missed.map(c => `  - ${c}`).join('\n')}`
    }

    return status
  }

  private getChannelConstraints(channel: 'sms' | 'whatsapp' | 'email'): string {
    switch (channel) {
      case 'sms':
        return `CRITICAL: This is SMS. Keep responses to 1-3 SHORT sentences max. Be concise but warm.`
      case 'whatsapp':
        return `This is WhatsApp. Keep responses brief (2-4 sentences max). Can use emojis sparingly if appropriate.`
      case 'email':
        return `This is email. You can be slightly more detailed but still keep it concise and scannable.`
      default:
        return `Keep responses brief and conversational.`
    }
  }

  private buildConversationHistory(messages: Message[]): MessageForPrompt[] {
    // Sort by created_at and convert to prompt format
    const sorted = [...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Limit to last 20 messages to avoid context overflow
    const recent = sorted.slice(-20)

    return recent.map(msg => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: msg.created_at
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private selectModel(channel: 'sms' | 'whatsapp' | 'email'): AIModel {
    // Use Opus 4.5 for highest quality, most natural conversations
    // Channel param reserved for future per-channel model selection
    return 'claude-opus-4-5-20251101'
  }

  private getMaxTokens(channel: 'sms' | 'whatsapp' | 'email'): number {
    switch (channel) {
      case 'sms':
        return 150 // Short but not too restricted
      case 'whatsapp':
        return 250
      case 'email':
        return 500
      default:
        return 200
    }
  }
}

// Build initial outreach message using template
export function buildInitialMessage(
  template: string,
  contact: Contact,
  brandName: string
): string {
  return template
    .replace(/\{first_name\}/gi, contact.first_name || 'there')
    .replace(/\{\{first_name\}\}/gi, contact.first_name || 'there')
    .replace(/\{last_name\}/gi, contact.last_name || '')
    .replace(/\{\{last_name\}\}/gi, contact.last_name || '')
    .replace(/\{full_name\}/gi,
      `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'there'
    )
    .replace(/\{\{full_name\}\}/gi,
      `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'there'
    )
    .replace(/\{brand_name\}/gi, brandName)
    .replace(/\{\{brand_name\}\}/gi, brandName)
    .replace(/\{company_name\}/gi, brandName)
    .replace(/\{\{company_name\}\}/gi, brandName)
    .replace(/\{phone\}/gi, contact.phone || '')
    .replace(/\{\{phone\}\}/gi, contact.phone || '')
    .replace(/\{email\}/gi, contact.email || '')
    .replace(/\{\{email\}\}/gi, contact.email || '')
    .trim()
}

// Export singleton instance
export const promptBuilder = new PromptBuilder()
