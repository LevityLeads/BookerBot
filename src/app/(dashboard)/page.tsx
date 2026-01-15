import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, Calendar, MessageSquare, TrendingUp, Zap } from 'lucide-react'
import Link from 'next/link'

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
      description: 'Active client accounts',
      color: 'cyan',
      gradient: 'from-cyan-500/20 to-cyan-500/5',
    },
    {
      title: 'Total Contacts',
      value: stats.contacts,
      icon: Users,
      description: 'Across all workflows',
      color: 'purple',
      gradient: 'from-purple-500/20 to-purple-500/5',
    },
    {
      title: 'Appointments',
      value: stats.appointments,
      icon: Calendar,
      description: 'Confirmed bookings',
      color: 'green',
      gradient: 'from-green-500/20 to-green-500/5',
    },
    {
      title: 'Active Workflows',
      value: stats.activeWorkflows,
      icon: MessageSquare,
      description: 'Currently running',
      color: 'orange',
      gradient: 'from-orange-500/20 to-orange-500/5',
    },
  ]

  const quickActions = [
    {
      title: 'Add Client',
      description: 'Create a new client account',
      href: '/clients',
      icon: Building2,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
    },
    {
      title: 'Create Workflow',
      description: 'Set up an outreach campaign',
      href: '/workflows',
      icon: Zap,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    },
    {
      title: 'Import Contacts',
      description: 'Upload contacts from CSV',
      href: '/contacts',
      icon: Users,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    },
  ]

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="relative">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome to Levity BookerBot</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="group hover:scale-[1.02] hover:shadow-glow-sm">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-xl bg-${stat.color}-500/10 border border-${stat.color}-500/20`}>
                <stat.icon className={`h-5 w-5 text-${stat.color}-400`} />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-4xl font-bold text-foreground">{stat.value}</div>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className={`group flex items-center p-5 rounded-xl ${action.bgColor} border ${action.borderColor} hover:shadow-glow-sm transition-all duration-300 hover:-translate-y-1`}
              >
                <div className={`p-3 rounded-xl ${action.bgColor} border ${action.borderColor} mr-4 group-hover:scale-110 transition-transform duration-300`}>
                  <action.icon className={`h-6 w-6 ${action.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-cyan-400 transition-colors">{action.title}</h3>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-border/30">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">New contact added</p>
                    <p className="text-xs text-muted-foreground">Just now</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Booking Rate</span>
                  <span className="text-sm font-semibold text-cyan-400">--%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full" />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Response Rate</span>
                  <span className="text-sm font-semibold text-purple-400">--%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-gradient-to-r from-purple-500 to-purple-400 rounded-full" />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Qualification Rate</span>
                  <span className="text-sm font-semibold text-green-400">--%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-gradient-to-r from-green-500 to-green-400 rounded-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
