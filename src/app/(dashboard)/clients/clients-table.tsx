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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react'
import { Client } from '@/types/database'
import { DeleteClientDialog } from './delete-client-dialog'

interface ClientsTableProps {
  clients: (Client & { workflows: { count: number }[] })[]
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const router = useRouter()
  const [deleteClient, setDeleteClient] = useState<Client | null>(null)

  if (clients.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <p className="text-muted-foreground">No clients yet. Create your first client to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-card rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Brand Name</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Workflows</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">
                  <Link href={`/clients/${client.id}`} className="hover:underline">
                    {client.name}
                  </Link>
                </TableCell>
                <TableCell>{client.brand_name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{client.timezone}</Badge>
                </TableCell>
                <TableCell>{client.workflows?.[0]?.count || 0}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(client.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/clients/${client.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/clients/${client.id}/edit`)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => setDeleteClient(client)}
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

      <DeleteClientDialog
        client={deleteClient}
        open={!!deleteClient}
        onOpenChange={(open) => !open && setDeleteClient(null)}
      />
    </>
  )
}
