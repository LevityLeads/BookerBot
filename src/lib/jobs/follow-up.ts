/**
 * Follow-up Job
 * Processes contacts that need follow-up messages
 *
 * This job runs via Vercel Cron and sends follow-up messages to contacts
 * who haven't responded within the configured delay period.
 */

import { createClient } from '@/lib/supabase/server'
import { sendOutboundMessage } from '@/lib/twilio/message-sender'
import { generateResponse } from '@/lib/ai/client'
import { contextManager } from '@/lib/ai/context-manager'
import { promptBuilder } from '@/lib/ai/prompt-builder'
import { isWithinBusinessHours } from './business-hours'
import { JobResult, JobError, BatchConfig, DEFAULT_BATCH_CONFIG, ProcessingStats } from './types'
import { Contact, Workflow, Client, Message, BusinessHours, Json, FollowUpTemplate } from '@/types/database'
import { WorkflowKnowledge } from '@/types/ai'

export type FollowUpContact = Contact & {
  workflows: Workflow & {
    clients: Client
  }
}

interface ProcessFollowUpOptions {
  /** Override batch config */
  config?: Partial<BatchConfig>
  /** Only process contacts for specific workflow */
  workflowId?: string
  /** Only process contacts for specific client */
  clientId?: string
  /** Dry run - don't actually send messages */
  dryRun?: boolean
}

/**
 * Process contacts that need follow-up messages
 */
export async function processFollowUps(
  options: ProcessFollowUpOptions = {}
): Promise<JobResult> {
  const startTime = Date.now()
  const config = { ...DEFAULT_BATCH_CONFIG, ...options.config }
  const errors: JobError[] = []
  const stats: ProcessingStats = {
    totalQueried: 0,
    withinBusinessHours: 0,
    outsideBusinessHours: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  const supabase = createClient()

  try {
    const now = new Date().toISOString()

    // Build query for contacts needing follow-up
    // Must be: contacted/in_conversation, not opted out, next_follow_up_at <= now,
    // follow_ups_sent < workflow.follow_up_count, workflow active
    let query = supabase
      .from('contacts')
      .select(`
        *,
        workflows!inner (
          *,
          clients!inner (*)
        )
      `)
      .in('status', ['contacted', 'in_conversation'])
      .eq('opted_out', false)
      .eq('workflows.status', 'active')
      .lte('next_follow_up_at', now)
      .order('next_follow_up_at', { ascending: true }) // Oldest first
      .limit(config.maxPerRun)

    if (options.workflowId) {
      query = query.eq('workflow_id', options.workflowId)
    }

    if (options.clientId) {
      query = query.eq('workflows.client_id', options.clientId)
    }

    const { data: contacts, error: queryError } = await query

    if (queryError) {
      console.error('Failed to query follow-up contacts:', queryError)
      return {
        success: false,
        processed: 0,
        failed: 0,
        skipped: 0,
        errors: [{ contactId: 'query', error: queryError.message, timestamp: new Date() }],
        duration: Date.now() - startTime,
      }
    }

    // Filter contacts that haven't exceeded follow-up limit
    const followUpContacts = ((contacts || []) as unknown as FollowUpContact[])
      .filter(c => c.follow_ups_sent < c.workflows.follow_up_count)

    stats.totalQueried = followUpContacts.length

    console.log(`[FollowUp] Found ${stats.totalQueried} contacts needing follow-up`)

    // Group contacts by client for business hours check
    const contactsByClient = new Map<string, FollowUpContact[]>()
    for (const contact of followUpContacts) {
      const clientId = contact.workflows.client_id
      if (!contactsByClient.has(clientId)) {
        contactsByClient.set(clientId, [])
      }
      contactsByClient.get(clientId)!.push(contact)
    }

    // Filter contacts within business hours
    const eligibleContacts: FollowUpContact[] = []

    for (const [clientId, clientContacts] of Array.from(contactsByClient.entries())) {
      const client = clientContacts[0].workflows.clients
      const businessHours = client.business_hours as BusinessHours
      const timezone = client.timezone

      if (isWithinBusinessHours(businessHours, timezone)) {
        eligibleContacts.push(...clientContacts)
        stats.withinBusinessHours += clientContacts.length
      } else {
        stats.outsideBusinessHours += clientContacts.length
        console.log(`[FollowUp] Skipping ${clientContacts.length} contacts for client ${clientId} - outside business hours`)
      }
    }

    console.log(`[FollowUp] ${stats.withinBusinessHours} contacts within business hours`)

    if (options.dryRun) {
      console.log('[FollowUp] Dry run - not sending messages')
      return {
        success: true,
        processed: stats.withinBusinessHours,
        failed: 0,
        skipped: stats.outsideBusinessHours,
        errors: [],
        duration: Date.now() - startTime,
      }
    }

    // Process eligible contacts with rate limiting
    for (let i = 0; i < eligibleContacts.length; i++) {
      const contact = eligibleContacts[i]

      try {
        console.log(`[FollowUp] Processing contact ${i + 1}/${eligibleContacts.length}: ${contact.id}`)

        const result = await sendFollowUpMessage(contact)

        if (result.success) {
          stats.sent++
          console.log(`[FollowUp] Sent to ${contact.id}`)
        } else {
          stats.failed++
          errors.push({
            contactId: contact.id,
            error: result.error || 'Unknown error',
            timestamp: new Date(),
          })
          console.error(`[FollowUp] Failed for ${contact.id}: ${result.error}`)
        }
      } catch (error) {
        stats.failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push({
          contactId: contact.id,
          error: errorMessage,
          timestamp: new Date(),
        })
        console.error(`[FollowUp] Exception for ${contact.id}:`, error)
      }

      // Rate limiting - delay between messages
      if (i < eligibleContacts.length - 1) {
        await sleep(config.delayBetweenMessages)
      }
    }

    const duration = Date.now() - startTime
    console.log(`[FollowUp] Complete: ${stats.sent} sent, ${stats.failed} failed, ${stats.skipped + stats.outsideBusinessHours} skipped in ${duration}ms`)

    return {
      success: stats.failed === 0,
      processed: stats.sent,
      failed: stats.failed,
      skipped: stats.outsideBusinessHours,
      errors,
      duration,
    }
  } catch (error) {
    console.error('[FollowUp] Fatal error:', error)
    return {
      success: false,
      processed: stats.sent,
      failed: stats.failed,
      skipped: stats.skipped,
      errors: [
        ...errors,
        {
          contactId: 'fatal',
          error: error instanceof Error ? error.message : 'Unknown fatal error',
          timestamp: new Date(),
        },
      ],
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Generate and send a follow-up message to a contact
 * Exported for use by manual follow-up API
 */
export async function sendFollowUpMessage(contact: FollowUpContact): Promise<{
  success: boolean
  error?: string
  followUpNumber?: number
  maxFollowUps?: number
  messageContent?: string
  aiGenerated?: boolean
}> {
  const supabase = createClient()

  const workflow = contact.workflows
  const client = workflow.clients
  const followUpNumber = contact.follow_ups_sent + 1
  const maxFollowUps = workflow.follow_up_count

  // Check if there's a custom template for this follow-up
  const templates = (workflow.follow_up_templates as FollowUpTemplate[] | null) || []
  const templateIndex = followUpNumber - 1
  const customTemplate = templates[templateIndex]

  let messageContent: string | null = null
  let aiGenerated = false
  let tokensUsed: number | undefined

  if (customTemplate && customTemplate.message) {
    // Use custom template with variable substitution
    messageContent = substituteVariables(customTemplate.message, {
      first_name: contact.first_name,
      last_name: contact.last_name,
      brand_name: client.brand_name || client.name,
      company_name: client.name,
    })
    console.log(`[FollowUp] Using custom template for follow-up #${followUpNumber}`)
  } else {
    // Fall back to AI generation
    console.log(`[FollowUp] No custom template for follow-up #${followUpNumber}, using AI generation`)

    // Get recent messages for context
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const recentMessages = (messages || []) as Message[]

    // Parse conversation context
    const context = contextManager.parse(contact.conversation_context)

    // Build workflow knowledge
    const knowledge: WorkflowKnowledge = {
      companyName: client.brand_name || client.name,
      brandSummary: '',
      services: [],
      targetAudience: '',
      tone: 'professional',
      commonObjections: [],
      faqs: [],
      recentNews: [],
      qualificationCriteria: parseQualificationCriteria(workflow.qualification_criteria),
      dos: [],
      donts: [],
      goal: 'Book an appointment',
      researchedAt: '',
      sourceUrl: '',
    }

    const systemPrompt = promptBuilder.buildFollowUpPrompt({
      contact: {
        firstName: contact.first_name,
        lastName: contact.last_name,
      },
      context,
      knowledge,
      followUpNumber,
      maxFollowUps,
      lastMessageDays: calculateDaysSinceLastMessage(contact.last_message_at),
      channel: workflow.channel as 'sms' | 'whatsapp',
    })

    try {
      // Build messages array with conversation history and system trigger
      const aiMessages = [
        ...formatConversationHistory(recentMessages),
        { role: 'user' as const, content: '[Generate follow-up message]' }
      ]

      const aiResponse = await generateResponse({
        model: 'claude-sonnet-4-20250514', // Use faster model for follow-ups
        systemPrompt,
        messages: aiMessages,
        maxTokens: workflow.channel === 'whatsapp' ? 250 : 150,
      })

      if (!aiResponse.content) {
        return { success: false, error: 'Failed to generate follow-up message' }
      }

      messageContent = aiResponse.content
      aiGenerated = true
      tokensUsed = aiResponse.usage?.total
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating follow-up',
      }
    }
  }

  if (!messageContent) {
    return { success: false, error: 'No message content to send' }
  }

  try {
    // Send the message
    const sendResult = await sendOutboundMessage({
      contactId: contact.id,
      message: messageContent,
      channel: workflow.channel as 'sms' | 'whatsapp',
      aiGenerated,
      tokensUsed,
    })

    if (!sendResult.success) {
      return { success: false, error: sendResult.error }
    }

    // Calculate next follow-up time
    // Use the next template's delay_hours if available, otherwise fall back to workflow default
    const nextTemplate = templates[followUpNumber]
    const delayHours = nextTemplate?.delay_hours ?? workflow.follow_up_delay_hours

    // Update contact: increment follow_ups_sent, set next_follow_up_at, update context
    const context = contextManager.parse(contact.conversation_context)
    const updatedContext = contextManager.incrementFollowUps(context)
    const nextFollowUpAt = calculateNextFollowUpTime(delayHours)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update({
        follow_ups_sent: contact.follow_ups_sent + 1,
        next_follow_up_at: nextFollowUpAt?.toISOString() || null,
        conversation_context: contextManager.serialize(updatedContext) as Json,
        last_message_at: new Date().toISOString(),
        // Mark as unresponsive if this was the last follow-up
        ...(followUpNumber >= maxFollowUps ? { status: 'unresponsive' } : {}),
      })
      .eq('id', contact.id)

    return {
      success: true,
      followUpNumber,
      maxFollowUps,
      messageContent,
      aiGenerated,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending follow-up',
      followUpNumber,
      maxFollowUps,
    }
  }
}

/**
 * Substitute variables in a template string
 */
function substituteVariables(
  template: string,
  variables: Record<string, string | null | undefined>
): string {
  let result = template

  for (const [key, value] of Object.entries(variables)) {
    // Support both {var} and {{var}} syntax
    const regex = new RegExp(`\\{\\{?${key}\\}\\}?`, 'gi')
    result = result.replace(regex, value || '')
  }

  return result
}

/**
 * Calculate next follow-up time respecting business hours
 * TODO: Adjust to next business hours start if outside hours
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calculateNextFollowUpTime(delayHours: number): Date | null {
  return new Date(Date.now() + delayHours * 60 * 60 * 1000)
}

/**
 * Calculate days since last message
 */
function calculateDaysSinceLastMessage(lastMessageAt: string | null): number {
  if (!lastMessageAt) return 0
  const lastDate = new Date(lastMessageAt)
  const now = new Date()
  return Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Format conversation history for AI context
 */
function formatConversationHistory(messages: Message[]): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .reverse() // Oldest first
    .map((m) => ({
      role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))
}

/**
 * Parse qualification criteria from workflow
 */
function parseQualificationCriteria(criteria: string | null): string[] {
  if (!criteria) return []
  return criteria
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
