import Anthropic from '@anthropic-ai/sdk'
import { AIModel, TokenUsage, MessageForPrompt, AIResponseWithTools, BookingToolName, BookingToolInput } from '@/types/ai'
import { TimeSlot } from '@/lib/calendar'

// Singleton Anthropic client
let anthropicClient: Anthropic | null = null

function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

export interface ClaudeRequestConfig {
  model: AIModel
  systemPrompt: string
  messages: MessageForPrompt[]
  maxTokens: number
  temperature?: number
}

export interface ClaudeResponse {
  content: string
  usage: TokenUsage
  stopReason: string | null
}

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000] // Exponential backoff

export async function generateResponse(config: ClaudeRequestConfig): Promise<ClaudeResponse> {
  const client = getClient()

  // Convert our message format to Anthropic's format
  const anthropicMessages = config.messages.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content
  }))

  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature ?? 0.7,
        system: config.systemPrompt,
        messages: anthropicMessages
      })

      // Extract text content from response
      const textContent = response.content.find(block => block.type === 'text')
      const content = textContent?.type === 'text' ? textContent.text : ''

      return {
        content,
        usage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
          model: config.model
        },
        stopReason: response.stop_reason
      }
    } catch (error) {
      lastError = error as Error

      // Check if it's a rate limit error (429) or server error (5xx)
      const isRetryable =
        (error as { status?: number }).status === 429 ||
        ((error as { status?: number }).status ?? 0) >= 500

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[attempt])
        continue
      }

      throw error
    }
  }

  throw lastError || new Error('Failed to generate response after retries')
}

// Quick intent classification using a lighter prompt
export async function classifyIntent(
  message: string,
  conversationContext: string
): Promise<{ intent: string; confidence: number; requiresEscalation: boolean }> {
  const client = getClient()

  const systemPrompt = `You are an intent classifier for an appointment booking AI.
Classify the user's message into one of these intents:
- booking_interest: Wants to schedule/book something
- question: Asking a question about services, pricing, etc.
- objection: Expressing concerns or hesitation
- positive_response: Agreeing, confirming, showing interest
- negative_response: Declining, not interested (but not opting out)
- opt_out: Explicitly wants to stop receiving messages (STOP, unsubscribe, etc.)
- request_human: Wants to speak to a real person
- confirmation: Confirming details or appointment
- greeting: Just saying hello
- thanks: Expressing gratitude
- unclear: Cannot determine intent

Also determine if this requires human escalation.

Respond in JSON format:
{"intent": "...", "confidence": 0.0-1.0, "requiresEscalation": true/false}`

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Context: ${conversationContext}\n\nMessage to classify: "${message}"`
        }
      ]
    })

    const textContent = response.content.find(block => block.type === 'text')
    const text = textContent?.type === 'text' ? textContent.text : '{}'

    try {
      return JSON.parse(text)
    } catch {
      return { intent: 'unclear', confidence: 0.5, requiresEscalation: false }
    }
  } catch (error) {
    console.error('Intent classification error:', error)
    return { intent: 'unclear', confidence: 0, requiresEscalation: false }
  }
}

// Estimate cost for a conversation
export function estimateCost(tokens: TokenUsage): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-opus-4-5-20251101': { input: 15.00, output: 75.00 }
  }

  const modelPricing = pricing[tokens.model] || pricing['claude-opus-4-5-20251101']

  // Cost per million tokens
  const inputCost = (tokens.input / 1_000_000) * modelPricing.input
  const outputCost = (tokens.output / 1_000_000) * modelPricing.output

  return inputCost + outputCost
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================
// Tool-based Booking Flow
// ============================================

/**
 * Build tool definitions for booking flow
 * These tools let Claude express user intent in a structured way
 */
function buildBookingTools(offeredSlots: TimeSlot[]): Anthropic.Tool[] {
  const slotDescriptions = offeredSlots
    .map((s, i) => `${i + 1}. ${s.formatted}`)
    .join('\n')

  return [
    {
      name: 'select_time_slot',
      description: `Select a specific appointment time. Use when the user indicates they want a particular slot.

Available slots:
${slotDescriptions}

Use slot_index if they picked by number (e.g., "the first one" = 1, "option 2" = 2).
Use day_preference + time_24h if they specified a day and time (e.g., "Tuesday at 2pm" = day_preference: "tuesday", time_24h: "14:00").
Use just day_preference if they only said a day without a time (e.g., "Tuesday works" = day_preference: "tuesday") - you'll need to ask which time.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          slot_index: {
            type: 'number',
            description: '1-based index of the slot from the list (1, 2, 3, etc.)'
          },
          day_preference: {
            type: 'string',
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            description: 'Day of week the user mentioned'
          },
          time_24h: {
            type: 'string',
            description: 'Time in 24-hour HH:mm format (e.g., "14:00" for 2pm, "09:30" for 9:30am)'
          }
        }
      }
    },
    {
      name: 'confirm_booking',
      description: 'User confirmed the single/last offered slot with an affirmative response like "yes", "sounds good", "that works", "perfect". Only use when there was a single clear slot being offered and they agreed to it.',
      input_schema: {
        type: 'object' as const,
        properties: {}
      }
    },
    {
      name: 'request_different_times',
      description: 'User wants different time options than what was offered. They might say "none of those work", "do you have anything earlier", "what about next week", etc.',
      input_schema: {
        type: 'object' as const,
        properties: {
          reason: {
            type: 'string',
            description: 'Why the offered times don\'t work (if mentioned)'
          }
        }
      }
    },
    {
      name: 'request_human_help',
      description: 'User wants to speak to a human, is frustrated, or the conversation needs human intervention.',
      input_schema: {
        type: 'object' as const,
        properties: {
          reason: {
            type: 'string',
            description: 'Why human help is needed'
          }
        }
      }
    }
  ]
}

export interface BookingFlowConfig extends ClaudeRequestConfig {
  offeredSlots: TimeSlot[]
  lastOfferedSlot?: TimeSlot | null
  isRescheduling?: boolean
}

/**
 * Generate response with booking tools
 * Used when booking flow is active to get structured slot selections
 */
export async function generateResponseWithTools(
  config: BookingFlowConfig
): Promise<AIResponseWithTools> {
  const client = getClient()

  const anthropicMessages = config.messages.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content
  }))

  const tools = buildBookingTools(config.offeredSlots)

  // Enhance system prompt with tool usage instructions
  const enhancedSystemPrompt = `${config.systemPrompt}

## BOOKING TOOLS
You have tools to handle time slot selection. When the user responds about booking times:
- If they pick a specific slot (by number, day+time, or explicit reference) → use select_time_slot
- If they say "yes", "sounds good", "that works" to confirm a single offered slot → use confirm_booking
- If none of the times work for them → use request_different_times
- If they want human help → use request_human_help

IMPORTANT:
- Always use a tool when the user's message is about selecting, confirming, or changing appointment times.
- You can include a text response alongside the tool call if needed (e.g., to ask a clarifying question).
- If the user's message is NOT about appointment times (e.g., asking a question), just respond normally without tools.`

  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature ?? 0.7,
        system: enhancedSystemPrompt,
        messages: anthropicMessages,
        tools
      })

      // Extract text content (may exist alongside tool use)
      const textBlock = response.content.find(block => block.type === 'text')
      const text = textBlock?.type === 'text' ? textBlock.text : null

      // Extract tool use if present
      const toolBlock = response.content.find(block => block.type === 'tool_use')
      let toolCall = null

      if (toolBlock?.type === 'tool_use') {
        toolCall = {
          name: toolBlock.name as BookingToolName,
          input: toolBlock.input as BookingToolInput
        }
      }

      return {
        text,
        toolCall,
        usage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
          model: config.model
        },
        stopReason: response.stop_reason
      }
    } catch (error) {
      lastError = error as Error

      const isRetryable =
        (error as { status?: number }).status === 429 ||
        ((error as { status?: number }).status ?? 0) >= 500

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[attempt])
        continue
      }

      throw error
    }
  }

  throw lastError || new Error('Failed to generate response after retries')
}
