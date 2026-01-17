'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'
import { Contact, Workflow } from '@/types/database'

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_conversation', label: 'In Conversation' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'booked', label: 'Booked' },
  { value: 'opted_out', label: 'Opted Out' },
  { value: 'unresponsive', label: 'Unresponsive' },
  { value: 'handed_off', label: 'Handed Off' },
]

type WorkflowOption = Pick<Workflow, 'id' | 'name' | 'client_id'> & {
  clients?: { name: string }
}

export default function EditContactPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([])
  const [originalWorkflowId, setOriginalWorkflowId] = useState<string>('')

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    status: 'pending' as Contact['status'],
    workflow_id: '',
  })

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch contact and workflows in parallel
        const [contactResponse, workflowsResponse] = await Promise.all([
          fetch(`/api/contacts/${params.id}`),
          fetch('/api/workflows')
        ])

        if (!contactResponse.ok) throw new Error('Failed to fetch contact')

        const contact = await contactResponse.json()
        const workflowsData = await workflowsResponse.json()

        setFormData({
          first_name: contact.first_name || '',
          last_name: contact.last_name || '',
          phone: contact.phone || '',
          email: contact.email || '',
          status: contact.status,
          workflow_id: contact.workflow_id,
        })
        setOriginalWorkflowId(contact.workflow_id)
        setWorkflows(workflowsData || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load contact')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!formData.phone && !formData.email) {
      setError('Either phone or email is required')
      setSaving(false)
      return
    }

    try {
      const updatePayload: Record<string, unknown> = {
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        phone: formData.phone || null,
        email: formData.email || null,
        status: formData.status,
      }

      // Only include workflow_id if it changed
      if (formData.workflow_id !== originalWorkflowId) {
        updatePayload.workflow_id = formData.workflow_id
        // This will automatically reset status and clear history
      }

      const response = await fetch(`/api/contacts/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update contact')
      }

      router.push(`/contacts/${params.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const workflowChanged = formData.workflow_id !== originalWorkflowId

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href={`/contacts/${params.id}`}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Contact
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Edit Contact</CardTitle>
          <CardDescription>Update contact information, status, or workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  placeholder="John"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  placeholder="Doe"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+44 7700 900000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                At least one contact method (phone or email) is required
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="workflow">Workflow</Label>
              <Select
                value={formData.workflow_id}
                onValueChange={(value) => setFormData({ ...formData, workflow_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select workflow" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name} {workflow.clients?.name ? `(${workflow.clients.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workflowChanged && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Changing workflow will reset this contact</p>
                    <p className="text-yellow-400/80">Status will be set to Pending and all messages/appointments will be deleted.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as Contact['status'] })}
                disabled={workflowChanged}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workflowChanged && (
                <p className="text-xs text-muted-foreground">
                  Status will be reset to Pending when changing workflow
                </p>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/contacts/${params.id}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
