'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Client, Workflow } from '@/types/database'

interface CreateContactDialogProps {
  children: React.ReactNode
  workflows: Pick<Workflow, 'id' | 'name' | 'client_id'>[]
  clients: Pick<Client, 'id' | 'name' | 'brand_name'>[]
}

export function CreateContactDialog({ children, workflows, clients }: CreateContactDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedClient, setSelectedClient] = useState<string>('')
  const [formData, setFormData] = useState({
    workflow_id: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
  })

  const filteredWorkflows = selectedClient
    ? workflows.filter((w) => w.client_id === selectedClient)
    : workflows

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.phone && !formData.email) {
      setError('Either phone or email is required')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: formData.workflow_id,
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          phone: formData.phone || null,
          email: formData.email || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create contact')
      }

      setOpen(false)
      setFormData({
        workflow_id: '',
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
      })
      setSelectedClient('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a new contact to a workflow. They will be queued for outreach.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="client">Client</Label>
              <Select
                value={selectedClient}
                onValueChange={(value) => {
                  setSelectedClient(value)
                  setFormData({ ...formData, workflow_id: '' })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="workflow">Workflow</Label>
              <Select
                value={formData.workflow_id}
                onValueChange={(value) => setFormData({ ...formData, workflow_id: value })}
                disabled={!selectedClient}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedClient ? 'Select a workflow' : 'Select a client first'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredWorkflows.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <p className="text-xs text-gray-500">
                At least one contact method (phone or email) is required
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.workflow_id}>
              {loading ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
