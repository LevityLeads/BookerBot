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
    let prompt = `You are an AI assistant having a natural conversation via ${channel.toUpperCase()} on behalf of ${knowledge.companyName}.

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
4. Be natural and conversational - you're chatting, not sending formal business communications
5. Never be pushy or aggressive about booking - let the conversation flow naturally

## RESPONSE FORMAT
- Address them by name (${contactName}) occasionally but not every message
- Keep it conversational and warm
- Ask ONE question at a time to keep things natural
- End with a question or clear next step when appropriate`

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
- Acknowledge their response warmly and naturally
- Show genuine interest in them and their situation
- Start to understand their needs through friendly conversation
${hasQualificationCriteria ? '- Begin naturally discovering qualification criteria (see below)' : ''}

DO NOT mention booking or appointments yet. Focus on building connection first.`

      case 'qualifying':
        return `You are in the QUALIFICATION phase.

Your goal right now:
- Continue the friendly conversation while naturally discovering if they meet the qualification criteria
- Ask thoughtful questions that help you understand their situation
- Listen to their responses and acknowledge what they share
- DO NOT suggest booking until you've confirmed they meet the qualification criteria

IMPORTANT: You still have unknown criteria to discover. Keep the conversation flowing naturally while learning more about them. Ask questions that help reveal whether they meet the criteria listed below.

The conversation should feel like a helpful chat, not an interrogation. Weave qualifying questions naturally into the dialogue.`

      case 'qualified':
        return `The contact appears to be QUALIFIED based on the criteria.

Your goal right now:
- If they seem interested and the timing is right, you can now mention that you'd love to set up a ${appointmentDuration}-minute call to discuss further
- Don't be pushy - gauge their interest first
- If they're not ready to book, that's fine - continue the helpful conversation

You've done the qualification work. Now you can naturally guide toward booking if they're interested.`

      case 'booking':
        return `You can discuss booking when appropriate.

Your goal:
- Have a helpful conversation
- If they express interest, suggest a ${appointmentDuration}-minute call
- Keep it natural and pressure-free`
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
    // Use Sonnet for fast, high-quality responses
    // Good balance of intelligence and speed for conversational messages
    // Channel param reserved for future per-channel model selection
    return 'claude-sonnet-4-20250514'
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
