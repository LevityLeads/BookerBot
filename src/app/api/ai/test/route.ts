import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateResponse, estimateCost } from '@/lib/ai/client'
import { contextManager } from '@/lib/ai/context-manager'
import { promptBuilder } from '@/lib/ai/prompt-builder'
import { intentDetector } from '@/lib/ai/intent-detector'
import { createInitialContext, createEmptyKnowledge, WorkflowKnowledge, TestTurnResult } from '@/types/ai'
import { Workflow, Client } from '@/types/database'

type WorkflowWithClient = Workflow & { clients: Client | null }

interface TestRequest {
  workflowId?: string
  customKnowledge?: Partial<WorkflowKnowledge>
  mockContact?: {
    firstName: string
    lastName: string
    phone: string
  }
  message: string
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const body = await request.json() as TestRequest

    if (!body.message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      )
    }

    // Get or create knowledge base
    let knowledge = createEmptyKnowledge()

    if (body.workflowId) {
      // Load workflow from database
      const supabase = createClient()
      const { data: workflow, error } = await supabase
        .from('workflows')
        .select(`
          *,
          clients (*)
        `)
        .eq('id', body.workflowId)
        .single()

      if (error || !workflow) {
        return NextResponse.json(
          { error: 'Workflow not found' },
          { status: 404 }
        )
      }

      const typedWorkflow = workflow as unknown as WorkflowWithClient

      // Parse knowledge from workflow
      knowledge = {
        ...knowledge,
        companyName: typedWorkflow.clients?.brand_name || typedWorkflow.clients?.name || 'Test Company',
        goal: typedWorkflow.name,
        brandSummary: typedWorkflow.instructions?.slice(0, 200) || '',
        qualificationCriteria: typedWorkflow.qualification_criteria
          ? typedWorkflow.qualification_criteria.split('\n').filter((l: string) => l.trim())
          : [],
        dos: ['Be helpful', 'Answer questions clearly'],
        donts: ['Be pushy', 'Ignore opt-out requests'],
        tone: 'Professional and friendly'
      }
    }

    // Override with custom knowledge if provided
    if (body.customKnowledge) {
      knowledge = { ...knowledge, ...body.customKnowledge }
    }

    // Set defaults if not provided
    if (!knowledge.companyName) knowledge.companyName = 'Test Company'
    if (!knowledge.goal) knowledge.goal = 'Book appointments'
    if (!knowledge.tone) knowledge.tone = 'Professional and friendly'

    // Create mock contact
    const mockContact = {
      id: 'test-contact',
      workflow_id: body.workflowId || 'test-workflow',
      first_name: body.mockContact?.firstName || 'Test',
      last_name: body.mockContact?.lastName || 'User',
      phone: body.mockContact?.phone || '+1234567890',
      email: null,
      custom_fields: {},
      status: 'in_conversation' as const,
      opted_out: false,
      opted_out_at: null,
      follow_ups_sent: 0,
      next_follow_up_at: null,
      conversation_context: null,
      created_at: new Date().toISOString(),
      last_message_at: null
    }

    // Build conversation context
    const context = createInitialContext()
    if (body.conversationHistory && body.conversationHistory.length > 0) {
      // Update context based on conversation history
      context.state.turnCount = body.conversationHistory.length
    }

    // Convert history to message format
    const messageHistory = (body.conversationHistory || []).map((msg, i) => ({
      id: `msg-${i}`,
      contact_id: 'test-contact',
      direction: msg.role === 'user' ? 'inbound' as const : 'outbound' as const,
      channel: 'sms' as const,
      content: msg.content,
      status: 'delivered' as const,
      twilio_sid: null,
      error_message: null,
      ai_generated: msg.role === 'assistant',
      tokens_used: null,
      created_at: new Date(Date.now() - (body.conversationHistory!.length - i) * 60000).toISOString()
    }))

    // Detect intent
    const intent = await intentDetector.detect(body.message, context)

    // Build prompt
    const promptConfig = promptBuilder.build({
      knowledge,
      contact: mockContact,
      context,
      messageHistory,
      currentMessage: body.message,
      channel: 'sms',
      appointmentDuration: 30
    })

    // Generate response
    const aiResponse = await generateResponse(promptConfig)

    const responseTimeMs = Date.now() - startTime

    // Calculate cost
    const cost = estimateCost(aiResponse.usage)

    const turnResult: TestTurnResult = {
      turnNumber: context.state.turnCount + 1,
      userMessage: body.message,
      aiResponse: aiResponse.content,
      detectedIntent: intent.intent,
      tokensUsed: aiResponse.usage.total,
      responseTimeMs
    }

    return NextResponse.json({
      success: true,
      turn: turnResult,
      intent,
      context: contextManager.update(context, {
        intent: intent.intent,
        userMessage: body.message,
        aiResponse: aiResponse.content
      }),
      usage: {
        ...aiResponse.usage,
        estimatedCost: cost
      },
      debug: {
        model: promptConfig.model,
        systemPromptLength: promptConfig.systemPrompt.length,
        historyLength: messageHistory.length
      }
    })
  } catch (error) {
    console.error('AI test error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { error: 'Test failed', details: message },
      { status: 500 }
    )
  }
}
