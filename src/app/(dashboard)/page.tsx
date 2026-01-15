import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, Calendar, MessageSquare } from 'lucide-react'

async function getStats() {
  const supabase = createClient()

  const [clientsResult, contactsResult, appointmentsResult, workflowsResult] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('workflows').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  return {
    clients: clientsResult.count ?? 0,
    contacts: contactsResult.count ?? 0,
    appointments: appointmentsResult.count ?? 0,
    activeWorkflows: workflowsResult.count ?? 0,
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  const statCards = [
    {
      title: 'Total Clients',
      value: stats.clients,
      icon: Building2,
      description: 'Active clients on the platform',
    },
    {
      title: 'Total Contacts',
      value: stats.contacts,
      icon: Users,
      description: 'Contacts across all workflows',
    },
    {
      title: 'Booked Appointments',
      value: stats.appointments,
      icon: Calendar,
      description: 'Confirmed appointments',
    },
    {
      title: 'Active Workflows',
      value: stats.activeWorkflows,
      icon: MessageSquare,
      description: 'Currently running workflows',
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Levity BookerBot admin panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.title} className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Quick Start</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/clients"
              className="flex items-center p-4 bg-secondary rounded-lg hover:bg-secondary/80 border border-border hover:border-primary/30 transition-all"
            >
              <Building2 className="h-8 w-8 text-primary mr-4" />
              <div>
                <h3 className="font-medium text-foreground">Add a Client</h3>
                <p className="text-sm text-muted-foreground">Create a new client account</p>
              </div>
            </a>
            <a
              href="/workflows"
              className="flex items-center p-4 bg-secondary rounded-lg hover:bg-secondary/80 border border-border hover:border-primary/30 transition-all"
            >
              <MessageSquare className="h-8 w-8 text-primary mr-4" />
              <div>
                <h3 className="font-medium text-foreground">Create Workflow</h3>
                <p className="text-sm text-muted-foreground">Set up an outreach campaign</p>
              </div>
            </a>
            <a
              href="/contacts"
              className="flex items-center p-4 bg-secondary rounded-lg hover:bg-secondary/80 border border-border hover:border-primary/30 transition-all"
            >
              <Users className="h-8 w-8 text-primary mr-4" />
              <div>
                <h3 className="font-medium text-foreground">View Contacts</h3>
                <p className="text-sm text-muted-foreground">Manage all contacts</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
