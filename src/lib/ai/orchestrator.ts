import { createClient } from '@/lib/supabase/server'
import { generateResponse } from './client'
import { contextManager } from './context-manager'
import { promptBuilder } from './prompt-builder'
import { intentDetector } from './intent-detector'
import { qualificationEngine } from './qualification-engine'
import { handoffHandler } from './handoff-handler'
import {
  ProcessMessageInput,
  ProcessMessageResult,
  ConversationContext,
  WorkflowKnowledge,
  createEmptyKnowledge
} from '@/types/ai'
import { Contact, Message, Workflow, Client } from '@/types/database'

type ContactWithWorkflow = Contact & {
  workflows: Workflow & {
    clients: Client
  }
}

export class ConversationOrchestrator {
  async processMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
    const supabase = createClient()

    // 1. Load contact with workflow and client
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select(`
        *,
        workflows (
          *,
          clients (*)
        )
      `)
      .eq('id', input.contactId)
      .single()

    if (contactError || !contact) {
      throw new Error(`Contact not found: ${input.contactId}`)
    }

    const typedContact = contact as unknown as ContactWithWorkflow

    // 2. Check if we should process this contact
    if (typedContact.opted_out || typedContact.status === 'opted_out') {
      throw new Error('Contact has opted out')
    }

    if (typedContact.status === 'handed_off') {
      throw new Error('Contact is already handed off to human')
    }

    if (typedContact.workflows.status !== 'active') {
      throw new Error('Workflow is not active')
    }

    // 3. Parse conversation context
    const context = contextManager.parse(typedContact.conversation_context)

    // 4. Load message history
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('contact_id', input.contactId)
      .order('created_at', { ascending: true })

    const messageHistory = (messages || []) as Message[]

    // 5. Save inbound message to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      contact_id: input.contactId,
      direction: 'inbound',
      channel: typedContact.workflows.channel,
      content: input.message,
      status: 'received',
      ai_generated: false
    })

    // 6. Detect intent
    const intent = await intentDetector.detect(input.message, context)

    // 7. Check for opt-out first (fast path)
    if (intent.intent === 'opt_out') {
      return this.handleOptOut(typedContact, context, input.message)
    }

    // 8. Check for escalation triggers
    const escalationCheck = intentDetector.checkEscalationTriggers(input.message, context)
    if (escalationCheck.required || intent.requiresEscalation) {
      return this.handleEscalation(
        typedContact,
        context,
        escalationCheck.reason || intent.escalationReason || 'Unknown reason'
      )
    }

    // 9. Parse workflow knowledge
    const knowledge = this.parseWorkflowKnowledge(typedContact.workflows)

    // 10. Assess qualification
    const qualificationAssessment = await qualificationEngine.assess(
      knowledge.qualificationCriteria,
      context,
      messageHistory,
      input.message
    )

    // 11. Build prompt and generate response
    const promptConfig = promptBuilder.build({
      knowledge,
      contact: typedContact,
      context,
      messageHistory,
      currentMessage: input.message,
      channel: typedContact.workflows.channel,
      appointmentDuration: typedContact.workflows.appointment_duration_minutes,
      workflowInstructions: typedContact.workflows.instructions
    })

    const aiResponse = await generateResponse(promptConfig)

    // 12. Update context
    const updatedContext = contextManager.update(context, {
      intent: intent.intent,
      userMessage: input.message,
      aiResponse: aiResponse.content,
      qualificationUpdate: qualificationAssessment,
      extractedInfoUpdate: qualificationAssessment.extractedInfo
    })

    // 13. Determine status update
    const statusUpdate = this.determineStatusUpdate(
      typedContact.status,
      intent.intent,
      qualificationAssessment.status
    )

    // 14. Save AI response to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      contact_id: input.contactId,
      direction: 'outbound',
      channel: typedContact.workflows.channel,
      content: aiResponse.content,
      status: 'pending', // Will be updated when actually sent via Twilio
      ai_generated: true,
      tokens_used: aiResponse.usage.total
    })

    // 15. Update contact in database
    const updateData: Partial<Contact> = {
      conversation_context: contextManager.serialize(updatedContext),
      last_message_at: new Date().toISOString()
    }

    if (statusUpdate) {
      updateData.status = statusUpdate.newStatus
    }

    // Update to in_conversation if first response
    if (typedContact.status === 'pending' || typedContact.status === 'contacted') {
      updateData.status = 'in_conversation'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update(updateData)
      .eq('id', input.contactId)

    return {
      response: aiResponse.content,
      intent,
      contextUpdate: updatedContext,
      statusUpdate,
      tokensUsed: aiResponse.usage,
      shouldEscalate: false
    }
  }

  private async handleOptOut(
    contact: ContactWithWorkflow,
    context: ConversationContext,
    message: string
  ): Promise<ProcessMessageResult> {
    const supabase = createClient()

    // Get opt-out message from workflow
    const optOutMessage = contact.workflows.opt_out_message ||
      "You've been unsubscribed and won't receive any more messages from us. Take care!"

    // Update contact
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update({
        status: 'opted_out',
        opted_out: true,
        opted_out_at: new Date().toISOString()
      })
      .eq('id', contact.id)

    // Save the opt-out response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      contact_id: contact.id,
      direction: 'outbound',
      channel: contact.workflows.channel,
      content: optOutMessage,
      status: 'pending',
      ai_generated: true
    })

    const updatedContext = contextManager.update(context, {
      intent: 'opt_out',
      userMessage: message,
      aiResponse: optOutMessage
    })

    return {
      response: optOutMessage,
      intent: {
        intent: 'opt_out',
        confidence: 1.0,
        entities: {},
        requiresEscalation: false
      },
      contextUpdate: updatedContext,
      statusUpdate: {
        newStatus: 'opted_out',
        reason: 'Contact opted out'
      },
      tokensUsed: { input: 0, output: 0, total: 0, model: 'none' },
      shouldEscalate: false
    }
  }

  private async handleEscalation(
    contact: ContactWithWorkflow,
    context: ConversationContext,
    reason: string
  ): Promise<ProcessMessageResult> {
    // Generate handoff message
    const handoffMessage = handoffHandler.generateHandoffMessage(reason)

    // Escalate contact
    await handoffHandler.escalate(contact, reason)

    const updatedContext = contextManager.incrementEscalationAttempts(context)

    return {
      response: handoffMessage,
      intent: {
        intent: 'request_human',
        confidence: 1.0,
        entities: {},
        requiresEscalation: true,
        escalationReason: reason
      },
      contextUpdate: updatedContext,
      statusUpdate: {
        newStatus: 'handed_off',
        reason
      },
      tokensUsed: { input: 0, output: 0, total: 0, model: 'none' },
      shouldEscalate: true,
      escalationReason: reason
    }
  }

  private parseWorkflowKnowledge(workflow: Workflow & { clients?: Client }): WorkflowKnowledge {
    const knowledge = createEmptyKnowledge()
    const client = workflow.clients

    // Get qualification criteria from workflow
    const qualificationCriteria = workflow.qualification_criteria || ''
    if (qualificationCriteria) {
      knowledge.qualificationCriteria = qualificationCriteria
        .split('\n')
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 0)
    }

    // Workflow-specific info
    knowledge.goal = workflow.description || workflow.name

    // Brand info comes from Client (set via brand research)
    if (client) {
      knowledge.companyName = client.name
      knowledge.brandSummary = client.brand_summary || ''
      knowledge.services = (client.brand_services as string[]) || []
      knowledge.targetAudience = client.brand_target_audience || ''
      knowledge.tone = client.brand_tone || 'Professional and friendly'
      knowledge.faqs = (client.brand_faqs as Array<{ question: string; answer: string }>) || []
      knowledge.dos = (client.brand_dos as string[]) || [
        'Be helpful and answer questions',
        'Be respectful of their time',
        'Keep responses brief for SMS'
      ]
      knowledge.donts = (client.brand_donts as string[]) || [
        'Be pushy or aggressive',
        'Make promises you cannot keep',
        'Ignore opt-out requests'
      ]
    } else {
      // Fallback defaults
      knowledge.companyName = 'the company'
      knowledge.brandSummary = workflow.instructions?.slice(0, 200) || ''
      knowledge.tone = 'Professional and friendly'
      knowledge.services = []
      knowledge.targetAudience = ''
      knowledge.faqs = []
      knowledge.dos = [
        'Be helpful and answer questions',
        'Be respectful of their time',
        'Keep responses brief for SMS'
      ]
      knowledge.donts = [
        'Be pushy or aggressive',
        'Make promises you cannot keep',
        'Ignore opt-out requests'
      ]
    }

    knowledge.commonObjections = []

    return knowledge
  }

  private determineStatusUpdate(
    currentStatus: Contact['status'],
    intent: string,
    qualificationStatus: string
  ): { newStatus: Contact['status']; reason: string } | undefined {
    // Qualified contact
    if (qualificationStatus === 'qualified' && currentStatus !== 'qualified' && currentStatus !== 'booked') {
      return { newStatus: 'qualified', reason: 'Contact met qualification criteria' }
    }

    // Booking interest from qualified contact would trigger booking flow (Sprint 5)
    if (intent === 'booking_interest' && qualificationStatus === 'qualified') {
      // Will be handled by calendar integration in Sprint 5
      return undefined
    }

    return undefined
  }
}

// Export singleton instance
export const orchestrator = new ConversationOrchestrator()
