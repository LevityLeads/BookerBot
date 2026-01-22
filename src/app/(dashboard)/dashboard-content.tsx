'use client'

import { useEffect, useState } from 'react'
import { useClientContext } from '@/contexts/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Calendar, MessageSquare, TrendingUp, Zap, Loader2, Workflow } from 'lucide-react'
import Link from 'next/link'

interface Stats {
  workflows: number
  contacts: number
  appointments: number
  bookedAppointments: number
}

export function DashboardContent() {
  const { selectedClientId, selectedClient, isLoading: clientLoading } = useClientContext()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      if (!selectedClientId) {
        setStats(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        // Fetch workflows, contacts, and appointments in parallel
        const [workflowsRes, contactsRes, appointmentsRes] = await Promise.all([
          fetch(`/api/workflows?client_id=${selectedClientId}`),
          fetch(`/api/contacts?client_id=${selectedClientId}&limit=1`),
          fetch(`/api/appointments?client_id=${selectedClientId}`),
        ])

        const workflows = await workflowsRes.json()
        const contactsData = await contactsRes.json()
        const appointments = await appointmentsRes.json()

        const appointmentsArray = appointments || []
        const bookedCount = appointmentsArray.filter((a: { status: string }) =>
          ['confirmed', 'completed'].includes(a.status)
        ).length

        setStats({
          workflows: Array.isArray(workflows) ? workflows.length : 0,
          contacts: contactsData.total || 0,
          appointments: appointmentsArray.length,
          bookedAppointments: bookedCount,
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [selectedClientId])

  if (clientLoading) {
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
          <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to BookerBot</h2>
          <p className="text-muted-foreground mb-4">Select a client from the sidebar to get started</p>
          <Link
            href="/clients"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
          >
            <Zap className="w-4 h-4 mr-2" />
            Manage Clients
          </Link>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Active Workflows',
      value: isLoading ? '-' : stats?.workflows || 0,
      icon: Workflow,
      description: 'Running campaigns',
      color: 'cyan',
      gradient: 'from-cyan-500/20 to-cyan-500/5',
    },
    {
      title: 'Total Contacts',
      value: isLoading ? '-' : stats?.contacts || 0,
      icon: Users,
      description: 'In this account',
      color: 'purple',
      gradient: 'from-purple-500/20 to-purple-500/5',
    },
    {
      title: 'Appointments',
      value: isLoading ? '-' : stats?.appointments || 0,
      icon: Calendar,
      description: 'Total bookings',
      color: 'green',
      gradient: 'from-green-500/20 to-green-500/5',
    },
    {
      title: 'Confirmed',
      value: isLoading ? '-' : stats?.bookedAppointments || 0,
      icon: MessageSquare,
      description: 'Active bookings',
      color: 'orange',
      gradient: 'from-orange-500/20 to-orange-500/5',
    },
  ]

  const quickActions = [
    {
      title: 'Create Workflow',
      description: 'Set up a new campaign',
      href: '/workflows',
      icon: Zap,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
    },
    {
      title: 'Add Contacts',
      description: 'Import or add contacts',
      href: '/contacts',
      icon: Users,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    },
    {
      title: 'View Analytics',
      description: 'Check performance',
      href: '/analytics',
      icon: TrendingUp,
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
          <h1 className="text-3xl font-bold text-foreground">{selectedClient?.name || 'Dashboard'}</h1>
          <p className="text-muted-foreground mt-1">
            {selectedClient?.brand_name || 'Welcome to your dashboard'}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="group hover:scale-[1.02] hover:shadow-glow-sm transition-all duration-300">
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
              <div className="text-4xl font-bold text-foreground">
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : (
                  stat.value
                )}
              </div>
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

      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>Activity feed coming soon</p>
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
                  <span className="text-sm font-semibold text-cyan-400">
                    {stats && stats.contacts > 0
                      ? `${((stats.bookedAppointments / stats.contacts) * 100).toFixed(1)}%`
                      : '--%'}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
                    style={{
                      width: stats && stats.contacts > 0
                        ? `${Math.min((stats.bookedAppointments / stats.contacts) * 100, 100)}%`
                        : '0%'
                    }}
                  />
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
