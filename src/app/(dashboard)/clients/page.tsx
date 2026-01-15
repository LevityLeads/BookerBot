import { createClient } from '@/lib/supabase/server'
import { ClientsTable } from './clients-table'
import { CreateClientDialog } from './create-client-dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function ClientsPage() {
  const supabase = createClient()

  const { data: clients, error } = await supabase
    .from('clients')
    .select('*, workflows(count)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching clients:', error)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500">Manage your client accounts</p>
        </div>
        <CreateClientDialog>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
        </CreateClientDialog>
      </div>

      <ClientsTable clients={clients || []} />
    </div>
  )
}
