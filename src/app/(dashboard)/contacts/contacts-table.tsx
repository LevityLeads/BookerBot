'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Pencil, Trash2, Eye, MessageSquare, Phone, Mail, Send, Loader2 } from 'lucide-react'
import { Contact, Workflow, Client } from '@/types/database'
import { DeleteContactDialog } from './delete-contact-dialog'
import { BulkActionsBar } from './bulk-actions-bar'

type ContactWithWorkflow = Contact & {
  workflows: Pick<Workflow, 'id' | 'name' | 'client_id' | 'channel'> & {
    clients: Pick<Client, 'id' | 'name' | 'brand_name'>
  }
}

type WorkflowOption = Pick<Workflow, 'id' | 'name'>

interface ContactsTableProps {
  contacts: ContactWithWorkflow[]
  workflows?: WorkflowOption[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-secondary text-secondary-foreground',
  contacted: 'bg-blue-500/20 text-blue-400',
  in_conversation: 'bg-yellow-500/20 text-yellow-400',
  qualified: 'bg-purple-500/20 text-purple-400',
  booked: 'bg-green-500/20 text-green-400',
  opted_out: 'bg-red-500/20 text-red-400',
  unresponsive: 'bg-orange-500/20 text-orange-400',
  handed_off: 'bg-pink-500/20 text-pink-400',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  in_conversation: 'In Conversation',
  qualified: 'Qualified',
  booked: 'Booked',
  opted_out: 'Opted Out',
  unresponsive: 'Unresponsive',
  handed_off: 'Handed Off',
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  sms: <MessageSquare className="w-3 h-3" />,
  whatsapp: <Phone className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
}

export function ContactsTable({ contacts, workflows = [] }: ContactsTableProps) {
  const router = useRouter()
  const [deleteContact, setDeleteContact] = useState<ContactWithWorkflow | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendingId, setSendingId] = useState<string | null>(null)

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)))
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleSendOutreach = async (contactId: string) => {
    setSendingId(contactId)
    try {
      const response = await fetch(`/api/contacts/${contactId}/outreach`, {
        method: 'POST'
      })
      const data = await response.json()

      if (data.success) {
        // Refresh the page to show updated status
        router.refresh()
      } else {
        alert(`Failed to send: ${data.error}`)
      }
    } catch (error) {
      console.error('Send outreach error:', error)
      alert('Failed to send message')
    } finally {
      setSendingId(null)
    }
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground mb-2">No contacts found</p>
        <p className="text-sm text-muted-foreground/70">Add contacts manually or import from CSV</p>
      </div>
    )
  }

  return (
    <>
      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          selectedIds={Array.from(selectedIds)}
          onClear={clearSelection}
          workflows={workflows}
        />
      )}

      <div className="bg-card rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedIds.size === contacts.length && contacts.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Follow-ups</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(contact.id)}
                    onCheckedChange={() => toggleSelect(contact.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/contacts/${contact.id}`} className="hover:underline text-foreground">
                    {contact.first_name || contact.last_name
                      ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                      : 'Unknown'}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {contact.phone && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {contact.phone}
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {contact.email}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {CHANNEL_ICONS[contact.workflows.channel]}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-foreground">{contact.workflows.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {contact.workflows.clients.name}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[contact.status]}>
                    {STATUS_LABELS[contact.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.follow_ups_sent} / sent
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(contact.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/contacts/${contact.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/contacts/${contact.id}/edit`)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {contact.status === 'pending' && (
                        <DropdownMenuItem
                          onClick={() => handleSendOutreach(contact.id)}
                          disabled={sendingId === contact.id}
                        >
                          {sendingId === contact.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" />
                          )}
                          Send Message
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-400"
                        onClick={() => setDeleteContact(contact)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DeleteContactDialog
        contact={deleteContact}
        open={!!deleteContact}
        onOpenChange={(open) => !open && setDeleteContact(null)}
      />
    </>
  )
}
