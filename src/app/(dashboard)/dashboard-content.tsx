'use client'

import { useEffect, useState } from 'react'
import { useClientContext } from '@/contexts/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  Calendar,
  MessageSquare,
  TrendingUp,
  Zap,
  Loader2,
  Workflow,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Phone,
  Mail,
  DollarSign,
  Activity,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

interface AnalyticsData {
  overview: {
    totalContacts: number
    pending: number
    contacted: number
    inConversation: number
    qualified: number
    booked: number
    optedOut: number
    unresponsive: number
    handedOff: number
  }
  rates: {
    responseRate: number
    qualificationRate: number
    bookingRate: number
    optOutRate: number
  }
  aiUsage: {
    totalTokens: number
    inputTokens: number
    outputTokens: number
    totalCost: number
    totalMessages: number
    averageTokensPerMessage: number
  }
  appointments: {
    total: number
    confirmed: number
    completed: number
    cancelled: number
    noShow: number
  }
  recentActivity: Array<{
    id: string
    type: 'message_sent' | 'message_received' | 'status_change' | 'appointment_booked'
    content: string
    contactName: string
    contactId: string
    timestamp: string
    channel?: string
  }>
}

interface BasicStats {
  workflows: number
}

export function DashboardContent() {
  const { selectedClientId, selectedClient, isLoading: clientLoading } = useClientContext()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [basicStats, setBasicStats] = useState<BasicStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!selectedClientId) {
        setAnalytics(null)
        setBasicStats(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        // Fetch analytics and workflow count in parallel
        const [analyticsRes, workflowsRes] = await Promise.all([
          fetch(`/api/analytics?client_id=${selectedClientId}`),
          fetch(`/api/workflows?client_id=${selectedClientId}`),
        ])

        const analyticsData = await analyticsRes.json()
        const workflows = await workflowsRes.json()

        if (!analyticsRes.ok) {
          console.error('Analytics error:', analyticsData.error)
        } else {
          setAnalytics(analyticsData)
        }

        setBasicStats({
          workflows: Array.isArray(workflows) ? workflows.length : 0,
        })
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
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
      value: isLoading ? '-' : basicStats?.workflows || 0,
      icon: Workflow,
      description: 'Running campaigns',
      color: 'cyan',
      gradient: 'from-cyan-500/20 to-cyan-500/5',
    },
    {
      title: 'Total Contacts',
      value: isLoading ? '-' : analytics?.overview.totalContacts || 0,
      icon: Users,
      description: 'In this account',
      color: 'purple',
      gradient: 'from-purple-500/20 to-purple-500/5',
    },
    {
      title: 'Appointments',
      value: isLoading ? '-' : analytics?.appointments.total || 0,
      icon: Calendar,
      description: `${analytics?.appointments.confirmed || 0} confirmed`,
      color: 'green',
      gradient: 'from-green-500/20 to-green-500/5',
    },
    {
      title: 'Booked',
      value: isLoading ? '-' : analytics?.overview.booked || 0,
      icon: CheckCircle,
      description: 'Contacts with bookings',
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
      title: 'View Appointments',
      description: 'Manage bookings',
      href: '/appointments',
      icon: Calendar,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    },
  ]

  // Format time ago
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Get channel icon
  const getChannelIcon = (channel?: string) => {
    switch (channel) {
      case 'sms':
        return <MessageSquare className="w-3 h-3" />
      case 'whatsapp':
        return <Phone className="w-3 h-3" />
      case 'email':
        return <Mail className="w-3 h-3" />
      default:
        return <MessageSquare className="w-3 h-3" />
    }
  }

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

      {/* Performance Overview and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {analytics.recentActivity.slice(0, 5).map((activity) => (
                  <Link
                    key={activity.id}
                    href={`/contacts/${activity.contactId}`}
                    className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                  >
                    <div className={`p-2 rounded-lg ${
                      activity.type === 'message_received'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {activity.type === 'message_received' ? (
                        <ArrowRight className="w-4 h-4 rotate-180" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground group-hover:text-cyan-400 transition-colors">
                          {activity.contactName}
                        </span>
                        {activity.channel && (
                          <span className="text-muted-foreground">
                            {getChannelIcon(activity.channel)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {activity.content}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Response Rate */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Response Rate</span>
                  <span className="text-sm font-semibold text-purple-400">
                    {isLoading ? '--' : `${analytics?.rates.responseRate || 0}%`}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(analytics?.rates.responseRate || 0, 100)}%` }}
                  />
                </div>
              </div>

              {/* Qualification Rate */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Qualification Rate</span>
                  <span className="text-sm font-semibold text-green-400">
                    {isLoading ? '--' : `${analytics?.rates.qualificationRate || 0}%`}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(analytics?.rates.qualificationRate || 0, 100)}%` }}
                  />
                </div>
              </div>

              {/* Booking Rate */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Booking Rate</span>
                  <span className="text-sm font-semibold text-cyan-400">
                    {isLoading ? '--' : `${analytics?.rates.bookingRate || 0}%`}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(analytics?.rates.bookingRate || 0, 100)}%` }}
                  />
                </div>
              </div>

              {/* Opt-out Rate */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Opt-out Rate</span>
                  <span className="text-sm font-semibold text-red-400">
                    {isLoading ? '--' : `${analytics?.rates.optOutRate || 0}%`}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(analytics?.rates.optOutRate || 0, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Funnel & AI Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Contact Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                <FunnelRow
                  label="Pending"
                  count={analytics?.overview.pending || 0}
                  total={analytics?.overview.totalContacts || 0}
                  color="gray"
                  icon={<Clock className="w-4 h-4" />}
                />
                <FunnelRow
                  label="Contacted"
                  count={analytics?.overview.contacted || 0}
                  total={analytics?.overview.totalContacts || 0}
                  color="blue"
                  icon={<MessageSquare className="w-4 h-4" />}
                />
                <FunnelRow
                  label="In Conversation"
                  count={analytics?.overview.inConversation || 0}
                  total={analytics?.overview.totalContacts || 0}
                  color="yellow"
                  icon={<Activity className="w-4 h-4" />}
                />
                <FunnelRow
                  label="Qualified"
                  count={analytics?.overview.qualified || 0}
                  total={analytics?.overview.totalContacts || 0}
                  color="purple"
                  icon={<CheckCircle className="w-4 h-4" />}
                />
                <FunnelRow
                  label="Booked"
                  count={analytics?.overview.booked || 0}
                  total={analytics?.overview.totalContacts || 0}
                  color="green"
                  icon={<Calendar className="w-4 h-4" />}
                />
                <div className="border-t border-border pt-3 mt-3">
                  <FunnelRow
                    label="Opted Out"
                    count={analytics?.overview.optedOut || 0}
                    total={analytics?.overview.totalContacts || 0}
                    color="red"
                    icon={<XCircle className="w-4 h-4" />}
                  />
                  <FunnelRow
                    label="Unresponsive"
                    count={analytics?.overview.unresponsive || 0}
                    total={analytics?.overview.totalContacts || 0}
                    color="orange"
                    icon={<Clock className="w-4 h-4" />}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              AI Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm text-muted-foreground">AI Messages</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {analytics?.aiUsage.totalMessages.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-muted-foreground">Total Cost</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      ${analytics?.aiUsage.totalCost.toFixed(4) || '0.00'}
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-border">
                  <div className="text-sm text-muted-foreground mb-3">Token Usage</div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-foreground">
                        {analytics?.aiUsage.inputTokens.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Input</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-foreground">
                        {analytics?.aiUsage.outputTokens.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Output</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-foreground">
                        {analytics?.aiUsage.averageTokensPerMessage.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Avg/Msg</div>
                    </div>
                  </div>
                </div>
                {analytics?.aiUsage.totalMessages === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No AI messages sent yet
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Funnel row component
function FunnelRow({
  label,
  count,
  total,
  color,
  icon,
}: {
  label: string
  count: number
  total: number
  color: string
  icon: React.ReactNode
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0
  const colorClasses: Record<string, { bg: string; text: string; bar: string }> = {
    gray: { bg: 'bg-gray-500/10', text: 'text-gray-400', bar: 'bg-gray-500' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', bar: 'bg-blue-500' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', bar: 'bg-yellow-500' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', bar: 'bg-purple-500' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', bar: 'bg-green-500' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', bar: 'bg-red-500' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', bar: 'bg-orange-500' },
  }

  const colors = colorClasses[color] || colorClasses.gray

  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-foreground">{label}</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`${colors.bg} ${colors.text} text-xs`}>
              {count}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {percentage.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
