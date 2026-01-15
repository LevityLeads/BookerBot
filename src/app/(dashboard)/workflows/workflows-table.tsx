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
import { MoreHorizontal, Pencil, Trash2, Eye, Play, Pause } from 'lucide-react'
import { Client, Workflow } from '@/types/database'
import { DeleteWorkflowDialog } from './delete-workflow-dialog'

interface WorkflowsTableProps {
  workflows: (Workflow & { clients: Pick<Client, 'name' | 'brand_name'> })[]
}

export function WorkflowsTable({ workflows }: WorkflowsTableProps) {
  const router = useRouter()
  const [deleteWorkflow, setDeleteWorkflow] = useState<Workflow | null>(null)

  const toggleStatus = async (workflow: Workflow) => {
    const newStatus = workflow.status === 'active' ? 'paused' : 'active'
    try {
      await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      router.refresh()
    } catch (error) {
      console.error('Error updating workflow status:', error)
    }
  }

  if (workflows.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <p className="text-muted-foreground">No workflows yet. Create your first workflow to get started.</p>
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
              <TableHead className="text-muted-foreground">Client</TableHead>
              <TableHead className="text-muted-foreground">Channel</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((workflow) => (
              <TableRow key={workflow.id} className="border-border hover:bg-secondary/50">
                <TableCell className="font-medium text-foreground">
                  <Link href={`/workflows/${workflow.id}`} className="hover:text-primary transition-colors">
                    {workflow.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/clients/${workflow.client_id}`}
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    {workflow.clients?.name || 'Unknown'}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-border text-foreground">
                    {workflow.channel.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      workflow.status === 'active'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : workflow.status === 'paused'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : 'bg-secondary text-secondary-foreground'
                    }
                  >
                    {workflow.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(workflow.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem onClick={() => router.push(`/workflows/${workflow.id}`)} className="hover:bg-secondary">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/workflows/${workflow.id}/edit`)} className="hover:bg-secondary">
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {workflow.status !== 'archived' && (
                        <DropdownMenuItem onClick={() => toggleStatus(workflow)} className="hover:bg-secondary">
                          {workflow.status === 'active' ? (
                            <>
                              <Pause className="w-4 h-4 mr-2" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteWorkflow(workflow)}
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

      <DeleteWorkflowDialog
        workflow={deleteWorkflow}
        open={!!deleteWorkflow}
        onOpenChange={(open) => !open && setDeleteWorkflow(null)}
      />
    </>
  )
}
