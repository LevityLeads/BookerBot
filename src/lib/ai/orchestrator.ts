import { createClient } from '@/lib/supabase/server'
import { generateResponse, generateResponseWithTools, estimateCost } from './client'
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

/**
 * Error types that can occur during message processing
 */
type OrchestratorErrorType =
  | 'contact_not_found'
  | 'contact_opted_out'
  | 'contact_handed_off'
  | 'workflow_inactive'
  | 'ai_generation_failed'
  | 'database_error'
  | 'unknown'

interface OrchestratorError extends Error {
  type: OrchestratorErrorType
  contactId?: string
  recoverable: boolean
}

/**
 * Create a typed error for the orchestrator
 */
function createOrchestratorError(
  type: OrchestratorErrorType,
  message: string,
  contactId?: string,
  recoverable = false
): OrchestratorError {
  const error = new Error(message) as OrchestratorError
  error.type = type
  error.contactId = contactId
  error.recoverable = recoverable
  return error
}

export class ConversationOrchestrator {
  /**
   * Process a message with error boundary protection.
   * This wrapper ensures graceful error handling and fallback responses.
   */
  async processMessageSafe(input: ProcessMessageInput): Promise<ProcessMessageResult> {
    try {
      return await this.processMessage(input)
    } catch (error) {
      console.error('[Orchestrator] Error processing message:', {
        contactId: input.contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      // Determine error type and generate appropriate response
      const orchError = error as OrchestratorError

      // For non-recoverable errors, re-throw so caller can handle
      if (orchError.type === 'contact_opted_out' ||
          orchError.type === 'contact_handed_off' ||
          orchError.type === 'workflow_inactive') {
        throw error
      }

      // For recoverable errors, return a graceful fallback response
      const fallbackMessage = this.getFallbackMessage(orchError.type)

      // Try to save the fallback response to the database
      try {
        const supabase = createClient()
        const { data: contact } = await supabase
          .from('contacts')
          .select('workflows(channel)')
          .eq('id', input.contactId)
          .single()

        // Safely extract channel with null checks
        let channel: 'sms' | 'whatsapp' = 'sms'
        if (contact && typeof contact === 'object' && 'workflows' in contact) {
          const workflows = contact.workflows as { channel?: string } | null
          if (workflows?.channel === 'whatsapp') {
            channel = 'whatsapp'
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('messages').insert({
          contact_id: input.contactId,
          direction: 'outbound',
          channel,
          content: fallbackMessage,
          status: 'pending',
          ai_generated: true,
          tokens_used: 0,
          ai_model: 'fallback-handler'
        })
      } catch (saveError) {
        console.error('[Orchestrator] Failed to save fallback response:', saveError)
      }

      return {
        response: fallbackMessage,
        intent: {
          intent: 'unclear',
          confidence: 0,
          entities: {},
          requiresEscalation: true,
          escalationReason: `System error: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        contextUpdate: {
          extractedInfo: { objections: [], additionalNotes: [] },
          qualification: {
            status: 'unknown',
            criteriaMatched: [],
            criteriaUnknown: [],
            criteriaMissed: []
          },
          state: {
            currentGoal: 'initial_engagement',
            turnCount: 0,
            lastIntent: 'unclear',
            escalationAttempts: 1,
            followUpsSent: 0,
            lastMessageAt: new Date().toISOString()
          },
          summary: 'Error occurred during processing',
          messageCount: 0
        },
        statusUpdate: undefined,
        tokensUsed: { input: 0, output: 0, total: 0, model: 'fallback' },
        shouldEscalate: true,
        escalationReason: `System error during message processing`
      }
    }
  }

  /**
   * Get an appropriate fallback message based on error type
   */
  private getFallbackMessage(errorType: OrchestratorErrorType): string {
    switch (errorType) {
      case 'ai_generation_failed':
        return "I'm having a bit of trouble right now. Let me have someone follow up with you shortly."
      case 'database_error':
        return "Technical hiccup on my end! Someone from the team will reach out to help you."
      case 'contact_not_found':
        return "I don't seem to have your details on file. Could you provide your name and what you're looking for?"
      default:
        return "Something went wrong on my end. Let me have a team member reach out to you directly."
    }
  }

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
      throw createOrchestratorError(
        'contact_not_found',
        `Contact not found: ${input.contactId}`,
        input.contactId,
        false
      )
    }

    const typedContact = contact as unknown as ContactWithWorkflow

    // 2. Check if we should process this contact
    if (typedContact.opted_out || typedContact.status === 'opted_out') {
      throw createOrchestratorError(
        'contact_opted_out',
        'Contact has opted out',
        input.contactId,
        false
      )
    }

    if (typedContact.status === 'handed_off') {
      throw createOrchestratorError(
        'contact_handed_off',
        'Contact is already handed off to human',
        input.contactId,
        false
      )
    }

    if (typedContact.workflows.status !== 'active') {
      throw createOrchestratorError(
        'workflow_inactive',
        'Workflow is not active',
        input.contactId,
        false
      )
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

    // 9.5. Check if previously disqualified contact should be given another chance
    let contextForAssessment = context
    const requalCheck = qualificationEngine.shouldAllowRequalification(
      context,
      input.message,
      typedContact.last_message_at
    )
    if (requalCheck.allow) {
      console.log('[Qualification] Allowing re-qualification for previously disqualified contact', {
        contactId: input.contactId,
        criteriaToReset: requalCheck.resetCriteria
      })
      contextForAssessment = qualificationEngine.resetCriteriaForReassessment(
        context,
        requalCheck.resetCriteria
      )
    }

    // 10. Assess qualification
    const qualificationAssessment = await qualificationEngine.assess(
      knowledge.qualificationCriteria,
      contextForAssessment,
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
          bookingState,
          input.message
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

    // If booking flow is active, use tool-based AI response for slot selection
    if (bookingState.isActive && bookingState.offeredSlots.length > 0) {
      console.log('[Booking Flow] Active booking - using tool-based flow', {
        isRescheduling: bookingState.isRescheduling,
        offeredSlotsCount: bookingState.offeredSlots.length,
      })

      // Build prompt config and use tool-based generation
      const promptConfig = promptBuilder.build({
        knowledge,
        contact: typedContact,
        context,
        messageHistory,
        currentMessage: input.message,
        channel: typedContact.workflows.channel,
        appointmentDuration: typedContact.workflows.appointment_duration_minutes,
        workflowInstructions: typedContact.workflows.instructions,
        offeredSlots: bookingState.offeredSlots,
        timezone: typedContact.workflows.clients.timezone || undefined,
        bookingFlowActive: true,
      })

      const toolResponse = await generateResponseWithTools({
        ...promptConfig,
        offeredSlots: bookingState.offeredSlots,
        lastOfferedSlot: bookingState.lastOfferedSlot,
        isRescheduling: bookingState.isRescheduling,
      })

      console.log('[Booking Flow] Tool response:', {
        hasToolCall: !!toolResponse.toolCall,
        toolName: toolResponse.toolCall?.name,
        hasText: !!toolResponse.text,
      })

      // If Claude used a tool, execute it
      if (toolResponse.toolCall) {
        const bookingResult = await bookingHandler.handleToolCall(
          typedContact,
          toolResponse.toolCall,
          bookingState,
          toolResponse.text
        )

        console.log('[Booking Flow] Tool execution result:', {
          appointmentCreated: bookingResult.appointmentCreated,
          appointmentRescheduled: bookingResult.appointmentRescheduled,
          appointmentId: bookingResult.appointmentId,
        })

        // Save response and return (using unified method with usage tracking)
        return this.saveBookingResponse(
          typedContact,
          context,
          bookingResult,
          input.message,
          toolResponse.usage
        )
      }

      // No tool call - Claude responded with just text (e.g., user asked a question)
      // Save the response and continue
      if (toolResponse.text) {
        const updatedContext = contextManager.update(context, {
          intent: intent.intent,
          userMessage: input.message,
          aiResponse: toolResponse.text,
          qualificationUpdate: qualificationAssessment,
          extractedInfoUpdate: qualificationAssessment.extractedInfo
        })

        const statusUpdate = this.determineStatusUpdate(
          typedContact.status,
          intent.intent,
          qualificationAssessment.status
        )

        // Save and return
        return this.saveAndReturnResponse(
          typedContact,
          updatedContext,
          bookingState,
          toolResponse.text,
          toolResponse.usage,
          input.message,
          intent,
          statusUpdate
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

    // Apply status update - prioritize qualification status over in_conversation transition
    if (statusUpdate) {
      // Qualification status takes precedence (qualified, disqualified, etc.)
      updateData.status = statusUpdate.newStatus
    } else if (typedContact.status === 'pending' || typedContact.status === 'contacted') {
      // Only transition to in_conversation if no qualification status update
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
   * Unified method to save booking flow response and update contact.
   * Consolidates saveBookingResponse and saveBookingResponseWithUsage.
   *
   * @param contact - The contact with workflow data
   * @param context - Current conversation context
   * @param bookingResult - Result from booking handler
   * @param userMessage - The user's original message
   * @param usage - Optional token usage (defaults to zero for non-AI responses)
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
    userMessage: string,
    usage: { input: number; output: number; total: number; model: string } = {
      input: 0,
      output: 0,
      total: 0,
      model: 'booking-handler'
    }
  ): Promise<ProcessMessageResult> {
    const supabase = await createClient()
    const aiCost = usage.total > 0 ? estimateCost(usage) : 0

    // Save the booking response message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      contact_id: contact.id,
      direction: 'outbound',
      channel: contact.workflows.channel,
      content: bookingResult.message,
      status: 'pending',
      ai_generated: true,
      tokens_used: usage.total,
      input_tokens: usage.input,
      output_tokens: usage.output,
      ai_model: usage.model,
      ai_cost: aiCost
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

    // Contact becomes booked after new booking (stays booked after reschedule)
    if (bookingResult.appointmentCreated) {
      updateData.status = 'booked'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update(updateData)
      .eq('id', contact.id)

    // Determine status update for return value
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
      tokensUsed: usage,
      shouldEscalate: false
    }
  }

  /**
   * Save and return a response (for tool-based flow when no tool was called)
   */
  private async saveAndReturnResponse(
    contact: ContactWithWorkflow,
    updatedContext: ConversationContext,
    bookingState: BookingState,
    responseText: string,
    usage: { input: number; output: number; total: number; model: string },
    userMessage: string,
    intent: { intent: string; confidence: number; entities: Record<string, string>; requiresEscalation: boolean },
    statusUpdate?: { newStatus: Contact['status']; reason: string }
  ): Promise<ProcessMessageResult> {
    const supabase = await createClient()
    const aiCost = estimateCost(usage)

    // Save AI response to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      contact_id: contact.id,
      direction: 'outbound',
      channel: contact.workflows.channel,
      content: responseText,
      status: 'pending',
      ai_generated: true,
      tokens_used: usage.total,
      input_tokens: usage.input,
      output_tokens: usage.output,
      ai_model: usage.model,
      ai_cost: aiCost
    })

    // Prepare conversation context with booking state
    const serializedContext = contextManager.serialize(updatedContext) as Record<string, unknown>
    const contextWithBooking = {
      ...serializedContext,
      bookingState: bookingHandler.serializeState(bookingState)
    }

    // Update contact
    const updateData: Partial<Contact> & { conversation_context: Json } = {
      conversation_context: contextWithBooking as Json,
      last_message_at: new Date().toISOString()
    }

    if (statusUpdate) {
      updateData.status = statusUpdate.newStatus
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update(updateData)
      .eq('id', contact.id)

    return {
      response: responseText,
      intent: {
        intent: intent.intent as ProcessMessageResult['intent']['intent'],
        confidence: intent.confidence,
        entities: intent.entities,
        requiresEscalation: intent.requiresEscalation
      },
      contextUpdate: updatedContext,
      statusUpdate,
      tokensUsed: usage,
      shouldEscalate: false
    }
  }
}

// Export singleton instance
export const orchestrator = new ConversationOrchestrator()
