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
import { X, Trash2, ArrowRight } from 'lucide-react'
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
import { Workflow } from '@/types/database'

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

interface BulkActionsBarProps {
  selectedCount: number
  selectedIds: string[]
  onClear: () => void
  workflows?: WorkflowOption[]
}

export function BulkActionsBar({ selectedCount, selectedIds, onClear, workflows = [] }: BulkActionsBarProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showWorkflowConfirm, setShowWorkflowConfirm] = useState(false)
  const [pendingWorkflowId, setPendingWorkflowId] = useState<string | null>(null)

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
    </>
  )
}
