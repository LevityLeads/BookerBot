'use client'

import { useEffect, useState } from 'react'
import { useClientContext } from '@/contexts/client-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Users, Calendar, MessageSquare, TrendingUp, Loader2 } from 'lucide-react'

interface AnalyticsData {
  totalContacts: number
  totalAppointments: number
  totalMessages: number
  contactsByStatus: Record<string, number>
  appointmentsByStatus: Record<string, number>
  conversionRate: number
}

export default function AnalyticsPage() {
  const { selectedClientId, selectedClient, isLoading: clientLoading } = useClientContext()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchAnalytics() {
      if (!selectedClientId) {
        setAnalytics(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        // Fetch contacts count
        const contactsRes = await fetch(`/api/contacts?client_id=${selectedClientId}&limit=1`)
        const contactsData = await contactsRes.json()

        // Fetch appointments
        const appointmentsRes = await fetch(`/api/appointments?client_id=${selectedClientId}`)
        const appointmentsData = await appointmentsRes.json()

        const appointments = appointmentsData || []
        const totalContacts = contactsData.total || 0

        // Calculate stats
        const appointmentsByStatus: Record<string, number> = {}
        appointments.forEach((a: { status: string }) => {
          appointmentsByStatus[a.status] = (appointmentsByStatus[a.status] || 0) + 1
        })

        const bookedCount = appointments.filter((a: { status: string }) =>
          ['confirmed', 'completed'].includes(a.status)
        ).length

        setAnalytics({
          totalContacts,
          totalAppointments: appointments.length,
          totalMessages: 0, // Would need a messages API
          contactsByStatus: {},
          appointmentsByStatus,
          conversionRate: totalContacts > 0 ? (bookedCount / totalContacts) * 100 : 0,
        })
      } catch (error) {
        console.error('Error fetching analytics:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
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
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Select a client to view analytics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground">
          {selectedClient ? `Performance metrics for ${selectedClient.name}` : 'View your performance metrics'}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{analytics?.totalContacts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-400">{analytics?.totalAppointments || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">
              {(analytics?.conversionRate || 0).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Messages Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400">-</div>
            <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Appointment Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Appointment Status Breakdown</CardTitle>
          <CardDescription>Distribution of appointments by status</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics && Object.keys(analytics.appointmentsByStatus).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(analytics.appointmentsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        status === 'confirmed'
                          ? 'bg-cyan-400'
                          : status === 'completed'
                          ? 'bg-green-400'
                          : status === 'cancelled'
                          ? 'bg-red-400'
                          : 'bg-muted-foreground'
                      }`}
                    />
                    <span className="capitalize text-foreground">{status.replace('_', ' ')}</span>
                  </div>
                  <span className="font-medium text-foreground">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No appointment data available yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
