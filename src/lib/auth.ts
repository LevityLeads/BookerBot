/**
 * Authentication helpers for API routes
 *
 * Currently auth is disabled. When ready to enable:
 * 1. Ensure Supabase auth is configured
 * 2. Set AUTH_ENABLED=true in environment
 * 3. Add requireAuth() calls to protected API routes
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Toggle to enable/disable auth enforcement
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true'

export interface AuthResult {
  authenticated: boolean
  userId?: string
  error?: NextResponse
}

/**
 * Check if request is authenticated
 * Returns the user ID if authenticated, or an error response if not
 */
export async function checkAuth(): Promise<AuthResult> {
  // If auth is disabled, allow all requests
  if (!AUTH_ENABLED) {
    return { authenticated: true, userId: 'anonymous' }
  }

  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        authenticated: false,
        error: NextResponse.json(
          { error: 'Unauthorized. Please log in.' },
          { status: 401 }
        ),
      }
    }

    return { authenticated: true, userId: user.id }
  } catch (error) {
    console.error('Auth check error:', error)
    return {
      authenticated: false,
      error: NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      ),
    }
  }
}

/**
 * Require authentication for an API route
 * Use at the start of protected route handlers
 *
 * Example:
 * ```
 * export async function GET(request: Request) {
 *   const auth = await requireAuth()
 *   if (auth.error) return auth.error
 *
 *   // Authenticated - proceed with route logic
 *   // auth.userId is available
 * }
 * ```
 */
export async function requireAuth(): Promise<AuthResult> {
  return checkAuth()
}

/**
 * Check if user has access to a specific client
 * Can be used for multi-tenant authorization
 */
export async function checkClientAccess(
  userId: string,
  clientId: string
): Promise<boolean> {
  // If auth is disabled, allow all access
  if (!AUTH_ENABLED) {
    return true
  }

  try {
    const supabase = createClient()

    // Check if user has access to this client
    // This assumes a user_clients join table or similar
    // Adjust based on your actual authorization model
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      // .eq('user_id', userId) // Uncomment when user_id field exists
      .single()

    return !error && !!data
  } catch (error) {
    console.error('Client access check error:', error)
    return false
  }
}
