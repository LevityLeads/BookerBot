'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X, Search } from 'lucide-react'
import { Client, Workflow } from '@/types/database'

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

interface ContactsFiltersProps {
  clients: Pick<Client, 'id' | 'name' | 'brand_name'>[]
  workflows: Pick<Workflow, 'id' | 'name' | 'client_id'>[]
  selectedClient?: string
  selectedWorkflow?: string
  selectedStatus?: string
  searchQuery?: string
}

export function ContactsFilters({
  clients,
  workflows,
  selectedClient,
  selectedWorkflow,
  selectedStatus,
  searchQuery,
}: ContactsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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

  const filteredWorkflows = selectedClient
    ? workflows.filter((w) => w.client_id === selectedClient)
    : workflows

  const hasFilters = selectedClient || selectedWorkflow || selectedStatus || searchQuery

  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-foreground mb-1 block">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, email..."
              value={searchQuery || ''}
              onChange={(e) => updateFilter('search', e.target.value || null)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="w-[180px]">
          <label className="text-sm font-medium text-foreground mb-1 block">Client</label>
          <Select
            value={selectedClient || 'all'}
            onValueChange={(value) => {
              updateFilter('client', value === 'all' ? null : value)
              if (value !== selectedClient) {
                updateFilter('workflow', null)
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              {filteredWorkflows.map((workflow) => (
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
  )
}
