// AI Conversation Engine Types

import { Contact } from './database'

// ============================================
// Brand Research & Knowledge Types
// ============================================

export interface BrandResearchInput {
  url: string
  goal: string
  channel: 'sms' | 'whatsapp' | 'email'
}

export interface BrandResearchResult {
  // Core brand understanding
  brandSummary: string
  companyName: string
  industry: string

  // What they offer
  services: string[]
  uniqueSellingPoints: string[]
  pricingInfo: string | null

  // Who they serve
  targetAudience: string
  idealCustomerProfile: string

  // Communication style
  suggestedTone: string
  brandVoiceExamples: string[]

  // Handling conversations
  commonObjections: string[]
  faqs: FAQ[]

  // Context
  recentNews: string[]
  socialPresence: string[]

  // Suggested configuration
  suggestedQualificationCriteria: string[]
  suggestedDosAndDonts: {
    dos: string[]
    donts: string[]
  }
}

export interface FAQ {
  question: string
  answer: string
}

// ============================================
// Workflow Knowledge (stored in DB)
// ============================================

export interface WorkflowKnowledge {
  // Research results (auto-generated)
  brandSummary: string
  companyName: string
  services: string[]
  targetAudience: string
  tone: string
  commonObjections: string[]
  faqs: FAQ[]
  recentNews: string[]

  // User-confirmed/edited
  qualificationCriteria: string[]
  dos: string[]
  donts: string[]
  goal: string

  // Metadata
  researchedAt: string
  sourceUrl: string
}

// ============================================
// Conversation Context Types
// ============================================

export interface ConversationContext {
  // Information extracted from conversation
  extractedInfo: ExtractedInfo

  // Qualification tracking
  qualification: QualificationState

  // Conversation state
  state: ConversationState

  // Summary for prompt injection
  summary: string
}

export interface ExtractedInfo {
  isDecisionMaker?: boolean
  hasActiveNeed?: boolean
  budget?: string
  timeline?: string
  companySize?: string
  objections: string[]
  preferredContactMethod?: string
  preferredTimes?: string[]
  additionalNotes: string[]
}

export interface QualificationState {
  status: 'unknown' | 'partial' | 'qualified' | 'disqualified'
  criteriaMatched: string[]
  criteriaUnknown: string[]
  criteriaMissed: string[]
}

export interface ConversationState {
  currentGoal: ConversationGoal
  turnCount: number
  lastIntent: Intent
  escalationAttempts: number
  followUpsSent: number
  lastMessageAt: string | null
}

export type ConversationGoal =
  | 'initial_engagement'
  | 'qualify_lead'
  | 'handle_objection'
  | 'answer_question'
  | 'offer_booking'
  | 'confirm_booking'
  | 'follow_up'
  | 'closing'

// ============================================
// Intent Classification Types
// ============================================

export type Intent =
  | 'booking_interest'
  | 'question'
  | 'objection'
  | 'positive_response'
  | 'negative_response'
  | 'opt_out'
  | 'request_human'
  | 'confirmation'
  | 'unclear'
  | 'greeting'
  | 'thanks'

export interface IntentClassification {
  intent: Intent
  confidence: number
  entities: Record<string, string>
  requiresEscalation: boolean
  escalationReason?: string
}

// ============================================
// AI Response Types
// ============================================

export interface AIResponse {
  content: string
  intent: IntentClassification
  contextUpdate: ConversationContext
  statusUpdate?: ContactStatusUpdate
  tokensUsed: TokenUsage
  shouldEscalate: boolean
  escalationReason?: string
}

export interface ContactStatusUpdate {
  newStatus: Contact['status']
  reason: string
}

export interface TokenUsage {
  input: number
  output: number
  total: number
  model: string
}

// ============================================
// Prompt Building Types
// ============================================

export interface PromptConfig {
  model: AIModel
  maxTokens: number
  temperature: number
  systemPrompt: string
  messages: MessageForPrompt[]
}

export type AIModel =
  | 'claude-3-haiku-20240307'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-opus-4-5-20251101'

export interface MessageForPrompt {
  role: 'assistant' | 'user'
  content: string
  timestamp?: string
}

export interface ContactForPrompt {
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  customFields: Record<string, unknown>
}

export interface WorkflowForPrompt {
  knowledge: WorkflowKnowledge
  channel: 'sms' | 'whatsapp' | 'email'
  appointmentDuration: number
}

// ============================================
// Orchestrator Types
// ============================================

export interface ProcessMessageInput {
  contactId: string
  message: string
}

export interface ProcessMessageResult {
  response: string
  intent: IntentClassification
  contextUpdate: ConversationContext
  statusUpdate?: ContactStatusUpdate
  tokensUsed: TokenUsage
  shouldEscalate: boolean
  escalationReason?: string
}

// ============================================
// Testing Harness Types
// ============================================

export interface TestConversation {
  workflowId: string
  mockContact: {
    firstName: string
    lastName: string
    phone: string
  }
  messages: TestMessage[]
}

export interface TestMessage {
  role: 'user' | 'assistant'
  content: string
  intent?: Intent
  timestamp: string
}

export interface TestResult {
  conversationId: string
  turns: TestTurnResult[]
  summary: {
    totalTurns: number
    totalTokens: number
    estimatedCost: number
    finalQualificationStatus: QualificationState['status']
    escalated: boolean
  }
}

export interface TestTurnResult {
  turnNumber: number
  userMessage: string
  aiResponse: string
  detectedIntent: Intent
  tokensUsed: number
  responseTimeMs: number
}

// ============================================
// Utility Types
// ============================================

export function createInitialContext(): ConversationContext {
  return {
    extractedInfo: {
      objections: [],
      additionalNotes: []
    },
    qualification: {
      status: 'unknown',
      criteriaMatched: [],
      criteriaUnknown: [],
      criteriaMissed: []
    },
    state: {
      currentGoal: 'initial_engagement',
      turnCount: 0,
      lastIntent: 'unclear',
      escalationAttempts: 0,
      followUpsSent: 0,
      lastMessageAt: null
    },
    summary: ''
  }
}

export function createEmptyKnowledge(): WorkflowKnowledge {
  return {
    brandSummary: '',
    companyName: '',
    services: [],
    targetAudience: '',
    tone: '',
    commonObjections: [],
    faqs: [],
    recentNews: [],
    qualificationCriteria: [],
    dos: [],
    donts: [],
    goal: '',
    researchedAt: '',
    sourceUrl: ''
  }
}
