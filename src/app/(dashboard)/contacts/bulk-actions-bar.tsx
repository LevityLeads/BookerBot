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
import { X, Trash2 } from 'lucide-react'
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

interface BulkActionsBarProps {
  selectedCount: number
  selectedIds: string[]
  onClear: () => void
}

export function BulkActionsBar({ selectedCount, selectedIds, onClear }: BulkActionsBarProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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

  return (
    <>
      <div className="bg-gray-900 text-white rounded-lg p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedCount} contact{selectedCount !== 1 ? 's' : ''} selected
          </span>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Set status:</span>
            <Select onValueChange={updateStatus} disabled={loading}>
              <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700 text-white">
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
          className="text-gray-400 hover:text-white"
          onClick={onClear}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

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
    </>
  )
}
