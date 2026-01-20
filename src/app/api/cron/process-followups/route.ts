/**
 * Cron Endpoint: Process Follow-ups
 *
 * This endpoint is called by Vercel Cron to process contacts
 * that need follow-up messages.
 *
 * Schedule: Every 15 minutes
 * Vercel Cron config: "0/15 * * * *"
 */

import { NextResponse } from 'next/server'
import { processFollowUps } from '@/lib/jobs/follow-up'

// Vercel Cron requires a specific secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET

export const maxDuration = 60 // Allow up to 60 seconds for processing
export const dynamic = 'force-dynamic' // Ensure no caching

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn('[Cron:FollowUp] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron:FollowUp] Starting job...')

  try {
    const result = await processFollowUps()

    console.log(`[Cron:FollowUp] Complete: processed=${result.processed}, failed=${result.failed}, skipped=${result.skipped}, duration=${result.duration}ms`)

    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      failed: result.failed,
      skipped: result.skipped,
      duration: result.duration,
      errors: result.errors.length > 0 ? result.errors.slice(0, 5) : undefined, // Limit errors in response
    })
  } catch (error) {
    console.error('[Cron:FollowUp] Fatal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering from admin
export async function POST(request: Request) {
  // For POST requests, also check for API key or session auth
  const authHeader = request.headers.get('authorization')

  // Check for cron secret or admin API key
  const isAuthorized =
    (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) ||
    authHeader?.startsWith('Bearer ') // Accept any bearer token for now (TODO: proper auth)

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse optional body for filters
  let options = {}
  try {
    const body = await request.json()
    options = {
      workflowId: body.workflowId,
      clientId: body.clientId,
      dryRun: body.dryRun,
    }
  } catch {
    // No body or invalid JSON - that's fine
  }

  console.log('[Cron:FollowUp] Manual trigger with options:', options)

  try {
    const result = await processFollowUps(options)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Cron:FollowUp] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
