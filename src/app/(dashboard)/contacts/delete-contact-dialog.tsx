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
import { Contact } from '@/types/database'

interface DeleteContactDialogProps {
  contact: Contact | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteContactDialog({ contact, open, onOpenChange }: DeleteContactDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!contact) return

    setLoading(true)

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete contact')
      }

      onOpenChange(false)
      router.refresh()
    } catch (error) {
      console.error('Error deleting contact:', error)
    } finally {
      setLoading(false)
    }
  }

  const contactName = contact
    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.phone || contact.email || 'this contact'
    : ''

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Contact</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {contactName}? This will also delete all
            associated messages and appointments. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
