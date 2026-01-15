'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

interface DeleteWorkflowDialogProps {
  workflow: Workflow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteWorkflowDialog({ workflow, open, onOpenChange }: DeleteWorkflowDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!workflow) return

    setLoading(true)
    try {
      await fetch(`/api/workflows/${workflow.id}`, {
        method: 'DELETE',
      })
      router.refresh()
      onOpenChange(false)
    } catch (error) {
      console.error('Error deleting workflow:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{workflow?.name}&quot;? This action cannot be undone.
            All contacts and messages associated with this workflow will also be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
