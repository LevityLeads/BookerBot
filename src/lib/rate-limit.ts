/**
 * Simple in-memory rate limiter
 * For production, consider using @upstash/ratelimit with Redis
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store - resets on server restart
// For production, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  const entries = Array.from(rateLimitStore.entries())
  for (const [key, entry] of entries) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute

export interface RateLimitConfig {
  // Maximum number of requests allowed in the window
  limit: number
  // Time window in seconds
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
}

/**
 * Check rate limit for a given identifier
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns RateLimitResult indicating if request is allowed
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const resetTime = now + windowMs

  const entry = rateLimitStore.get(identifier)

  // If no entry or entry has expired, create new one
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime,
    })
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetTime,
    }
  }

  // Increment count
  entry.count++

  // Check if over limit
  if (entry.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header or falls back to a default
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  // Fallback - in production you'd want a more reliable identifier
  return 'anonymous'
}

/**
 * Pre-configured rate limits for different endpoint types
 */
export const RATE_LIMITS = {
  // AI endpoints - expensive, limit heavily
  ai: { limit: 30, windowSeconds: 60 }, // 30 requests per minute

  // Webhook endpoints - need to handle bursts
  webhook: { limit: 100, windowSeconds: 60 }, // 100 requests per minute

  // Standard API endpoints
  api: { limit: 60, windowSeconds: 60 }, // 60 requests per minute

  // Auth endpoints - protect against brute force
  auth: { limit: 10, windowSeconds: 60 }, // 10 requests per minute
} as const
