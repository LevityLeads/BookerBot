import {
  PromptConfig,
  AIModel,
  ConversationContext,
  WorkflowKnowledge,
  MessageForPrompt
} from '@/types/ai'
import { Contact, Message } from '@/types/database'
import { TimeSlot } from '@/lib/calendar'

interface PromptBuildParams {
  knowledge: WorkflowKnowledge
  contact: Contact
  context: ConversationContext
  messageHistory: Message[]
  currentMessage: string
  channel: 'sms' | 'whatsapp' | 'email'
  appointmentDuration: number
  workflowInstructions?: string // Custom instructions from the workflow
  offeredSlots?: TimeSlot[] // Available slots offered during booking flow
  timezone?: string // Client's timezone (e.g., 'Europe/London')
  bookingFlowActive?: boolean // True when booking flow is active but time selection couldn't be parsed
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
    // Combine offer description from workflow instructions with any brand info
    const hasOfferDescription = workflowInstructions && workflowInstructions.trim().length > 0
    const hasBrandSummary = knowledge.brandSummary && knowledge.brandSummary.trim().length > 0
    const hasServices = knowledge.services && knowledge.services.length > 0

    let prompt = `You're texting on behalf of ${knowledge.companyName}. Your job is to have a real, human conversation via ${channel.toUpperCase()} that authentically represents this brand.

## YOUR BRAND VOICE (CRITICAL)
${knowledge.tone}

Every message must sound like it was written by someone who actually works at ${knowledge.companyName}. This tone guides everything you write.

## WHAT YOU'RE SELLING (THIS IS YOUR OFFER - MEMORIZE IT)
${hasOfferDescription ? workflowInstructions : (hasBrandSummary ? knowledge.brandSummary : 'A premium service offering.')}

THIS IS WHAT YOU DO. When someone asks "what's the offer?" or "what do you do?" - you tell them THIS. Not a vague summary. Not "I don't have specifics." You explain EXACTLY what's written above because you work here and this is your job.

## YOUR PRIMARY DIRECTIVE
${phaseDirectives}

## ABOUT ${knowledge.companyName.toUpperCase()}
${hasBrandSummary ? `What we do: ${knowledge.brandSummary}\n` : ''}${hasServices ? `Our services:\n${knowledge.services.map(s => `- ${s}`).join('\n')}\n` : ''}${knowledge.targetAudience ? `Who we work with: ${knowledge.targetAudience}` : ''}

CRITICAL RULES:
1. You KNOW what you're selling - it's in "WHAT YOU'RE SELLING" above. USE IT.
2. NEVER say "I only have basic info" or "I don't have specifics" - that's a lie, you DO have the info.
3. NEVER make up generic descriptions like "we help with consultations" - use the ACTUAL offer description.
4. When they ask what you do, summarize the offer in 1-2 sentences using the real details above.

## CHANNEL CONSTRAINTS
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

    // Add current date/time context
    const timezone = params.timezone || 'Europe/London'
    const now = new Date()
    const dateFormatter = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    })
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const tomorrowFormatter = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: timezone,
    })

    prompt += `
## CURRENT DATE & TIME
Right now it's ${dateFormatter.format(now)} (${timezone})
Tomorrow is ${tomorrowFormatter.format(tomorrowDate)}

Use this to interpret relative dates like "tomorrow", "next Monday", etc.
`

    // Add conversation context
    prompt += `
## CONVERSATION CONTEXT
${context.summary || 'This is a new conversation - they just replied to your initial outreach.'}
Total messages exchanged: ${context.messageCount}
`

    // Add booking constraints if slots have been offered
    if (params.offeredSlots && params.offeredSlots.length > 0) {
      prompt += `
## CALENDAR AVAILABILITY (CRITICAL)
You've already checked the calendar. These are the ONLY available times:
${params.offeredSlots.map((slot, i) => `${i + 1}. ${slot.formatted}`).join('\n')}

Everything else is booked. You know this already - don't pretend to check again.
`

      // Add critical warning if booking flow is active but we fell through to AI
      // This means the booking system couldn't parse their time selection
      if (params.bookingFlowActive) {
        prompt += `
⚠️ CRITICAL: DO NOT CONFIRM ANY BOOKING ⚠️
The user's message was unclear or didn't match an available time slot.
You MUST ask them to specify which exact time works from the list above.
NEVER say "you're booked" or "I've scheduled" - no appointment has been created yet.
If they said something vague like "Monday works" → ask which TIME on Monday
If they said "sounds good" without specifying → ask which slot they want
`
      }

      prompt += `
HOW TO HANDLE TIME REQUESTS:
- RESPECT THEIR DAY PREFERENCE: If they ask for a specific day (e.g., "Wednesday", "Weds", "Thurs"), ONLY offer times on THAT day. Don't suggest a different day unless that day is unavailable.
- If they say "tomorrow at 12" → use the date above to figure out what day tomorrow is, then check if 12pm that day is in your list
- If they pick a SPECIFIC time from the list (like "Monday at 2pm") → confirm it (the booking system handles the rest)
- If they just say a day without a time (like "Monday works", "Weds", "Friday please") → ask which time on that SPECIFIC day - look at your available slots and list ONLY the times available on that day
- If they request a time NOT in the list → that time is taken. Tell them: "[time] is booked - I've got [mention 1-2 available times on the SAME DAY if possible]. Any of those work?"
- If their requested day has NO availability → tell them that day is full and ask about nearby days
- If none of the times work for them → offer to have someone reach out to find another option

CRITICAL - CONTEXT AND LOGIC:
- Pay attention to what they ACTUALLY asked for - if they want Wednesday, give them Wednesday options
- Don't randomly offer Monday when they asked about Wednesday
- Read the conversation context - understand what day/time they're interested in
- Be logical and helpful, not robotic

DO NOT:
- Offer times on DIFFERENT days than what they asked for (unless their day is unavailable)
- Confirm times that aren't in the list (they're genuinely unavailable)
- Say "let me check" or ask them to confirm the date - you already know the date
- Be overly apologetic - just be matter-of-fact
- EVER say "you're booked" unless they gave you a SPECIFIC time that matches one in your list
- Ignore their day preference and suggest random times
`
    }

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
1. USE YOUR OFFER DESCRIPTION - you have it, it's above. When they ask what you do, explain it from "WHAT YOU'RE SELLING"
2. If they want to opt out (STOP, unsubscribe, etc.) - acknowledge politely and confirm removal
3. If they ask for pricing/specifics beyond your offer description - offer to have someone call them with details
4. If they explicitly ask for a human/person - acknowledge and say someone will reach out
5. Never be pushy or aggressive about booking - let the conversation flow naturally

## SOUND HUMAN, NOT LIKE AI
Avoid these robotic AI patterns:
- "Great!" "Absolutely!" "Fantastic!" "Perfect!" (overly enthusiastic openers)
- "I'd be happy to help you with that"
- "That sounds exactly like..." or "This sounds like a great fit"
- "I completely understand" / "Thank you for sharing that"
- "Based on what you've told me..." / "I appreciate you..."
- Exclamation marks on every sentence
- Repeating back exactly what they said before responding

Instead, write like an actual human would text - but one who works for THIS brand:
- Get to the point without excessive pleasantries
- Be direct but not curt
- One thought per message, don't overload
- Match their energy level while staying true to the brand voice
- Brief is fine - not every message needs to be long

The goal: Sound like a real person who genuinely represents this brand, not a chatbot pretending to be human.

## RESPONSE FORMAT
- Address them by name (${contactName}) occasionally but not every message
- Keep it conversational but brand-appropriate
- Ask ONE question at a time
- Match their energy while maintaining the brand voice`

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
        return `They're a good fit. Time to see if they want to book something.

Your goal right now:
- Suggest a ${appointmentDuration}-min call if the conversation is heading that way
- If they're interested, ask what days/times generally work for them
- Don't be pushy - if they hesitate, that's fine, keep the conversation going

Keep it casual. Something like "Want to jump on a quick call to go over the details?" works better than a formal pitch.`

      case 'booking':
        return `They've shown interest in booking. Help them find a time.

Your goal:
- If they haven't seen available times yet, ask what days/times work for them
- If they've seen options and are responding, help them pick one
- Keep it simple - this is just scheduling, not a sales pitch

Treat it like you're texting a friend to find a time to meet up.`
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
