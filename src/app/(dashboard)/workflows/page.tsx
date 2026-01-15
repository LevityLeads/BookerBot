import { createClient } from '@/lib/supabase/server'
import { WorkflowsTable } from './workflows-table'
import { CreateWorkflowWizard } from './create-workflow-wizard'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { Client, Workflow } from '@/types/database'

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: { client?: string }
}) {
  const supabase = createClient()

  let workflowsQuery = supabase
    .from('workflows')
    .select('*, clients(name, brand_name)')
    .order('created_at', { ascending: false })

  if (searchParams.client) {
    workflowsQuery = workflowsQuery.eq('client_id', searchParams.client)
  }

  const { data: workflows, error } = await workflowsQuery

  if (error) {
    console.error('Error fetching workflows:', error)
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, brand_name')
    .order('name')

  const typedWorkflows = (workflows || []) as (Workflow & { clients: Pick<Client, 'name' | 'brand_name'> })[]
  const typedClients = (clients || []) as Pick<Client, 'id' | 'name' | 'brand_name'>[]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="text-muted-foreground">Manage your automation workflows</p>
        </div>
        <CreateWorkflowWizard clients={typedClients}>
          <Button>
            <Sparkles className="w-4 h-4 mr-2" />
            Create AI Workflow
          </Button>
        </CreateWorkflowWizard>
      </div>

      <WorkflowsTable workflows={typedWorkflows} />
    </div>
  )
}
