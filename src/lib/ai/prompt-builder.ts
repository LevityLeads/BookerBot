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
    const { knowledge, contact, context, channel, appointmentDuration } = params

    const contactName = contact.first_name || 'there'
    const channelConstraints = this.getChannelConstraints(channel)

    return `You are a helpful appointment booking assistant for ${knowledge.companyName}.

## YOUR IDENTITY
You represent ${knowledge.companyName}. ${knowledge.brandSummary}

## COMMUNICATION STYLE
Tone: ${knowledge.tone}
${channelConstraints}

## YOUR GOAL
${knowledge.goal}
Appointment duration: ${appointmentDuration} minutes

## ABOUT THE BUSINESS
Services: ${knowledge.services.join(', ')}
Target audience: ${knowledge.targetAudience}

## FAQS YOU CAN ANSWER
${knowledge.faqs.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')}

## COMMON OBJECTIONS & HOW TO HANDLE
${knowledge.commonObjections.map((obj, i) => `${i + 1}. "${obj}"`).join('\n')}

## QUALIFICATION CRITERIA
To qualify this contact, they should meet these criteria:
${knowledge.qualificationCriteria.map(c => `- ${c}`).join('\n')}

## RULES (MUST FOLLOW)
DO:
${knowledge.dos.map(d => `- ${d}`).join('\n')}

DON'T:
${knowledge.donts.map(d => `- ${d}`).join('\n')}

## CONTACT INFORMATION
Name: ${contactName}${contact.last_name ? ' ' + contact.last_name : ''}
${contact.phone ? `Phone: ${contact.phone}` : ''}
${contact.email ? `Email: ${contact.email}` : ''}

## CONVERSATION CONTEXT
${context.summary || 'This is a new conversation.'}
Qualification status: ${context.qualification.status}
${context.qualification.criteriaMatched.length > 0 ? `Criteria met: ${context.qualification.criteriaMatched.join(', ')}` : ''}
${context.qualification.criteriaUnknown.length > 0 ? `Still unknown: ${context.qualification.criteriaUnknown.join(', ')}` : ''}

## SPECIAL INSTRUCTIONS
1. If they want to opt out (STOP, unsubscribe, etc.), acknowledge politely and confirm you'll remove them.
2. If they ask something you cannot answer, offer to have someone call them.
3. If they explicitly ask for a human/person, acknowledge and say someone will reach out.
4. When they're qualified and interested, suggest booking a ${appointmentDuration}-minute call.
5. Be natural and conversational. You're chatting, not sending formal messages.

## RESPONSE FORMAT
- Address them by name (${contactName}) occasionally but not every message
- Keep it conversational and natural
- End with a question or clear next step when appropriate`
  }

  private getChannelConstraints(channel: 'sms' | 'whatsapp' | 'email'): string {
    switch (channel) {
      case 'sms':
        return `CRITICAL: This is SMS. Keep responses to 1-2 SHORT sentences. Max 160 characters if possible. Be concise.`
      case 'whatsapp':
        return `This is WhatsApp. Keep responses brief (2-3 sentences max). Can use emojis sparingly if appropriate.`
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

  private selectModel(channel: 'sms' | 'whatsapp' | 'email'): AIModel {
    // Use Opus 4.5 for best quality across all channels
    switch (channel) {
      case 'sms':
        return 'claude-opus-4-5-20251101'
      case 'whatsapp':
        return 'claude-opus-4-5-20251101'
      case 'email':
        return 'claude-opus-4-5-20251101'
      default:
        return 'claude-opus-4-5-20251101'
    }
  }

  private getMaxTokens(channel: 'sms' | 'whatsapp' | 'email'): number {
    switch (channel) {
      case 'sms':
        return 100 // ~160 chars target
      case 'whatsapp':
        return 200
      case 'email':
        return 500
      default:
        return 150
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
    .replace(/{first_name}/gi, contact.first_name || 'there')
    .replace(/{last_name}/gi, contact.last_name || '')
    .replace(/{full_name}/gi,
      `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'there'
    )
    .replace(/{brand_name}/gi, brandName)
    .replace(/{phone}/gi, contact.phone || '')
    .replace(/{email}/gi, contact.email || '')
    .trim()
}

// Export singleton instance
export const promptBuilder = new PromptBuilder()
