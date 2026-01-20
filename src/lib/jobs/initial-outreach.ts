/**
 * Initial Outreach Job
 * Processes pending contacts and sends initial messages
 *
 * This job runs via Vercel Cron and processes contacts in batches
 * with rate limiting to avoid overwhelming Twilio.
 */

import { createClient } from '@/lib/supabase/server'
import { sendInitialOutreach } from '@/lib/twilio/message-sender'
import { isWithinBusinessHours } from './business-hours'
import { JobResult, JobError, BatchConfig, DEFAULT_BATCH_CONFIG, ProcessingStats } from './types'
import { Contact, Workflow, Client, BusinessHours } from '@/types/database'

type PendingContact = Contact & {
  workflows: Workflow & {
    clients: Client
  }
}

interface ProcessOutreachOptions {
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
 * Process pending contacts and send initial outreach messages
 */
export async function processInitialOutreach(
  options: ProcessOutreachOptions = {}
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
    // Build query for pending contacts in active workflows
    let query = supabase
      .from('contacts')
      .select(`
        *,
        workflows!inner (
          *,
          clients!inner (*)
        )
      `)
      .eq('status', 'pending')
      .eq('opted_out', false)
      .eq('workflows.status', 'active')
      .order('created_at', { ascending: true }) // FIFO - oldest first
      .limit(config.maxPerRun)

    if (options.workflowId) {
      query = query.eq('workflow_id', options.workflowId)
    }

    if (options.clientId) {
      query = query.eq('workflows.client_id', options.clientId)
    }

    const { data: contacts, error: queryError } = await query

    if (queryError) {
      console.error('Failed to query pending contacts:', queryError)
      return {
        success: false,
        processed: 0,
        failed: 0,
        skipped: 0,
        errors: [{ contactId: 'query', error: queryError.message, timestamp: new Date() }],
        duration: Date.now() - startTime,
      }
    }

    const pendingContacts = (contacts || []) as unknown as PendingContact[]
    stats.totalQueried = pendingContacts.length

    console.log(`[InitialOutreach] Found ${stats.totalQueried} pending contacts`)

    // Group contacts by client for business hours check
    const contactsByClient = new Map<string, PendingContact[]>()
    for (const contact of pendingContacts) {
      const clientId = contact.workflows.client_id
      if (!contactsByClient.has(clientId)) {
        contactsByClient.set(clientId, [])
      }
      contactsByClient.get(clientId)!.push(contact)
    }

    // Filter contacts within business hours
    const eligibleContacts: PendingContact[] = []

    for (const [clientId, clientContacts] of contactsByClient) {
      const client = clientContacts[0].workflows.clients
      const businessHours = client.business_hours as BusinessHours
      const timezone = client.timezone

      if (isWithinBusinessHours(businessHours, timezone)) {
        eligibleContacts.push(...clientContacts)
        stats.withinBusinessHours += clientContacts.length
      } else {
        stats.outsideBusinessHours += clientContacts.length
        console.log(`[InitialOutreach] Skipping ${clientContacts.length} contacts for client ${clientId} - outside business hours`)
      }
    }

    console.log(`[InitialOutreach] ${stats.withinBusinessHours} contacts within business hours`)

    if (options.dryRun) {
      console.log('[InitialOutreach] Dry run - not sending messages')
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
        console.log(`[InitialOutreach] Processing contact ${i + 1}/${eligibleContacts.length}: ${contact.id}`)

        const result = await sendInitialOutreach(contact.id)

        if (result.success) {
          stats.sent++
          console.log(`[InitialOutreach] Sent to ${contact.id}`)
        } else {
          stats.failed++
          errors.push({
            contactId: contact.id,
            error: result.error || 'Unknown error',
            timestamp: new Date(),
          })
          console.error(`[InitialOutreach] Failed for ${contact.id}: ${result.error}`)
        }
      } catch (error) {
        stats.failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push({
          contactId: contact.id,
          error: errorMessage,
          timestamp: new Date(),
        })
        console.error(`[InitialOutreach] Exception for ${contact.id}:`, error)
      }

      // Rate limiting - delay between messages
      if (i < eligibleContacts.length - 1) {
        await sleep(config.delayBetweenMessages)
      }
    }

    const duration = Date.now() - startTime
    console.log(`[InitialOutreach] Complete: ${stats.sent} sent, ${stats.failed} failed, ${stats.skipped + stats.outsideBusinessHours} skipped in ${duration}ms`)

    return {
      success: stats.failed === 0,
      processed: stats.sent,
      failed: stats.failed,
      skipped: stats.outsideBusinessHours,
      errors,
      duration,
    }
  } catch (error) {
    console.error('[InitialOutreach] Fatal error:', error)
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
