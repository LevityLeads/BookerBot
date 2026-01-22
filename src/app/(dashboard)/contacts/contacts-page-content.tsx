'use client'

import { useEffect, useState, useCallback } from 'react'
import { useClientContext } from '@/contexts/client-context'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ContactsTable } from './contacts-table'
import { CreateContactDialog } from './create-contact-dialog'
import { ImportCsvDialog } from './import-csv-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Upload, Loader2, Search, X } from 'lucide-react'
import { Contact, Workflow, Client } from '@/types/database'

type ContactWithWorkflow = Contact & {
  workflows: Pick<Workflow, 'id' | 'name' | 'client_id' | 'channel'> & {
    clients: Pick<Client, 'id' | 'name' | 'brand_name'>
  }
}

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

export function ContactsPageContent() {
  const { selectedClientId, selectedClient, isLoading: clientLoading } = useClientContext()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [contacts, setContacts] = useState<ContactWithWorkflow[]>([])
  const [workflows, setWorkflows] = useState<Pick<Workflow, 'id' | 'name' | 'client_id'>[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Get filter values from URL
  const selectedWorkflow = searchParams.get('workflow') || ''
  const selectedStatus = searchParams.get('status') || ''
  const searchQuery = searchParams.get('search') || ''

  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([name, value]) => {
        if (value === null || value === '') {
          params.delete(name)
        } else {
          params.set(name, value)
        }
      })
      return params.toString()
    },
    [searchParams]
  )

  const updateFilter = (key: string, value: string | null) => {
    const queryString = createQueryString({ [key]: value })
    router.push(pathname + (queryString ? `?${queryString}` : ''))
  }

  const clearFilters = () => {
    router.push(pathname)
  }

  // Fetch workflows for this client
  useEffect(() => {
    async function fetchWorkflows() {
      if (!selectedClientId) {
        setWorkflows([])
        return
      }

      try {
        const response = await fetch(`/api/workflows?client_id=${selectedClientId}`)
        if (response.ok) {
          const data = await response.json()
          setWorkflows(data.map((w: Workflow) => ({ id: w.id, name: w.name, client_id: w.client_id })))
        }
      } catch (error) {
        console.error('Error fetching workflows:', error)
      }
    }

    fetchWorkflows()
  }, [selectedClientId])

  // Fetch contacts
  useEffect(() => {
    async function fetchContacts() {
      if (!selectedClientId) {
        setContacts([])
        setTotal(0)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('client_id', selectedClientId)
        if (selectedWorkflow) params.set('workflow_id', selectedWorkflow)
        if (selectedStatus) params.set('status', selectedStatus)
        if (searchQuery) params.set('search', searchQuery)

        const response = await fetch(`/api/contacts?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setContacts(data.contacts || [])
          setTotal(data.total || 0)
        }
      } catch (error) {
        console.error('Error fetching contacts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchContacts()
  }, [selectedClientId, selectedWorkflow, selectedStatus, searchQuery])

  const hasFilters = selectedWorkflow || selectedStatus || searchQuery

  if (clientLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </div>
    )
  }

  if (!selectedClientId) {
    return (
      <div className="p-8">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Select a client to view contacts</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <p className="text-muted-foreground">
            {total > 0 ? `${total} contact${total !== 1 ? 's' : ''} for ${selectedClient?.name}` : `Contacts for ${selectedClient?.name}`}
          </p>
        </div>
        <div className="flex gap-2">
          <ImportCsvDialog workflows={workflows}>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          </ImportCsvDialog>
          <CreateContactDialog workflows={workflows}>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </CreateContactDialog>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-1 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email..."
                value={searchQuery}
                onChange={(e) => updateFilter('search', e.target.value || null)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-[180px]">
            <label className="text-sm font-medium text-foreground mb-1 block">Workflow</label>
            <Select
              value={selectedWorkflow || 'all'}
              onValueChange={(value) => updateFilter('workflow', value === 'all' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All workflows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workflows</SelectItem>
                {workflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[160px]">
            <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
            <Select
              value={selectedStatus || 'all'}
              onValueChange={(value) => updateFilter('status', value === 'all' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : (
        <ContactsTable contacts={contacts} workflows={workflows} />
      )}
    </div>
  )
}
