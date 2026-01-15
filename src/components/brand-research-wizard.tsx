'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Client } from '@/types/database'
import { BrandResearchResult } from '@/types/ai'
import {
  Loader2,
  CheckCircle,
  Pencil,
  X,
  Plus,
  Sparkles,
  Building2,
  Users,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

interface BrandResearchWizardProps {
  client: Client
  onSave: (brandData: BrandData) => Promise<void>
}

export interface BrandData {
  brand_url: string | null
  brand_summary: string | null
  brand_services: string[]
  brand_target_audience: string | null
  brand_tone: string | null
  brand_usps: string[]
  brand_faqs: Array<{ question: string; answer: string }>
  brand_dos: string[]
  brand_donts: string[]
}

type WizardState = 'idle' | 'researching' | 'editing'

export function BrandResearchWizard({ client, onSave }: BrandResearchWizardProps) {
  const [state, setState] = useState<WizardState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [url, setUrl] = useState(client.brand_url || '')

  // Brand data state
  const [brandData, setBrandData] = useState<BrandData>({
    brand_url: client.brand_url,
    brand_summary: client.brand_summary,
    brand_services: (client.brand_services as string[]) || [],
    brand_target_audience: client.brand_target_audience,
    brand_tone: client.brand_tone,
    brand_usps: (client.brand_usps as string[]) || [],
    brand_faqs: (client.brand_faqs as Array<{ question: string; answer: string }>) || [],
    brand_dos: (client.brand_dos as string[]) || [],
    brand_donts: (client.brand_donts as string[]) || []
  })

  // Track which sections are being edited
  const [editing, setEditing] = useState<string | null>(null)
  const [tempEditValue, setTempEditValue] = useState('')

  const hasExistingResearch = !!client.brand_researched_at

  const handleResearch = async () => {
    if (!url) {
      setError('Please enter a website URL')
      return
    }

    // Auto-add https:// if no protocol
    let researchUrl = url.trim()
    if (!researchUrl.startsWith('http://') && !researchUrl.startsWith('https://')) {
      researchUrl = 'https://' + researchUrl
    }

    setError(null)
    setState('researching')

    try {
      const response = await fetch('/api/ai/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: researchUrl,
          goal: 'General brand research',
          channel: 'sms'
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Research failed')
      }

      const data: BrandResearchResult = await response.json()

      setBrandData({
        brand_url: researchUrl,
        brand_summary: data.brandSummary,
        brand_services: data.services,
        brand_target_audience: data.targetAudience,
        brand_tone: data.suggestedTone,
        brand_usps: data.uniqueSellingPoints,
        brand_faqs: data.faqs,
        brand_dos: data.suggestedDosAndDonts.dos,
        brand_donts: data.suggestedDosAndDonts.donts
      })

      setState('editing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed')
      setState('idle')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      await onSave(brandData)
      setState('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (field: string, currentValue: string) => {
    setEditing(field)
    setTempEditValue(currentValue)
  }

  const saveEditing = (field: keyof BrandData) => {
    setBrandData({ ...brandData, [field]: tempEditValue })
    setEditing(null)
    setTempEditValue('')
  }

  const cancelEditing = () => {
    setEditing(null)
    setTempEditValue('')
  }

  const addToArray = (field: 'brand_services' | 'brand_usps' | 'brand_dos' | 'brand_donts', value: string) => {
    if (value.trim()) {
      setBrandData({
        ...brandData,
        [field]: [...(brandData[field] as string[]), value.trim()]
      })
    }
  }

  const removeFromArray = (field: 'brand_services' | 'brand_usps' | 'brand_dos' | 'brand_donts', index: number) => {
    setBrandData({
      ...brandData,
      [field]: (brandData[field] as string[]).filter((_, i) => i !== index)
    })
  }

  // Idle state - show research button or existing data summary
  if (state === 'idle') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            AI Brand Research
          </CardTitle>
          <CardDescription>
            {hasExistingResearch
              ? `Last researched: ${new Date(client.brand_researched_at!).toLocaleDateString()}`
              : 'Let Claude analyze your website to understand your brand'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="example.com or https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleResearch}>
              {hasExistingResearch ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Re-research
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Research Brand
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {hasExistingResearch && brandData.brand_summary && (
            <div className="space-y-3 pt-4 border-t border-border">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Brand Summary</p>
                <p className="text-sm">{brandData.brand_summary}</p>
              </div>
              {brandData.brand_services.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Services</p>
                  <div className="flex flex-wrap gap-1">
                    {brandData.brand_services.map((s, i) => (
                      <Badge key={i} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setState('editing')}>
                <Pencil className="w-3 h-3 mr-2" />
                Edit Brand Info
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Researching state
  if (state === 'researching') {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto" />
          <div className="space-y-2">
            <p className="text-foreground">Analyzing {url}...</p>
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
          </div>
        </CardContent>
      </Card>
    )
  }

  // Editing state - show full editable form
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-cyan-400" />
          Brand Configuration
        </CardTitle>
        <CardDescription>
          Review and edit the AI-generated brand information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Brand Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Brand Summary
            </Label>
            {editing !== 'brand_summary' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditing('brand_summary', brandData.brand_summary || '')}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
          {editing === 'brand_summary' ? (
            <div className="space-y-2">
              <Textarea
                value={tempEditValue}
                onChange={(e) => setTempEditValue(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEditing('brand_summary')}>Save</Button>
                <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              {brandData.brand_summary || 'No summary yet'}
            </p>
          )}
        </div>

        {/* Services */}
        <div className="space-y-2">
          <Label>Services / Products</Label>
          <div className="flex flex-wrap gap-2">
            {brandData.brand_services.map((service, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {service}
                <button onClick={() => removeFromArray('brand_services', i)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const value = prompt('Add a service:')
                if (value) addToArray('brand_services', value)
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Target Audience */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Target Audience
            </Label>
            {editing !== 'brand_target_audience' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditing('brand_target_audience', brandData.brand_target_audience || '')}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
          {editing === 'brand_target_audience' ? (
            <div className="space-y-2">
              <Textarea
                value={tempEditValue}
                onChange={(e) => setTempEditValue(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEditing('brand_target_audience')}>Save</Button>
                <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              {brandData.brand_target_audience || 'No target audience defined'}
            </p>
          )}
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Brand Tone / Voice</Label>
            {editing !== 'brand_tone' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditing('brand_tone', brandData.brand_tone || '')}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
          {editing === 'brand_tone' ? (
            <div className="space-y-2">
              <Input
                value={tempEditValue}
                onChange={(e) => setTempEditValue(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEditing('brand_tone')}>Save</Button>
                <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              {brandData.brand_tone || 'No tone defined'}
            </p>
          )}
        </div>

        {/* USPs */}
        <div className="space-y-2">
          <Label>Unique Selling Points</Label>
          <div className="flex flex-wrap gap-2">
            {brandData.brand_usps.map((usp, i) => (
              <Badge key={i} variant="outline" className="gap-1">
                {usp}
                <button onClick={() => removeFromArray('brand_usps', i)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const value = prompt('Add a USP:')
                if (value) addToArray('brand_usps', value)
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Dos */}
        <div className="space-y-2">
          <Label className="text-green-400">AI Should Do</Label>
          <div className="flex flex-wrap gap-2">
            {brandData.brand_dos.map((item, i) => (
              <Badge key={i} className="bg-green-500/20 text-green-400 gap-1">
                {item}
                <button onClick={() => removeFromArray('brand_dos', i)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const value = prompt('Add a "Do":')
                if (value) addToArray('brand_dos', value)
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Don'ts */}
        <div className="space-y-2">
          <Label className="text-red-400">AI Should NOT Do</Label>
          <div className="flex flex-wrap gap-2">
            {brandData.brand_donts.map((item, i) => (
              <Badge key={i} className="bg-red-500/20 text-red-400 gap-1">
                {item}
                <button onClick={() => removeFromArray('brand_donts', i)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const value = prompt('Add a "Don\'t":')
                if (value) addToArray('brand_donts', value)
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => setState('idle')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Save Brand Info
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
