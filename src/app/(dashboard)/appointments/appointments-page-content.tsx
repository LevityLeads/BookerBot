'use client'

import { useEffect, useState } from 'react'
import { useClientContext } from '@/contexts/client-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Loader2, Workflow } from 'lucide-react'
import Link from 'next/link'

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  notes: string | null
  calendar_event_id: string | null
  created_at: string
  contacts: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    email: string | null
  }
  workflows: {
    id: string
    name: string
  }
  clients: {
    id: string
    name: string
    brand_name: string
  }
}

const STATUS_STYLES: Record<string, { variant: 'default' | 'secondary' | 'success' | 'destructive'; label: string }> = {
  confirmed: { variant: 'default', label: 'Confirmed' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'destructive', label: 'Cancelled' },
  no_show: { variant: 'secondary', label: 'No Show' },
}

export function AppointmentsPageContent() {
  const { selectedClientId, selectedClient, isLoading: clientLoading } = useClientContext()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchAppointments() {
      if (!selectedClientId) {
        setAppointments([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/appointments?client_id=${selectedClientId}`)
        if (response.ok) {
          const data = await response.json()
          setAppointments(data || [])
        }
      } catch (error) {
        console.error('Error fetching appointments:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAppointments()
  }, [selectedClientId])

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getContactName = (contact: Appointment['contacts']) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    }
    return contact.phone || contact.email || 'Unknown'
  }

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
          <p className="text-muted-foreground">Select a client to view appointments</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
        <p className="text-muted-foreground">
          {selectedClient ? `Appointments for ${selectedClient.name}` : 'View and manage all booked appointments'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-400">{stats.confirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{stats.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
          <CardDescription>
            {appointments.length === 0 ? 'No appointments yet' : `${appointments.length} appointments`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No appointments have been booked yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Appointments will appear here when contacts book through conversations.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/contacts/${appointment.contacts.id}`}
                          className="font-medium text-foreground hover:text-cyan-400 transition-colors"
                        >
                          {getContactName(appointment.contacts)}
                        </Link>
                        <Badge variant={STATUS_STYLES[appointment.status]?.variant || 'secondary'}>
                          {STATUS_STYLES[appointment.status]?.label || appointment.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(appointment.start_time)} at {formatTime(appointment.start_time)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Workflow className="w-3.5 h-3.5" />
                          {appointment.workflows.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  {appointment.calendar_event_id && (
                    <div className="text-xs text-muted-foreground">
                      Synced to calendar
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
