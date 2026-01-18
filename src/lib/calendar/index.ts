/**
 * Calendar Integration Module
 * Factory and utilities for working with calendar providers
 */

export * from './types'
export { GoogleCalendarProvider } from './providers/google'
export {
  getAvailableSlots,
  formatSlotsForConversation,
  parseTimeSelection,
} from './availability'

import { CalendarProvider, CalendarProviderType, TokenSet } from './types'
import { GoogleCalendarProvider } from './providers/google'
import { createClient } from '@/lib/supabase/server'
import type { CalendarConnection } from '@/types/database'

/**
 * Get a calendar provider instance by type
 */
export function getCalendarProvider(
  providerType: CalendarProviderType,
  tokens?: TokenSet
): CalendarProvider {
  let provider: CalendarProvider

  switch (providerType) {
    case 'google':
      provider = new GoogleCalendarProvider()
      break
    case 'outlook':
      throw new Error('Outlook calendar not yet implemented')
    default:
      throw new Error(`Unknown calendar provider: ${providerType}`)
  }

  if (tokens) {
    provider.setTokens(tokens)
  }

  return provider
}

/**
 * Get calendar connection for a client, with automatic token refresh
 */
export async function getCalendarConnectionForClient(
  clientId: string
): Promise<{ connection: CalendarConnection; provider: CalendarProvider } | null> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: connection, error } = await (supabase as any)
    .from('calendar_connections')
    .select('*')
    .eq('client_id', clientId)
    .single() as { data: CalendarConnection | null; error: Error | null }

  if (error || !connection) {
    return null
  }

  const provider = getCalendarProvider(connection.provider as CalendarProviderType)

  // Check if token needs refresh
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at)
    : null

  let tokens: TokenSet = {
    accessToken: connection.access_token,
    refreshToken: connection.refresh_token,
    expiresAt,
  }

  // Refresh if expired or expiring in next 5 minutes
  if (expiresAt && expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    try {
      tokens = await provider.refreshTokens(connection.refresh_token)

      // Update stored tokens
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('calendar_connections')
        .update({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt?.toISOString() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id)
    } catch (err) {
      console.error('Failed to refresh calendar tokens:', err)
      // Return existing tokens, they might still work
    }
  }

  provider.setTokens(tokens)

  return { connection, provider }
}

/**
 * Delete calendar connection for a client
 */
export async function deleteCalendarConnection(clientId: string): Promise<void> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('calendar_connections')
    .delete()
    .eq('client_id', clientId)
}
