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
import { MoreHorizontal, Pencil, Trash2, Eye, MessageSquare, Phone, Mail } from 'lucide-react'
import { Contact, Workflow, Client } from '@/types/database'
import { DeleteContactDialog } from './delete-contact-dialog'
import { BulkActionsBar } from './bulk-actions-bar'

type ContactWithWorkflow = Contact & {
  workflows: Pick<Workflow, 'id' | 'name' | 'client_id' | 'channel'> & {
    clients: Pick<Client, 'id' | 'name' | 'brand_name'>
  }
}

interface ContactsTableProps {
  contacts: ContactWithWorkflow[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  contacted: 'bg-blue-100 text-blue-800',
  in_conversation: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-purple-100 text-purple-800',
  booked: 'bg-green-100 text-green-800',
  opted_out: 'bg-red-100 text-red-800',
  unresponsive: 'bg-orange-100 text-orange-800',
  handed_off: 'bg-pink-100 text-pink-800',
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

export function ContactsTable({ contacts }: ContactsTableProps) {
  const router = useRouter()
  const [deleteContact, setDeleteContact] = useState<ContactWithWorkflow | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border">
        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">No contacts found</p>
        <p className="text-sm text-gray-400">Add contacts manually or import from CSV</p>
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
        />
      )}

      <div className="bg-white rounded-lg border">
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
                  <Link href={`/contacts/${contact.id}`} className="hover:underline">
                    {contact.first_name || contact.last_name
                      ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                      : 'Unknown'}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {contact.phone && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone className="w-3 h-3" />
                        {contact.phone}
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Mail className="w-3 h-3" />
                        {contact.email}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">
                      {CHANNEL_ICONS[contact.workflows.channel]}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{contact.workflows.name}</div>
                      <div className="text-xs text-gray-500">
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
                <TableCell className="text-gray-500">
                  {contact.follow_ups_sent} / sent
                </TableCell>
                <TableCell className="text-gray-500">
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
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
