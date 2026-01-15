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
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-secondary/50">
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Brand Name</TableHead>
              <TableHead className="text-muted-foreground">Timezone</TableHead>
              <TableHead className="text-muted-foreground">Workflows</TableHead>
              <TableHead className="text-muted-foreground">Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id} className="border-border hover:bg-secondary/50">
                <TableCell className="font-medium text-foreground">
                  <Link href={`/clients/${client.id}`} className="hover:text-primary transition-colors">
                    {client.name}
                  </Link>
                </TableCell>
                <TableCell className="text-foreground">{client.brand_name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-secondary text-secondary-foreground">{client.timezone}</Badge>
                </TableCell>
                <TableCell className="text-foreground">{client.workflows?.[0]?.count || 0}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(client.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem onClick={() => router.push(`/clients/${client.id}`)} className="hover:bg-secondary">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/clients/${client.id}/edit`)} className="hover:bg-secondary">
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive hover:bg-destructive/10"
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
