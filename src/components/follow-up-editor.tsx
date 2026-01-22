'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, Sparkles, Loader2, GripVertical } from 'lucide-react'
import { FollowUpTemplate } from '@/types/database'

interface FollowUpEditorProps {
  templates: FollowUpTemplate[]
  onChange: (templates: FollowUpTemplate[]) => void
  workflowId?: string
  instructions?: string
  channel?: 'sms' | 'whatsapp' | 'email'
  disabled?: boolean
}

const DEFAULT_DELAY_HOURS = 24

export function FollowUpEditor({
  templates,
  onChange,
  workflowId,
  instructions,
  channel = 'sms',
  disabled = false,
}: FollowUpEditorProps) {
  const [generating, setGenerating] = useState(false)
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null)

  const addTemplate = () => {
    const newTemplate: FollowUpTemplate = {
      message: '',
      delay_hours: DEFAULT_DELAY_HOURS,
    }
    onChange([...templates, newTemplate])
  }

  const removeTemplate = (index: number) => {
    const updated = templates.filter((_, i) => i !== index)
    onChange(updated)
  }

  const updateTemplate = (index: number, field: keyof FollowUpTemplate, value: string | number) => {
    const updated = templates.map((t, i) =>
      i === index ? { ...t, [field]: value } : t
    )
    onChange(updated)
  }

  const generateAllTemplates = async () => {
    if (!instructions) {
      return
    }

    setGenerating(true)
    try {
      const count = templates.length > 0 ? templates.length : 3
      const response = await fetch('/api/workflows/generate-followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          instructions,
          channel,
          count,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate follow-ups')
      }

      const data = await response.json()
      if (data.templates && Array.isArray(data.templates)) {
        onChange(data.templates)
      }
    } catch (error) {
      console.error('Failed to generate follow-ups:', error)
    } finally {
      setGenerating(false)
    }
  }

  const regenerateTemplate = async (index: number) => {
    if (!instructions) return

    setGeneratingIndex(index)
    try {
      const response = await fetch('/api/workflows/generate-followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          instructions,
          channel,
          count: 1,
          followUpNumber: index + 1,
          totalFollowUps: templates.length,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to regenerate follow-up')
      }

      const data = await response.json()
      if (data.templates && data.templates[0]) {
        const updated = templates.map((t, i) =>
          i === index
            ? { ...t, message: data.templates[0].message }
            : t
        )
        onChange(updated)
      }
    } catch (error) {
      console.error('Failed to regenerate follow-up:', error)
    } finally {
      setGeneratingIndex(null)
    }
  }

  const formatDelayLabel = (hours: number): string => {
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`
    }
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (remainingHours === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`
    }
    return `${days} day${days !== 1 ? 's' : ''} ${remainingHours}h`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Follow-up Messages</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Automated messages sent when contacts don&apos;t respond. Variables: {'{first_name}'}, {'{brand_name}'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateAllTemplates}
            disabled={disabled || generating || !instructions}
            title={!instructions ? 'Add offer description first' : 'Generate follow-ups with AI'}
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {templates.length > 0 ? 'Regenerate All' : 'Auto-Generate'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTemplate}
            disabled={disabled}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Follow-up
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="mb-2">No follow-up messages configured</p>
            <p className="text-xs">Click &quot;Auto-Generate&quot; to create AI-suggested follow-ups, or add them manually.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((template, index) => (
            <Card key={index} className="relative">
              <CardContent className="pt-4 pb-4">
                <div className="flex gap-3">
                  <div className="flex items-start pt-2 text-muted-foreground cursor-grab">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        Follow-up #{index + 1}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => regenerateTemplate(index)}
                          disabled={disabled || generatingIndex === index || !instructions}
                          className="h-7 px-2"
                          title="Regenerate this message"
                        >
                          {generatingIndex === index ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTemplate(index)}
                          disabled={disabled}
                          className="h-7 px-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    <Textarea
                      placeholder={`Follow-up message #${index + 1}...`}
                      value={template.message}
                      onChange={(e) => updateTemplate(index, 'message', e.target.value)}
                      disabled={disabled}
                      rows={3}
                      className="font-mono text-sm resize-none"
                    />

                    <div className="flex items-center gap-3">
                      <Label htmlFor={`delay-${index}`} className="text-xs text-muted-foreground whitespace-nowrap">
                        Send after:
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`delay-${index}`}
                          type="number"
                          min={1}
                          max={720}
                          value={template.delay_hours}
                          onChange={(e) =>
                            updateTemplate(index, 'delay_hours', parseInt(e.target.value) || DEFAULT_DELAY_HOURS)
                          }
                          disabled={disabled}
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">
                          hours ({formatDelayLabel(template.delay_hours)})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {templates.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Total campaign length: {formatDelayLabel(templates.reduce((sum, t) => sum + t.delay_hours, 0))} after initial message
        </p>
      )}
    </div>
  )
}
