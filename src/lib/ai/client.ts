import Anthropic from '@anthropic-ai/sdk'
import { AIModel, TokenUsage, MessageForPrompt } from '@/types/ai'

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
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 }
  }

  const modelPricing = pricing[tokens.model] || pricing['claude-3-5-haiku-20241022']

  // Cost per million tokens
  const inputCost = (tokens.input / 1_000_000) * modelPricing.input
  const outputCost = (tokens.output / 1_000_000) * modelPricing.output

  return inputCost + outputCost
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
