// AI Conversation Engine - Main exports

export { generateResponse, classifyIntent, estimateCost } from './client'
export { researchBrand } from './brand-researcher'
export { contextManager, ContextManager } from './context-manager'
export { promptBuilder, PromptBuilder, buildInitialMessage } from './prompt-builder'
export { intentDetector, IntentDetector } from './intent-detector'
export { qualificationEngine, QualificationEngine } from './qualification-engine'
export { handoffHandler, HandoffHandler } from './handoff-handler'
export { orchestrator, ConversationOrchestrator } from './orchestrator'

// Re-export types
export type {
  BrandResearchInput,
  BrandResearchResult,
  WorkflowKnowledge,
  ConversationContext,
  Intent,
  IntentClassification,
  AIResponse,
  TokenUsage,
  ProcessMessageInput,
  ProcessMessageResult
} from '@/types/ai'

export { createInitialContext, createEmptyKnowledge } from '@/types/ai'
