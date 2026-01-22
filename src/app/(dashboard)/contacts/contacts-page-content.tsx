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
import { Plus, Upload, Loader2, Search, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
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

const PAGE_SIZES = [25, 50, 100, 250]

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
  const createdAfter = searchParams.get('created_after') || ''
  const createdBefore = searchParams.get('created_before') || ''
  const lastMessageAfter = searchParams.get('last_message_after') || ''
  const lastMessageBefore = searchParams.get('last_message_before') || ''

  // Pagination
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')
  const totalPages = Math.ceil(total / pageSize)

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
    // Reset to page 1 when filters change
    const updates: Record<string, string | null> = { [key]: value }
    if (key !== 'page' && key !== 'pageSize') {
      updates.page = '1'
    }
    const queryString = createQueryString(updates)
    router.push(pathname + (queryString ? `?${queryString}` : ''))
  }

  const updateMultipleFilters = (updates: Record<string, string | null>) => {
    // Reset to page 1 when filters change
    if (!('page' in updates)) {
      updates.page = '1'
    }
    const queryString = createQueryString(updates)
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
        params.set('limit', pageSize.toString())
        params.set('offset', ((page - 1) * pageSize).toString())

        if (selectedWorkflow) params.set('workflow_id', selectedWorkflow)
        if (selectedStatus) params.set('status', selectedStatus)
        if (searchQuery) params.set('search', searchQuery)
        if (createdAfter) params.set('created_after', createdAfter)
        if (createdBefore) params.set('created_before', createdBefore)
        if (lastMessageAfter) params.set('last_message_after', lastMessageAfter)
        if (lastMessageBefore) params.set('last_message_before', lastMessageBefore)

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
  }, [selectedClientId, selectedWorkflow, selectedStatus, searchQuery, page, pageSize, createdAfter, createdBefore, lastMessageAfter, lastMessageBefore])

  const hasFilters = selectedWorkflow || selectedStatus || searchQuery || createdAfter || createdBefore || lastMessageAfter || lastMessageBefore
  const hasDateFilters = createdAfter || createdBefore || lastMessageAfter || lastMessageBefore

  // Calculate displayed range
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

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
            {total > 0 ? `${total.toLocaleString()} contact${total !== 1 ? 's' : ''} for ${selectedClient?.name}` : `Contacts for ${selectedClient?.name}`}
          </p>
        </div>
        <div className="flex gap-2">
          <ImportCsvDialog workflows={workflows} clients={selectedClient ? [selectedClient] : []}>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          </ImportCsvDialog>
          <CreateContactDialog workflows={workflows} clients={selectedClient ? [selectedClient] : []}>
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

        {/* Date Range Filters (collapsible) */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Date filters
            {hasDateFilters && <span className="text-cyan-400">(active)</span>}
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Created after</label>
              <Input
                type="date"
                value={createdAfter}
                onChange={(e) => updateFilter('created_after', e.target.value || null)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Created before</label>
              <Input
                type="date"
                value={createdBefore}
                onChange={(e) => updateFilter('created_before', e.target.value || null)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Last message after</label>
              <Input
                type="date"
                value={lastMessageAfter}
                onChange={(e) => updateFilter('last_message_after', e.target.value || null)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Last message before</label>
              <Input
                type="date"
                value={lastMessageBefore}
                onChange={(e) => updateFilter('last_message_before', e.target.value || null)}
              />
            </div>
          </div>
        </details>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : (
        <>
          <ContactsTable contacts={contacts} workflows={workflows} />

          {/* Pagination */}
          {total > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-card rounded-xl border border-border/50 p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {total.toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">per page:</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => updateMultipleFilters({ pageSize: value, page: '1' })}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilter('page', (page - 1).toString())}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-1 px-2">
                  <span className="text-sm text-foreground">
                    Page {page} of {totalPages}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilter('page', (page + 1).toString())}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
