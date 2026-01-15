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
import { BrandResearchResult } from '@/types/ai'
import {
  Globe,
  Target,
  MessageSquare,
  Loader2,
  CheckCircle,
  Pencil,
  X,
  Plus,
  Sparkles,
  Building2,
  Users,
  FileText,
  AlertCircle
} from 'lucide-react'

interface CreateWorkflowWizardProps {
  children: React.ReactNode
  clients: Pick<Client, 'id' | 'name' | 'brand_name'>[]
}

type WizardStep = 'basics' | 'researching' | 'review' | 'creating'

export function CreateWorkflowWizard({ children, clients }: CreateWorkflowWizardProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<WizardStep>('basics')
  const [error, setError] = useState<string | null>(null)

  // Step 1: Basic inputs
  const [basics, setBasics] = useState({
    clientId: '',
    url: '',
    goal: '',
    channel: 'sms' as 'sms' | 'whatsapp' | 'email'
  })

  // Step 2: Research results
  const [research, setResearch] = useState<BrandResearchResult | null>(null)

  // Step 3: Editable fields from research
  const [editedFields, setEditedFields] = useState({
    brandSummary: '',
    services: [] as string[],
    targetAudience: '',
    tone: '',
    qualificationCriteria: [] as string[],
    dos: [] as string[],
    donts: [] as string[]
  })

  // Track which sections are being edited
  const [editing, setEditing] = useState<string | null>(null)
  const [tempEditValue, setTempEditValue] = useState('')

  const handleStartResearch = async () => {
    if (!basics.url || !basics.goal || !basics.channel) {
      setError('Please fill in all fields')
      return
    }

    // Auto-add https:// if no protocol specified
    let url = basics.url.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    setError(null)
    setStep('researching')

    try {
      const response = await fetch('/api/ai/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          goal: basics.goal,
          channel: basics.channel
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Research failed')
      }

      const data = await response.json()
      const result = data.research as BrandResearchResult

      setResearch(result)
      setEditedFields({
        brandSummary: result.brandSummary,
        services: result.services,
        targetAudience: result.targetAudience,
        tone: result.suggestedTone,
        qualificationCriteria: result.suggestedQualificationCriteria,
        dos: result.suggestedDosAndDonts.dos,
        donts: result.suggestedDosAndDonts.donts
      })
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed')
      setStep('basics')
    }
  }

  const handleCreateWorkflow = async () => {
    if (!basics.clientId) {
      setError('Please select a client')
      return
    }

    setStep('creating')
    setError(null)

    try {
      // Build workflow data with knowledge
      const workflowData = {
        client_id: basics.clientId,
        name: basics.goal,
        channel: basics.channel,
        instructions: buildInstructions(),
        qualification_criteria: editedFields.qualificationCriteria.join('\n'),
        initial_message_template: `Hi {first_name}! This is ${research?.companyName || 'us'}. ${basics.goal} - would you be interested in learning more?`,
        opt_out_message: "You've been unsubscribed. Thanks for your time!"
      }

      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create workflow')
      }

      setOpen(false)
      resetWizard()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow')
      setStep('review')
    }
  }

  const buildInstructions = () => {
    return `## Brand Summary
${editedFields.brandSummary}

## Services
${editedFields.services.map(s => `- ${s}`).join('\n')}

## Target Audience
${editedFields.targetAudience}

## Communication Tone
${editedFields.tone}

## DOs
${editedFields.dos.map(d => `- ${d}`).join('\n')}

## DON'Ts
${editedFields.donts.map(d => `- ${d}`).join('\n')}
`
  }

  const resetWizard = () => {
    setStep('basics')
    setBasics({ clientId: '', url: '', goal: '', channel: 'sms' })
    setResearch(null)
    setEditedFields({
      brandSummary: '',
      services: [],
      targetAudience: '',
      tone: '',
      qualificationCriteria: [],
      dos: [],
      donts: []
    })
    setError(null)
    setEditing(null)
  }

  const addToList = (field: 'services' | 'qualificationCriteria' | 'dos' | 'donts', value: string) => {
    if (!value.trim()) return
    setEditedFields(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()]
    }))
    setTempEditValue('')
    setEditing(null)
  }

  const removeFromList = (field: 'services' | 'qualificationCriteria' | 'dos' | 'donts', index: number) => {
    setEditedFields(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) resetWizard()
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            {step === 'basics' && 'Create AI-Powered Workflow'}
            {step === 'researching' && 'Researching Brand...'}
            {step === 'review' && 'Review Brand Understanding'}
            {step === 'creating' && 'Creating Workflow...'}
          </DialogTitle>
          <DialogDescription>
            {step === 'basics' && 'Enter the business URL and goal - Claude will research and configure everything automatically'}
            {step === 'researching' && 'Analyzing website and gathering context...'}
            {step === 'review' && 'Review and edit the AI-generated configuration'}
            {step === 'creating' && 'Setting up your workflow...'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Basics */}
        {step === 'basics' && (
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="client">Client</Label>
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
                      {client.name} ({client.brand_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Business Website URL
              </Label>
              <Input
                id="url"
                type="text"
                placeholder="example.com or https://example.com"
                value={basics.url}
                onChange={(e) => setBasics({ ...basics, url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Claude will analyze this website to understand the brand
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="goal" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Goal
              </Label>
              <Input
                id="goal"
                placeholder="e.g., Book discovery calls with qualified leads"
                value={basics.goal}
                onChange={(e) => setBasics({ ...basics, goal: e.target.value })}
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
              <Button
                onClick={handleStartResearch}
                disabled={!basics.url || !basics.goal || !basics.clientId}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Research Brand
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Researching */}
        {step === 'researching' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto" />
            <div className="space-y-2">
              <p className="text-foreground">Analyzing {basics.url}...</p>
              <p className="text-sm text-muted-foreground">
                This may take 30-60 seconds
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex items-center justify-center gap-2">
                <CheckCircle className="w-3 h-3 text-cyan-400" /> Fetching website content
              </span>
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Analyzing brand and services
              </span>
              <span className="flex items-center justify-center gap-2 opacity-50">
                <span className="w-3 h-3" /> Generating recommendations
              </span>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && research && (
          <div className="space-y-4 py-4">
            {/* Brand Summary */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-medium">Brand Summary</h4>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing('brandSummary')
                      setTempEditValue(editedFields.brandSummary)
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
                {editing === 'brandSummary' ? (
                  <div className="space-y-2">
                    <Textarea
                      value={tempEditValue}
                      onChange={(e) => setTempEditValue(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditedFields(prev => ({ ...prev, brandSummary: tempEditValue }))
                          setEditing(null)
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{editedFields.brandSummary}</p>
                )}
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-medium">Services</h4>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing('services')}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editedFields.services.map((service, i) => (
                    <Badge key={i} variant="secondary" className="flex items-center gap-1">
                      {service}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-400"
                        onClick={() => removeFromList('services', i)}
                      />
                    </Badge>
                  ))}
                </div>
                {editing === 'services' && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Add service..."
                      value={tempEditValue}
                      onChange={(e) => setTempEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addToList('services', tempEditValue)
                        }
                      }}
                    />
                    <Button size="sm" onClick={() => addToList('services', tempEditValue)}>
                      Add
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Target Audience */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-medium">Target Audience</h4>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing('targetAudience')
                      setTempEditValue(editedFields.targetAudience)
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
                {editing === 'targetAudience' ? (
                  <div className="space-y-2">
                    <Textarea
                      value={tempEditValue}
                      onChange={(e) => setTempEditValue(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditedFields(prev => ({ ...prev, targetAudience: tempEditValue }))
                          setEditing(null)
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{editedFields.targetAudience}</p>
                )}
              </CardContent>
            </Card>

            {/* Qualification Criteria */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-medium">Qualification Criteria</h4>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing('qualificationCriteria')}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <ul className="space-y-1">
                  {editedFields.qualificationCriteria.map((criteria, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      {criteria}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-400 ml-auto"
                        onClick={() => removeFromList('qualificationCriteria', i)}
                      />
                    </li>
                  ))}
                </ul>
                {editing === 'qualificationCriteria' && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Add criterion..."
                      value={tempEditValue}
                      onChange={(e) => setTempEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addToList('qualificationCriteria', tempEditValue)
                        }
                      }}
                    />
                    <Button size="sm" onClick={() => addToList('qualificationCriteria', tempEditValue)}>
                      Add
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tone */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">Communication Tone</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing('tone')
                      setTempEditValue(editedFields.tone)
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
                {editing === 'tone' ? (
                  <div className="space-y-2">
                    <Input
                      value={tempEditValue}
                      onChange={(e) => setTempEditValue(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditedFields(prev => ({ ...prev, tone: tempEditValue }))
                          setEditing(null)
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{editedFields.tone}</p>
                )}
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
              <Button onClick={handleCreateWorkflow}>
                <Sparkles className="w-4 h-4 mr-2" />
                Create Workflow
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Creating */}
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
