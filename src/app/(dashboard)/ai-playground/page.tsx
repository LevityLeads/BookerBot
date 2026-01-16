'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  DollarSign,
  Zap,
  Target,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Calendar
} from 'lucide-react'
import { ConversationContext, Intent, createInitialContext } from '@/types/ai'

interface Message {
  role: 'user' | 'assistant'
  content: string
  intent?: Intent
  tokensUsed?: number
  responseTimeMs?: number
}

interface TestConfig {
  companyName: string
  brandSummary: string
  goal: string
  tone: string
  services: string
  qualificationCriteria: string
}

const DEFAULT_CONFIG: TestConfig = {
  companyName: 'Levity Leads',
  brandSummary: 'Levity Leads is a B2B lead generation agency helping companies scale their sales pipeline through AI-powered outreach.',
  goal: 'Book discovery calls with qualified leads',
  tone: 'Professional but friendly, conversational',
  services: 'Lead generation, Appointment setting, Sales automation',
  qualificationCriteria: 'Business owner or decision maker\nCompany has 10+ employees\nActive need for lead generation'
}

export default function AIPlaygroundPage() {
  const [config, setConfig] = useState<TestConfig>(DEFAULT_CONFIG)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<ConversationContext>(createInitialContext())
  const [totalTokens, setTotalTokens] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [showConfig, setShowConfig] = useState(true)
  const [callBooked, setCallBooked] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Calculate qualification score (0-100)
  const getQualificationScore = () => {
    const criteriaCount = config.qualificationCriteria.split('\n').filter(Boolean).length || 1
    const matchedCount = context.qualification.criteriaMatched.length

    // Base score from criteria (up to 70%)
    const criteriaScore = (matchedCount / criteriaCount) * 70

    // Bonus for call booked (30%)
    const bookingBonus = callBooked ? 30 : 0

    return Math.min(100, criteriaScore + bookingBonus)
  }

  // Check if a call was booked based on conversation
  useEffect(() => {
    if (context.state.currentGoal === 'confirm_booking' ||
        context.state.currentGoal === 'closing' && context.qualification.status === 'qualified') {
      // Check last messages for booking confirmation
      const recentMessages = messages.slice(-4)
      const bookingIndicators = ['booked', 'scheduled', 'confirmed', 'calendar', 'appointment', 'see you', 'talk soon']
      const hasBookingConfirmation = recentMessages.some(m =>
        m.role === 'assistant' && bookingIndicators.some(indicator =>
          m.content.toLowerCase().includes(indicator)
        )
      )
      if (hasBookingConfirmation && !callBooked) {
        setCallBooked(true)
      }
    }
  }, [context, messages, callBooked])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      const response = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          customKnowledge: {
            companyName: config.companyName,
            brandSummary: config.brandSummary,
            goal: config.goal,
            tone: config.tone,
            services: config.services.split(',').map(s => s.trim()).filter(Boolean),
            qualificationCriteria: config.qualificationCriteria.split('\n').filter(Boolean),
            dos: ['Be helpful and answer questions', 'Keep responses short for SMS'],
            donts: ['Be pushy', 'Ignore opt-out requests']
          },
          mockContact: {
            firstName: 'Test',
            lastName: 'User',
            phone: '+1234567890'
          },
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      // Add AI response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.turn.aiResponse,
        intent: data.intent.intent,
        tokensUsed: data.usage.total,
        responseTimeMs: data.turn.responseTimeMs
      }])

      setContext(data.context)
      setTotalTokens(prev => prev + data.usage.total)
      setTotalCost(prev => prev + data.usage.estimatedCost)
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setMessages([])
    setContext(createInitialContext())
    setTotalTokens(0)
    setTotalCost(0)
    setCallBooked(false)
  }

  const getIntentColor = (intent: Intent): string => {
    const colors: Record<Intent, string> = {
      booking_interest: 'bg-green-500/20 text-green-400',
      positive_response: 'bg-green-500/20 text-green-400',
      question: 'bg-blue-500/20 text-blue-400',
      objection: 'bg-yellow-500/20 text-yellow-400',
      negative_response: 'bg-orange-500/20 text-orange-400',
      opt_out: 'bg-red-500/20 text-red-400',
      request_human: 'bg-purple-500/20 text-purple-400',
      confirmation: 'bg-cyan-500/20 text-cyan-400',
      greeting: 'bg-gray-500/20 text-gray-400',
      thanks: 'bg-gray-500/20 text-gray-400',
      unclear: 'bg-gray-500/20 text-gray-400'
    }
    return colors[intent] || 'bg-gray-500/20 text-gray-400'
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            AI Playground
          </h1>
          <p className="text-muted-foreground mt-1">
            Test and iterate on AI conversations
          </p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1">
          <CardHeader
            className="cursor-pointer"
            onClick={() => setShowConfig(!showConfig)}
          >
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Configuration
              </span>
              {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CardTitle>
          </CardHeader>
          {showConfig && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  value={config.companyName}
                  onChange={(e) => setConfig(prev => ({ ...prev, companyName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Brand Summary</Label>
                <Textarea
                  value={config.brandSummary}
                  onChange={(e) => setConfig(prev => ({ ...prev, brandSummary: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Goal</Label>
                <Input
                  value={config.goal}
                  onChange={(e) => setConfig(prev => ({ ...prev, goal: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Tone</Label>
                <Input
                  value={config.tone}
                  onChange={(e) => setConfig(prev => ({ ...prev, tone: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Services (comma-separated)</Label>
                <Input
                  value={config.services}
                  onChange={(e) => setConfig(prev => ({ ...prev, services: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Qualification Criteria (one per line)</Label>
                <Textarea
                  value={config.qualificationCriteria}
                  onChange={(e) => setConfig(prev => ({ ...prev, qualificationCriteria: e.target.value }))}
                  rows={3}
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Chat Interface */}
        <Card className="lg:col-span-2 flex flex-col h-[600px]">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-400" />
                Conversation
              </span>
              <div className="flex items-center gap-4 text-sm font-normal">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Zap className="w-3 h-3" />
                  {totalTokens.toLocaleString()} tokens
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="w-3 h-3" />
                  ${totalCost.toFixed(4)}
                </span>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation to test the AI</p>
                  <p className="text-sm mt-1">Try: &quot;Hi, I&apos;m interested in your services&quot;</p>
                </div>
              )}

              {messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${message.role === 'assistant' ? '' : 'flex-row-reverse'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      message.role === 'assistant'
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <Bot className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div
                    className={`flex-1 space-y-1 ${
                      message.role === 'user' ? 'text-right' : ''
                    }`}
                  >
                    <div
                      className={`inline-block rounded-xl px-4 py-2 max-w-[80%] ${
                        message.role === 'assistant'
                          ? 'bg-card border border-border/50 text-left'
                          : 'bg-cyan-500/20 text-cyan-100'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                    {message.role === 'assistant' && message.intent && (
                      <div className="flex items-center gap-2 text-xs">
                        <Badge className={getIntentColor(message.intent)}>
                          {message.intent.replace(/_/g, ' ')}
                        </Badge>
                        {message.tokensUsed && (
                          <span className="text-muted-foreground">
                            {message.tokensUsed} tokens
                          </span>
                        )}
                        {message.responseTimeMs && (
                          <span className="text-muted-foreground">
                            {message.responseTimeMs}ms
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-card border border-border/50 rounded-xl px-4 py-2">
                    <p className="text-sm text-muted-foreground">Thinking...</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2 flex-shrink-0">
              <Input
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                disabled={loading}
              />
              <Button onClick={handleSend} disabled={loading || !input.trim()}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Qualification Progress Bar */}
      {messages.length > 0 && (
        <Card className={callBooked ? 'border-green-500/50 bg-green-500/5' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                Lead Qualification
              </span>
              {callBooked && (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">Call Booked!</span>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Qualification Score</span>
                <span className={`font-bold ${
                  getQualificationScore() >= 70 ? 'text-green-400' :
                  getQualificationScore() >= 40 ? 'text-yellow-400' :
                  'text-muted-foreground'
                }`}>
                  {Math.round(getQualificationScore())}%
                </span>
              </div>
              <div className="h-4 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ease-out rounded-full ${
                    callBooked ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                    getQualificationScore() >= 70 ? 'bg-gradient-to-r from-cyan-500 to-green-400' :
                    getQualificationScore() >= 40 ? 'bg-gradient-to-r from-yellow-500 to-cyan-400' :
                    'bg-gradient-to-r from-gray-500 to-cyan-500'
                  }`}
                  style={{ width: `${getQualificationScore()}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Unknown</span>
                <span>Partial</span>
                <span>Qualified</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Booked
                </span>
              </div>
            </div>

            {/* Criteria Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <h4 className="font-medium mb-2 text-sm">Qualification Criteria</h4>
                <div className="space-y-1">
                  {config.qualificationCriteria.split('\n').filter(Boolean).map((criterion, i) => {
                    const isMatched = context.qualification.criteriaMatched.some(
                      c => c.toLowerCase().includes(criterion.toLowerCase().slice(0, 20)) ||
                           criterion.toLowerCase().includes(c.toLowerCase().slice(0, 20))
                    )
                    const isMissed = context.qualification.criteriaMissed.some(
                      c => c.toLowerCase().includes(criterion.toLowerCase().slice(0, 20)) ||
                           criterion.toLowerCase().includes(c.toLowerCase().slice(0, 20))
                    )
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          isMatched ? 'bg-green-500/20 text-green-400' :
                          isMissed ? 'bg-red-500/20 text-red-400' :
                          'bg-muted/30 text-muted-foreground'
                        }`}>
                          {isMatched ? '✓' : isMissed ? '✗' : '?'}
                        </div>
                        <span className={
                          isMatched ? 'text-green-400' :
                          isMissed ? 'text-red-400 line-through' :
                          'text-muted-foreground'
                        }>
                          {criterion}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Conversation State */}
              <div>
                <h4 className="font-medium mb-2 text-sm">Conversation State</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      className={
                        callBooked ? 'bg-green-500/20 text-green-400' :
                        context.qualification.status === 'qualified'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : context.qualification.status === 'partial'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : context.qualification.status === 'disqualified'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }
                    >
                      {callBooked ? 'Converted' : context.qualification.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current Goal</span>
                    <span className="capitalize">{context.state.currentGoal.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Turn</span>
                    <span>{context.state.turnCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Intent</span>
                    <span className="capitalize">{context.state.lastIntent.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Call Booked Banner */}
            {callBooked && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-400">Call Successfully Booked!</h4>
                  <p className="text-sm text-muted-foreground">
                    Lead has been qualified and converted. Ready for handoff.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
