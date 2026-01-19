import { createClient } from '@/lib/supabase/server'
import { generateResponse, estimateCost } from './client'
import { contextManager } from './context-manager'
import { promptBuilder } from './prompt-builder'
import { intentDetector } from './intent-detector'
import { qualificationEngine } from './qualification-engine'
import { handoffHandler } from './handoff-handler'
import { bookingHandler, BookingState } from './booking-handler'
import {
  ProcessMessageInput,
  ProcessMessageResult,
  ConversationContext,
  WorkflowKnowledge,
  createEmptyKnowledge
} from '@/types/ai'
import { Contact, Message, Workflow, Client, Json } from '@/types/database'

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

    // 5. Detect intent (inbound message already saved by webhook caller)
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

    // 10.5. Handle booking flow
    const bookingState = bookingHandler.deserializeState(
      (typedContact.conversation_context as Record<string, unknown>)?.bookingState as Record<string, unknown>
    )

    console.log('[Booking Flow] State check:', {
      contactId: input.contactId,
      contactStatus: typedContact.status,
      contactEmail: typedContact.email || 'NO EMAIL',
      bookingActive: bookingState.isActive,
      offeredSlotsCount: bookingState.offeredSlots.length,
      offerAttempts: bookingState.offerAttempts,
      intent: intent.intent,
      qualificationStatus: qualificationAssessment.status,
    })

    // Handle reschedule requests for booked contacts
    if (intent.intent === 'reschedule' && typedContact.status === 'booked') {
      console.log('[Booking Flow] Reschedule request detected for booked contact')
      const hasCalendar = await bookingHandler.isCalendarConnected(
        typedContact.workflows.clients.id
      )

      if (hasCalendar) {
        const rescheduleResult = await bookingHandler.startReschedule(
          typedContact,
          bookingState
        )

        console.log('[Booking Flow] Reschedule result:', {
          continueWithAI: rescheduleResult.continueWithAI,
          isRescheduling: rescheduleResult.bookingState.isRescheduling,
        })

        if (!rescheduleResult.continueWithAI) {
          return this.saveBookingResponse(
            typedContact,
            context,
            rescheduleResult,
            input.message
          )
        }
      }
    }

    // If booking flow is active (including reschedule), try to handle time selection
    if (bookingState.isActive && bookingState.offeredSlots.length > 0) {
      console.log('[Booking Flow] Active booking - handling time selection', {
        isRescheduling: bookingState.isRescheduling,
      })
      const bookingResult = await bookingHandler.handleTimeSelection(
        typedContact,
        input.message,
        bookingState
      )

      console.log('[Booking Flow] Time selection result:', {
        appointmentCreated: bookingResult.appointmentCreated,
        appointmentRescheduled: bookingResult.appointmentRescheduled,
        appointmentId: bookingResult.appointmentId,
        continueWithAI: bookingResult.continueWithAI,
      })

      if (!bookingResult.continueWithAI) {
        // Booking was handled - save response and return
        return this.saveBookingResponse(
          typedContact,
          context,
          bookingResult,
          input.message
        )
      }
    }

    // If contact is qualified and shows booking interest, offer time slots
    if (
      (intent.intent === 'booking_interest' || qualificationAssessment.status === 'qualified') &&
      !bookingState.isActive &&
      typedContact.status !== 'booked'
    ) {
      console.log('[Booking Flow] Checking calendar for client:', typedContact.workflows.clients.id)
      const hasCalendar = await bookingHandler.isCalendarConnected(
        typedContact.workflows.clients.id
      )

      console.log('[Booking Flow] Calendar check:', {
        hasCalendar,
        offerAttempts: bookingState.offerAttempts,
        willOfferSlots: hasCalendar && bookingState.offerAttempts < 2,
      })

      if (hasCalendar && bookingState.offerAttempts < 2) {
        const bookingResult = await bookingHandler.offerTimeSlots(
          typedContact,
          bookingState
        )

        console.log('[Booking Flow] Offered slots result:', {
          slotsOffered: bookingResult.bookingState.offeredSlots.length,
          continueWithAI: bookingResult.continueWithAI,
        })

        if (!bookingResult.continueWithAI) {
          return this.saveBookingResponse(
            typedContact,
            context,
            bookingResult,
            input.message
          )
        }
      }
    } else {
      console.log('[Booking Flow] Not offering slots - conditions not met:', {
        isBookingInterest: intent.intent === 'booking_interest',
        isQualified: qualificationAssessment.status === 'qualified',
        bookingActive: bookingState.isActive,
        contactStatus: typedContact.status,
      })
    }

    // 11. Build prompt and generate response
    // Pass offered slots if booking flow is active so AI knows valid time options
    // Also flag if we're in an active booking flow - this means time selection failed
    // and AI must NOT confirm any booking
    const promptConfig = promptBuilder.build({
      knowledge,
      contact: typedContact,
      context,
      messageHistory,
      currentMessage: input.message,
      channel: typedContact.workflows.channel,
      appointmentDuration: typedContact.workflows.appointment_duration_minutes,
      workflowInstructions: typedContact.workflows.instructions,
      offeredSlots: bookingState.isActive ? bookingState.offeredSlots : undefined,
      timezone: typedContact.workflows.clients.timezone || undefined,
      bookingFlowActive: bookingState.isActive && bookingState.offeredSlots.length > 0,
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

    // 14. Save AI response to database with detailed token tracking
    const aiCost = estimateCost(aiResponse.usage)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      contact_id: input.contactId,
      direction: 'outbound',
      channel: typedContact.workflows.channel,
      content: aiResponse.content,
      status: 'pending', // Will be updated when actually sent via Twilio
      ai_generated: true,
      tokens_used: aiResponse.usage.total,
      input_tokens: aiResponse.usage.input,
      output_tokens: aiResponse.usage.output,
      ai_model: aiResponse.usage.model,
      ai_cost: aiCost
    })

    // 15. Update contact in database
    // Preserve booking state in the conversation context
    const serializedContext = contextManager.serialize(updatedContext) as Record<string, unknown>
    const contextWithBooking = {
      ...serializedContext,
      bookingState: bookingHandler.serializeState(bookingState)
    }
    const updateData: Partial<Contact> = {
      conversation_context: contextWithBooking as Json,
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

    // Booking handled separately by bookingHandler
    return undefined
  }

  /**
   * Save a booking flow response and update contact
   */
  private async saveBookingResponse(
    contact: ContactWithWorkflow,
    context: ConversationContext,
    bookingResult: {
      message: string
      bookingState: BookingState
      appointmentCreated: boolean
      appointmentRescheduled?: boolean
      appointmentId?: string
    },
    userMessage: string
  ): Promise<ProcessMessageResult> {
    const supabase = await createClient()

    // Save the booking response message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      contact_id: contact.id,
      direction: 'outbound',
      channel: contact.workflows.channel,
      content: bookingResult.message,
      status: 'pending',
      ai_generated: true,
      tokens_used: 0,
      input_tokens: 0,
      output_tokens: 0,
      ai_model: 'booking-handler',
      ai_cost: 0
    })

    // Determine intent based on what happened
    const wasCompleted = bookingResult.appointmentCreated || bookingResult.appointmentRescheduled
    const intentType = wasCompleted
      ? 'confirmation'
      : bookingResult.bookingState.isRescheduling
        ? 'reschedule'
        : 'booking_interest'

    // Update context with booking state
    const updatedContext = contextManager.update(context, {
      intent: intentType,
      userMessage,
      aiResponse: bookingResult.message
    })

    // Prepare conversation context with booking state
    const serializedContext = contextManager.serialize(updatedContext) as Record<string, unknown>
    const contextWithBooking = {
      ...serializedContext,
      bookingState: bookingHandler.serializeState(bookingResult.bookingState)
    }

    // Update contact
    const updateData: Partial<Contact> & { conversation_context: Json } = {
      conversation_context: contextWithBooking as Json,
      last_message_at: new Date().toISOString()
    }

    // Contact stays booked after reschedule, becomes booked after new booking
    if (bookingResult.appointmentCreated) {
      updateData.status = 'booked'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update(updateData)
      .eq('id', contact.id)

    // Determine status update
    let statusUpdate: { newStatus: Contact['status']; reason: string } | undefined
    if (bookingResult.appointmentCreated) {
      statusUpdate = { newStatus: 'booked', reason: 'Appointment booked' }
    } else if (bookingResult.appointmentRescheduled) {
      statusUpdate = { newStatus: 'booked', reason: 'Appointment rescheduled' }
    }

    return {
      response: bookingResult.message,
      intent: {
        intent: intentType,
        confidence: 1.0,
        entities: bookingResult.appointmentId
          ? { appointmentId: bookingResult.appointmentId }
          : {},
        requiresEscalation: false
      },
      contextUpdate: updatedContext,
      statusUpdate,
      tokensUsed: { input: 0, output: 0, total: 0, model: 'booking-handler' },
      shouldEscalate: false
    }
  }
}

// Export singleton instance
export const orchestrator = new ConversationOrchestrator()
