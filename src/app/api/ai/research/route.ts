import { NextResponse } from 'next/server'
import { researchBrand } from '@/lib/ai'
import { BrandResearchInput } from '@/types/ai'

export async function POST(request: Request) {
  try {
    const body = await request.json() as BrandResearchInput

    // Validate input
    if (!body.url) {
      return NextResponse.json(
        { error: 'url is required' },
        { status: 400 }
      )
    }

    if (!body.goal) {
      return NextResponse.json(
        { error: 'goal is required' },
        { status: 400 }
      )
    }

    if (!body.channel || !['sms', 'whatsapp', 'email'].includes(body.channel)) {
      return NextResponse.json(
        { error: 'channel must be one of: sms, whatsapp, email' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(body.url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Perform brand research
    const result = await researchBrand({
      url: body.url,
      goal: body.goal,
      channel: body.channel
    })

    return NextResponse.json({
      success: true,
      research: result
    })
  } catch (error) {
    console.error('Brand research error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { error: 'Failed to research brand', details: message },
      { status: 500 }
    )
  }
}
