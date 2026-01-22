import { NextResponse } from 'next/server'
import { generateResponse } from '@/lib/ai/client'
import { FollowUpTemplate } from '@/types/database'

interface GenerateFollowUpsBody {
  workflowId?: string
  instructions: string
  channel: 'sms' | 'whatsapp' | 'email'
  count?: number
  followUpNumber?: number
  totalFollowUps?: number
}

// POST /api/workflows/generate-followups - Generate follow-up templates with AI
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateFollowUpsBody

    if (!body.instructions) {
      return NextResponse.json(
        { error: 'Instructions are required to generate follow-ups' },
        { status: 400 }
      )
    }

    const count = body.count || 3
    const channel = body.channel || 'sms'

    // Build prompt for generating follow-ups
    const systemPrompt = buildGenerationPrompt(channel, count, body.followUpNumber, body.totalFollowUps)

    const response = await generateResponse({
      model: 'claude-sonnet-4-20250514',
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate ${body.followUpNumber ? '1 follow-up message' : `${count} follow-up messages`} for this offer:\n\n${body.instructions}`
        }
      ],
      maxTokens: 1500,
      temperature: 0.8,
    })

    // Parse the JSON response
    const templates = parseTemplatesResponse(response.content, count, body.followUpNumber)

    return NextResponse.json({
      templates,
      usage: response.usage,
    })
  } catch (error) {
    console.error('Failed to generate follow-ups:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate follow-ups' },
      { status: 500 }
    )
  }
}

function buildGenerationPrompt(
  channel: 'sms' | 'whatsapp' | 'email',
  count: number,
  followUpNumber?: number,
  totalFollowUps?: number
): string {
  const charLimit = channel === 'sms' ? 160 : channel === 'whatsapp' ? 300 : 500
  const channelName = channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'Email'

  const specificFollowUp = followUpNumber && totalFollowUps
    ? `\nYou are generating follow-up #${followUpNumber} of ${totalFollowUps} total.
${followUpNumber === 1 ? 'This is the FIRST follow-up - be friendly and assume they might have just been busy.' : ''}
${followUpNumber === totalFollowUps ? 'This is the FINAL follow-up - make it compelling but not desperate. Create gentle urgency.' : ''}`
    : ''

  return `You are a marketing copywriter creating follow-up messages for an automated outreach campaign.

## TASK
Generate ${followUpNumber ? '1 follow-up message' : `${count} follow-up messages`} for a ${channelName} campaign.
${specificFollowUp}

## MESSAGE REQUIREMENTS
- Channel: ${channelName}
- Max length: ${charLimit} characters per message
- Tone: Professional but conversational, human-sounding
- MUST support variable: {first_name} for personalization
- MAY use {brand_name} if relevant

## FOLLOW-UP STRATEGY
${!followUpNumber ? `
- Follow-up 1: Gentle reminder, assume they were busy. Reference the initial message.
- Follow-up 2: Add value or a new angle. Maybe share a benefit they might have missed.
- Follow-up 3+: Create urgency without being pushy. Final follow-up should feel like a last chance.
` : ''}

## WRITING RULES
1. NEVER start with "Hey" or "Hi" - the message should feel like a natural continuation
2. NEVER use cliches like "Just following up", "Wanted to touch base", "Circling back"
3. Each message should have a DIFFERENT angle/hook
4. Include a soft call-to-action (question or suggestion)
5. Sound human - use contractions, conversational language
6. Be concise - respect the character limit

## DELAY RECOMMENDATIONS
- Follow-up 1: 24-48 hours after initial message
- Follow-up 2: 48-72 hours after follow-up 1
- Follow-up 3+: 72-96 hours after previous

## OUTPUT FORMAT
Respond with ONLY valid JSON in this format:
{
  "templates": [
    { "message": "Your message here {first_name}...", "delay_hours": 24 },
    { "message": "Second message...", "delay_hours": 48 }
  ]
}

No explanations, no markdown code blocks - just the JSON object.`
}

function parseTemplatesResponse(
  content: string,
  expectedCount: number,
  followUpNumber?: number
): FollowUpTemplate[] {
  try {
    // Try to extract JSON from the response
    let jsonStr = content.trim()

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim()
    }

    const parsed = JSON.parse(jsonStr)

    if (parsed.templates && Array.isArray(parsed.templates)) {
      return parsed.templates.map((t: { message?: string; delay_hours?: number }) => ({
        message: t.message || '',
        delay_hours: t.delay_hours || 24,
      }))
    }

    // If the response is just an array
    if (Array.isArray(parsed)) {
      return parsed.map((t: { message?: string; delay_hours?: number }) => ({
        message: t.message || '',
        delay_hours: t.delay_hours || 24,
      }))
    }

    throw new Error('Invalid response format')
  } catch {
    console.error('Failed to parse follow-up templates, generating defaults')

    // Return default templates as fallback
    if (followUpNumber) {
      return [{ message: '', delay_hours: 24 * followUpNumber }]
    }

    return Array.from({ length: expectedCount }, (_, i) => ({
      message: '',
      delay_hours: 24 * (i + 1),
    }))
  }
}
