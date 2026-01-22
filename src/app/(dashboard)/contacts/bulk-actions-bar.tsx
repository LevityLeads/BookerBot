'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Trash2, ArrowRight, Send, Download, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Workflow, Contact, Client } from '@/types/database'

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

type WorkflowOption = Pick<Workflow, 'id' | 'name'>

type ContactWithWorkflow = Contact & {
  workflows: Pick<Workflow, 'id' | 'name' | 'client_id' | 'channel'> & {
    clients: Pick<Client, 'id' | 'name' | 'brand_name'>
  }
}

interface BulkActionsBarProps {
  selectedCount: number
  selectedIds: string[]
  selectedContacts?: ContactWithWorkflow[]
  onClear: () => void
  workflows?: WorkflowOption[]
}

export function BulkActionsBar({
  selectedCount,
  selectedIds,
  selectedContacts = [],
  onClear,
  workflows = []
}: BulkActionsBarProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showWorkflowConfirm, setShowWorkflowConfirm] = useState(false)
  const [showOutreachConfirm, setShowOutreachConfirm] = useState(false)
  const [pendingWorkflowId, setPendingWorkflowId] = useState<string | null>(null)
  const [outreachResult, setOutreachResult] = useState<{ success: number; failed: number } | null>(null)

  const updateStatus = async (status: string) => {
    setLoading(true)
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/contacts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          })
        )
      )
      onClear()
      router.refresh()
    } catch (error) {
      console.error('Error updating contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWorkflowSelect = (workflowId: string) => {
    setPendingWorkflowId(workflowId)
    setShowWorkflowConfirm(true)
  }

  const updateWorkflow = async () => {
    if (!pendingWorkflowId) return

    setLoading(true)
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/contacts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workflow_id: pendingWorkflowId }),
          })
        )
      )
      onClear()
      setShowWorkflowConfirm(false)
      setPendingWorkflowId(null)
      router.refresh()
    } catch (error) {
      console.error('Error updating contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteSelected = async () => {
    setLoading(true)
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/contacts/${id}`, {
            method: 'DELETE',
          })
        )
      )
      onClear()
      setShowDeleteConfirm(false)
      router.refresh()
    } catch (error) {
      console.error('Error deleting contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  // Count pending contacts (only those can receive outreach)
  const pendingContactIds = selectedContacts
    .filter(c => c.status === 'pending')
    .map(c => c.id)
  const pendingCount = pendingContactIds.length

  const triggerOutreach = async () => {
    setLoading(true)
    setOutreachResult(null)

    let success = 0
    let failed = 0

    try {
      // Send outreach to each pending contact
      for (const id of pendingContactIds) {
        try {
          const response = await fetch(`/api/contacts/${id}/outreach`, {
            method: 'POST',
          })
          if (response.ok) {
            success++
          } else {
            failed++
          }
        } catch {
          failed++
        }
      }

      setOutreachResult({ success, failed })

      // Refresh after a short delay to show results
      setTimeout(() => {
        onClear()
        setShowOutreachConfirm(false)
        setOutreachResult(null)
        router.refresh()
      }, 2000)
    } catch (error) {
      console.error('Error triggering outreach:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (selectedContacts.length === 0) return

    // Build CSV content
    const headers = [
      'First Name',
      'Last Name',
      'Phone',
      'Email',
      'Status',
      'Workflow',
      'Client',
      'Follow-ups Sent',
      'Created At',
      'Last Message At',
    ]

    const rows = selectedContacts.map((contact) => [
      contact.first_name || '',
      contact.last_name || '',
      contact.phone || '',
      contact.email || '',
      contact.status,
      contact.workflows.name,
      contact.workflows.clients.name,
      contact.follow_ups_sent.toString(),
      new Date(contact.created_at).toLocaleDateString(),
      contact.last_message_at ? new Date(contact.last_message_at).toLocaleDateString() : '',
    ])

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n')

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `contacts-export-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const pendingWorkflow = workflows.find(w => w.id === pendingWorkflowId)

  return (
    <>
      <div className="bg-card border border-border/50 text-foreground rounded-xl p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium">
            {selectedCount} contact{selectedCount !== 1 ? 's' : ''} selected
          </span>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Set status:</span>
            <Select onValueChange={updateStatus} disabled={loading}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {workflows.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Move to:</span>
              <Select onValueChange={handleWorkflowSelect} disabled={loading}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select workflow" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOutreachConfirm(true)}
              disabled={loading}
              className="text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10"
            >
              <Send className="w-4 h-4 mr-1" />
              Send Outreach ({pendingCount})
            </Button>
          )}

          {selectedContacts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={loading}
            >
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-950"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={onClear}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected contacts and all their
              associated messages and appointments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSelected}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workflow Change Confirmation Dialog */}
      <AlertDialog open={showWorkflowConfirm} onOpenChange={setShowWorkflowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Move {selectedCount} contacts to {pendingWorkflow?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will move the selected contacts to a new workflow. Their status will be
              reset to Pending and all messages and appointments will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingWorkflowId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={updateWorkflow}
              disabled={loading}
            >
              {loading ? 'Moving...' : 'Move Contacts'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Outreach Confirmation Dialog */}
      <AlertDialog open={showOutreachConfirm} onOpenChange={setShowOutreachConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-cyan-400" />
              Send outreach to {pendingCount} contacts?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {outreachResult ? (
                <div className="mt-2 space-y-2">
                  <div className="text-green-400">
                    {outreachResult.success} message{outreachResult.success !== 1 ? 's' : ''} sent successfully
                  </div>
                  {outreachResult.failed > 0 && (
                    <div className="text-red-400">
                      {outreachResult.failed} message{outreachResult.failed !== 1 ? 's' : ''} failed
                    </div>
                  )}
                </div>
              ) : (
                <>
                  This will send the initial outreach message to all {pendingCount} pending contacts.
                  Only contacts with &quot;Pending&quot; status will receive messages.
                  {selectedCount > pendingCount && (
                    <span className="block mt-2 text-yellow-400">
                      Note: {selectedCount - pendingCount} contact{selectedCount - pendingCount !== 1 ? 's' : ''} will be skipped (not in Pending status)
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {!outreachResult && (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={triggerOutreach}
                  disabled={loading}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Messages'
                  )}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
