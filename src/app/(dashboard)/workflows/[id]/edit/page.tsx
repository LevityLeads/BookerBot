'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ArrowLeft } from 'lucide-react'
import { Workflow } from '@/types/database'

interface EditWorkflowPageProps {
  params: { id: string }
}

export default function EditWorkflowPage({ params }: EditWorkflowPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    channel: 'sms' as 'sms' | 'whatsapp' | 'email',
    status: 'paused' as 'active' | 'paused' | 'archived',
    instructions: '',
    qualification_criteria: '',
    initial_message_template: '',
  })

  useEffect(() => {
    async function fetchWorkflow() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error || !data) {
        router.push('/workflows')
        return
      }

      const workflowData = data as Workflow
      setFormData({
        name: workflowData.name,
        description: workflowData.description || '',
        channel: workflowData.channel,
        status: workflowData.status,
        instructions: workflowData.instructions || '',
        qualification_criteria: workflowData.qualification_criteria || '',
        initial_message_template: workflowData.initial_message_template || '',
      })
      setLoading(false)
    }

    fetchWorkflow()
  }, [params.id, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/workflows/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update workflow')
      }

      router.push(`/workflows/${params.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/workflows/${params.id}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Workflow
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Workflow</CardTitle>
          <CardDescription>Update workflow settings and prompt template</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6">
              {/* Basic Settings */}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Workflow Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="channel">Channel</Label>
                    <Select
                      value={formData.channel}
                      onValueChange={(value: 'sms' | 'whatsapp' | 'email') =>
                        setFormData({ ...formData, channel: value })
                      }
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

                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: 'active' | 'paused' | 'archived') =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Offer Description - THE KEY FIELD */}
              <div className="grid gap-2 p-4 border border-cyan-500/30 rounded-lg bg-cyan-500/5">
                <Label htmlFor="instructions" className="text-cyan-400 font-semibold">
                  Offer Description (What You&apos;re Selling)
                </Label>
                <Textarea
                  id="instructions"
                  placeholder="Describe what you're offering in this campaign. Be specific about:
- What the product/service is
- Key benefits and value proposition
- What makes it unique
- What a successful outcome looks like

Example: We help B2B companies get their research and insights published on The Economist. Our sponsored content reaches 500k+ senior decision-makers globally. Packages start at £100k and include custom research, editorial support, and multi-channel distribution."
                  value={formData.instructions}
                  onChange={(e) =>
                    setFormData({ ...formData, instructions: e.target.value })
                  }
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This is what the AI uses to explain your offering. Be specific - the AI will use this exact information.
                </p>
              </div>

              {/* Qualification Criteria - Separate Section */}
              <div className="grid gap-2">
                <Label htmlFor="qualification_criteria">Qualification Criteria</Label>
                <Textarea
                  id="qualification_criteria"
                  placeholder="List the criteria to qualify a lead (one per line):
- Budget of £X or more
- Decision maker or influencer
- Company size of X+ employees
- Timeline within X weeks"
                  value={formData.qualification_criteria}
                  onChange={(e) =>
                    setFormData({ ...formData, qualification_criteria: e.target.value })
                  }
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  The AI will naturally discover these through conversation before suggesting a call.
                </p>
              </div>

              {/* Initial Message */}
              <div className="grid gap-2">
                <Label htmlFor="initial_message_template">Initial Message Template</Label>
                <Textarea
                  id="initial_message_template"
                  placeholder="Hi {first_name}, this is {brand_name}..."
                  value={formData.initial_message_template}
                  onChange={(e) =>
                    setFormData({ ...formData, initial_message_template: e.target.value })
                  }
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Variables: {'{first_name}'}, {'{last_name}'}, {'{brand_name}'}, {'{company_name}'}
                </p>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
