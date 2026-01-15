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
    channel: 'sms' as 'sms' | 'whatsapp' | 'email',
    status: 'paused' as 'active' | 'paused' | 'archived',
    instructions: '',
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
        channel: workflowData.channel,
        status: workflowData.status,
        instructions: workflowData.instructions || '',
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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/workflows/${params.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Workflow
        </Link>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Edit Workflow</CardTitle>
          <CardDescription>Update workflow settings and prompt template</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-foreground">Workflow Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="bg-secondary border-border text-foreground"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="channel" className="text-foreground">Channel</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(value: 'sms' | 'whatsapp' | 'email') =>
                    setFormData({ ...formData, channel: value })
                  }
                >
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status" className="text-foreground">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'active' | 'paused' | 'archived') =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="instructions" className="text-foreground">AI Instructions</Label>
                <Textarea
                  id="instructions"
                  placeholder="Enter AI instructions for this workflow..."
                  value={formData.instructions}
                  onChange={(e) =>
                    setFormData({ ...formData, instructions: e.target.value })
                  }
                  rows={6}
                  className="font-mono text-sm bg-secondary border-border text-foreground"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="initial_message_template" className="text-foreground">Initial Message Template</Label>
                <Textarea
                  id="initial_message_template"
                  placeholder="Enter the initial message template..."
                  value={formData.initial_message_template}
                  onChange={(e) =>
                    setFormData({ ...formData, initial_message_template: e.target.value })
                  }
                  rows={4}
                  className="font-mono text-sm bg-secondary border-border text-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  Use variables like {'{first_name}'}, {'{brand_name}'}, etc.
                </p>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded">{error}</div>
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
