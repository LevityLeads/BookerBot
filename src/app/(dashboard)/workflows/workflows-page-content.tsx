'use client'

import { useEffect, useState } from 'react'
import { useClientContext } from '@/contexts/client-context'
import { WorkflowsTable } from './workflows-table'
import { CreateWorkflowWizard } from './create-workflow-wizard'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'
import { Client, Workflow } from '@/types/database'

type WorkflowWithClient = Workflow & { clients: Pick<Client, 'name' | 'brand_name'> }

export function WorkflowsPageContent() {
  const { selectedClientId, selectedClient, isLoading: clientLoading } = useClientContext()
  const [workflows, setWorkflows] = useState<WorkflowWithClient[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchWorkflows() {
      if (!selectedClientId) {
        setWorkflows([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/workflows?client_id=${selectedClientId}`)
        if (response.ok) {
          const data = await response.json()
          setWorkflows(data)
        }
      } catch (error) {
        console.error('Error fetching workflows:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchWorkflows()
  }, [selectedClientId])

  if (clientLoading || isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </div>
    )
  }

  if (!selectedClientId) {
    return (
      <div className="p-8">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Select a client to view workflows</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="text-muted-foreground">
            {selectedClient?.name ? `Workflows for ${selectedClient.name}` : 'Manage your automation workflows'}
          </p>
        </div>
        <CreateWorkflowWizard
          clients={selectedClient ? [{
            id: selectedClient.id,
            name: selectedClient.name,
            brand_name: selectedClient.brand_name,
            brand_summary: selectedClient.brand_summary,
            brand_researched_at: selectedClient.brand_researched_at,
          }] : []}
          preselectedClientId={selectedClientId}
        >
          <Button>
            <Sparkles className="w-4 h-4 mr-2" />
            Create AI Workflow
          </Button>
        </CreateWorkflowWizard>
      </div>

      <WorkflowsTable workflows={workflows} />
    </div>
  )
}
