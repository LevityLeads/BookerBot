import { createClient } from '@/lib/supabase/server'
import { ContactsTable } from './contacts-table'
import { ContactsFilters } from './contacts-filters'
import { CreateContactDialog } from './create-contact-dialog'
import { ImportCsvDialog } from './import-csv-dialog'
import { Button } from '@/components/ui/button'
import { Plus, Upload } from 'lucide-react'
import { Contact, Workflow, Client } from '@/types/database'

type ContactWithWorkflow = Contact & {
  workflows: Pick<Workflow, 'id' | 'name' | 'client_id' | 'channel'> & {
    clients: Pick<Client, 'id' | 'name' | 'brand_name'>
  }
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { workflow?: string; client?: string; status?: string; search?: string }
}) {
  const supabase = createClient()

  // Build contacts query with filters
  let query = supabase
    .from('contacts')
    .select(`
      *,
      workflows!inner(
        id,
        name,
        client_id,
        channel,
        clients(id, name, brand_name)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100)

  if (searchParams.workflow) {
    query = query.eq('workflow_id', searchParams.workflow)
  }

  if (searchParams.client) {
    query = query.eq('workflows.client_id', searchParams.client)
  }

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  if (searchParams.search) {
    query = query.or(`first_name.ilike.%${searchParams.search}%,last_name.ilike.%${searchParams.search}%,phone.ilike.%${searchParams.search}%,email.ilike.%${searchParams.search}%`)
  }

  const { data: contacts, count, error } = await query

  if (error) {
    console.error('Error fetching contacts:', error)
  }

  // Fetch clients and workflows for filters
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, brand_name')
    .order('name')

  const { data: workflows } = await supabase
    .from('workflows')
    .select('id, name, client_id')
    .order('name')

  const typedContacts = (contacts || []) as ContactWithWorkflow[]
  const typedClients = (clients || []) as Pick<Client, 'id' | 'name' | 'brand_name'>[]
  const typedWorkflows = (workflows || []) as Pick<Workflow, 'id' | 'name' | 'client_id'>[]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <p className="text-muted-foreground">
            {count !== null ? `${count} contact${count !== 1 ? 's' : ''}` : 'Manage your contacts'}
          </p>
        </div>
        <div className="flex gap-2">
          <ImportCsvDialog workflows={typedWorkflows} clients={typedClients}>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          </ImportCsvDialog>
          <CreateContactDialog workflows={typedWorkflows} clients={typedClients}>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </CreateContactDialog>
        </div>
      </div>

      <ContactsFilters
        clients={typedClients}
        workflows={typedWorkflows}
        selectedClient={searchParams.client}
        selectedWorkflow={searchParams.workflow}
        selectedStatus={searchParams.status}
        searchQuery={searchParams.search}
      />

      <ContactsTable contacts={typedContacts} workflows={typedWorkflows} />
    </div>
  )
}
