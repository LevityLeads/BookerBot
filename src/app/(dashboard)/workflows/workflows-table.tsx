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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Pencil, Trash2, Eye, Play, Pause, Zap } from 'lucide-react'
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
      <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
        <Zap className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground mb-2">No workflows yet</p>
        <p className="text-sm text-muted-foreground/70">Create your first workflow to get started</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((workflow) => (
              <TableRow key={workflow.id}>
                <TableCell className="font-medium">
                  <Link href={`/workflows/${workflow.id}`} className="text-foreground hover:text-cyan-400 transition-colors">
                    {workflow.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/clients/${workflow.client_id}`}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {workflow.clients?.name || 'Unknown'}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {workflow.channel.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      workflow.status === 'active'
                        ? 'success'
                        : workflow.status === 'paused'
                        ? 'warning'
                        : 'secondary'
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
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/workflows/${workflow.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/workflows/${workflow.id}/edit`)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {workflow.status !== 'archived' && (
                        <DropdownMenuItem onClick={() => toggleStatus(workflow)}>
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-400"
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
