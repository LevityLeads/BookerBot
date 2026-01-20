/**
 * Job Types
 * Shared types for background job processing
 */

export interface JobResult {
  success: boolean
  processed: number
  failed: number
  skipped: number
  errors: JobError[]
  duration: number
}

export interface JobError {
  contactId: string
  error: string
  timestamp: Date
}

export interface BatchConfig {
  /** Number of contacts to process per batch */
  batchSize: number
  /** Delay between messages in milliseconds (rate limiting) */
  delayBetweenMessages: number
  /** Maximum contacts to process in a single job run */
  maxPerRun: number
}

/**
 * Default batch config - conservative for Twilio rate limits
 * Twilio allows ~1 msg/sec for local numbers, higher for short codes
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 10,
  delayBetweenMessages: 1000, // 1 second between messages
  maxPerRun: 50, // Max 50 per cron run (5 min job with delays)
}

export interface ProcessingStats {
  totalQueried: number
  withinBusinessHours: number
  outsideBusinessHours: number
  sent: number
  failed: number
  skipped: number
}
