'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Client } from '@/types/database'
import {
  Target,
  MessageSquare,
  Loader2,
  CheckCircle,
  X,
  Plus,
  Sparkles,
  AlertCircle,
  Building2
} from 'lucide-react'
import Link from 'next/link'

// Extended client type with brand fields
interface ClientWithBrand extends Pick<Client, 'id' | 'name' | 'brand_name'> {
  brand_summary?: string | null
  brand_services?: string[] | null
  brand_researched_at?: string | null
}

interface CreateWorkflowWizardProps {
  children: React.ReactNode
  clients: ClientWithBrand[]
  preselectedClientId?: string
}

type WizardStep = 'basics' | 'qualification' | 'creating'

export function CreateWorkflowWizard({ children, clients, preselectedClientId }: CreateWorkflowWizardProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<WizardStep>('basics')
  const [error, setError] = useState<string | null>(null)

  // Step 1: Basic inputs
  const [basics, setBasics] = useState({
    clientId: preselectedClientId || '',
    name: '',
    goal: '',
    channel: 'sms' as 'sms' | 'whatsapp' | 'email'
  })

  // Step 2: Qualification criteria
  const [qualificationCriteria, setQualificationCriteria] = useState<string[]>([
    'Has expressed interest in our services',
    'Has provided contact information',
    'Is available for a consultation'
  ])

  const selectedClient = clients.find(c => c.id === basics.clientId)
  const hasBrandResearch = selectedClient?.brand_researched_at

  const handleNext = () => {
    if (!basics.clientId || !basics.goal || !basics.name) {
      setError('Please fill in all required fields')
      return
    }

    if (!hasBrandResearch) {
      setError('Please set up brand research for this client first')
      return
    }

    setError(null)
    setStep('qualification')
  }

  const handleCreate = async () => {
    setStep('creating')
    setError(null)

    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: basics.clientId,
          name: basics.name,
          description: basics.goal,
          channel: basics.channel,
          status: 'active',
          qualification_criteria: qualificationCriteria,
          // Workflow-specific instructions can be added here
          instructions: `Goal: ${basics.goal}\n\nQualification Criteria:\n${qualificationCriteria.map(c => `- ${c}`).join('\n')}`
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create workflow')
      }

      const data = await response.json()

      setOpen(false)
      router.push(`/workflows/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('qualification')
    }
  }

  const resetWizard = () => {
    setStep('basics')
    setBasics({ clientId: preselectedClientId || '', name: '', goal: '', channel: 'sms' })
    setQualificationCriteria([
      'Has expressed interest in our services',
      'Has provided contact information',
      'Is available for a consultation'
    ])
    setError(null)
  }

  const addCriterion = () => {
    const value = prompt('Add qualification criterion:')
    if (value?.trim()) {
      setQualificationCriteria([...qualificationCriteria, value.trim()])
    }
  }

  const removeCriterion = (index: number) => {
    setQualificationCriteria(qualificationCriteria.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) resetWizard()
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Create Workflow
          </DialogTitle>
          <DialogDescription>
            {step === 'basics' && 'Configure your new AI-powered workflow'}
            {step === 'qualification' && 'Set up lead qualification criteria'}
            {step === 'creating' && 'Creating your workflow...'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Basics */}
        {step === 'basics' && (
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="client" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Client
              </Label>
              <Select
                value={basics.clientId}
                onValueChange={(value) => setBasics({ ...basics, clientId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        {client.name}
                        {client.brand_researched_at ? (
                          <Badge variant="secondary" className="text-xs">AI Ready</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-yellow-500">Needs Setup</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {basics.clientId && !hasBrandResearch && (
                <div className="flex items-center gap-2 text-sm text-yellow-500 bg-yellow-500/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    This client needs brand research.{' '}
                    <Link
                      href={`/clients/${basics.clientId}/edit`}
                      className="underline hover:text-yellow-400"
                      onClick={() => setOpen(false)}
                    >
                      Set it up now
                    </Link>
                  </span>
                </div>
              )}
              {basics.clientId && hasBrandResearch && selectedClient?.brand_summary && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <p className="font-medium text-foreground mb-1">Brand Summary:</p>
                  <p className="line-clamp-2">{selectedClient.brand_summary}</p>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Workflow Name</Label>
              <Input
                id="name"
                placeholder="e.g., Meta Ads Lead Qualification"
                value={basics.name}
                onChange={(e) => setBasics({ ...basics, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="goal" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Goal
              </Label>
              <Textarea
                id="goal"
                placeholder="e.g., Qualify inbound leads from Meta ads and book discovery calls with interested prospects"
                value={basics.goal}
                onChange={(e) => setBasics({ ...basics, goal: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="channel" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Channel
              </Label>
              <Select
                value={basics.channel}
                onValueChange={(value: 'sms' | 'whatsapp' | 'email') => setBasics({ ...basics, channel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleNext} disabled={!basics.clientId || !basics.name || !basics.goal}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Qualification Criteria */}
        {step === 'qualification' && (
          <div className="space-y-4 py-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base">Qualification Criteria</Label>
                    <p className="text-sm text-muted-foreground">
                      What makes a lead qualified for this workflow?
                    </p>
                  </div>

                  <div className="space-y-2">
                    {qualificationCriteria.map((criterion, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span className="flex-1 text-sm">{criterion}</span>
                        <button
                          onClick={() => removeCriterion(i)}
                          className="text-muted-foreground hover:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <Button variant="outline" size="sm" onClick={addCriterion}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Criterion
                  </Button>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('basics')}>
                Back
              </Button>
              <Button onClick={handleCreate}>
                <Sparkles className="w-4 h-4 mr-2" />
                Create Workflow
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Creating */}
        {step === 'creating' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto" />
            <p className="text-foreground">Creating your workflow...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
