'use client'

import { useEffect, useState, useCallback } from 'react'
import { useClientContext } from '@/contexts/client-context'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Calendar,
  Clock,
  Loader2,
  Workflow,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  UserX,
  FileText,
  X,
} from 'lucide-react'
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

const STATUS_STYLES: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string; color: string }> = {
  confirmed: { variant: 'default', label: 'Confirmed', color: 'text-cyan-400' },
  completed: { variant: 'outline', label: 'Completed', color: 'text-green-400' },
  cancelled: { variant: 'destructive', label: 'Cancelled', color: 'text-red-400' },
  no_show: { variant: 'secondary', label: 'No Show', color: 'text-orange-400' },
}

const STATUSES = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
]

export function AppointmentsPageContent() {
  const { selectedClientId, selectedClient, isLoading: clientLoading } = useClientContext()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Notes dialog state
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; appointment: Appointment | null }>({
    open: false,
    appointment: null,
  })
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Get filter values from URL
  const selectedStatus = searchParams.get('status') || ''
  const startAfter = searchParams.get('start_after') || ''
  const startBefore = searchParams.get('start_before') || ''

  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([name, value]) => {
        if (value === null || value === '') {
          params.delete(name)
        } else {
          params.set(name, value)
        }
      })
      return params.toString()
    },
    [searchParams]
  )

  const updateFilter = (key: string, value: string | null) => {
    const queryString = createQueryString({ [key]: value })
    router.push(pathname + (queryString ? `?${queryString}` : ''))
  }

  const clearFilters = () => {
    router.push(pathname)
  }

  const hasFilters = selectedStatus || startAfter || startBefore

  useEffect(() => {
    async function fetchAppointments() {
      if (!selectedClientId) {
        setAppointments([])
        setTotal(0)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('client_id', selectedClientId)
        if (selectedStatus) params.set('status', selectedStatus)
        if (startAfter) params.set('start_after', startAfter)
        if (startBefore) params.set('start_before', startBefore)

        const response = await fetch(`/api/appointments?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setAppointments(data.appointments || data || [])
          setTotal(data.total || (data.appointments || data || []).length)
        }
      } catch (error) {
        console.error('Error fetching appointments:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAppointments()
  }, [selectedClientId, selectedStatus, startAfter, startBefore])

  const updateStatus = async (appointmentId: string, newStatus: string) => {
    setUpdatingId(appointmentId)
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        setAppointments(prev =>
          prev.map(apt =>
            apt.id === appointmentId
              ? { ...apt, status: newStatus as Appointment['status'] }
              : apt
          )
        )
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  const openNotesDialog = (appointment: Appointment) => {
    setNotesValue(appointment.notes || '')
    setNotesDialog({ open: true, appointment })
  }

  const saveNotes = async () => {
    if (!notesDialog.appointment) return

    setSavingNotes(true)
    try {
      const response = await fetch(`/api/appointments/${notesDialog.appointment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesValue }),
      })

      if (response.ok) {
        setAppointments(prev =>
          prev.map(apt =>
            apt.id === notesDialog.appointment!.id
              ? { ...apt, notes: notesValue }
              : apt
          )
        )
        setNotesDialog({ open: false, appointment: null })
      }
    } catch (error) {
      console.error('Error saving notes:', error)
    } finally {
      setSavingNotes(false)
    }
  }

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    noShow: appointments.filter(a => a.status === 'no_show').length,
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
          {selectedClient ? `${total} appointments for ${selectedClient.name}` : 'View and manage all booked appointments'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">No Show</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-400">{stats.noShow}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-[160px]">
            <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
            <Select
              value={selectedStatus || 'all'}
              onValueChange={(value) => updateFilter('status', value === 'all' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[160px]">
            <label className="text-sm font-medium text-foreground mb-1 block">From date</label>
            <Input
              type="date"
              value={startAfter}
              onChange={(e) => updateFilter('start_after', e.target.value || null)}
            />
          </div>

          <div className="w-[160px]">
            <label className="text-sm font-medium text-foreground mb-1 block">To date</label>
            <Input
              type="date"
              value={startBefore}
              onChange={(e) => updateFilter('start_before', e.target.value || null)}
            />
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
          <CardDescription>
            {isLoading ? 'Loading...' : appointments.length === 0 ? 'No appointments found' : `${appointments.length} appointments`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters ? 'No appointments match your filters.' : 'No appointments have been booked yet.'}
              </p>
              {!hasFilters && (
                <p className="text-sm text-muted-foreground mt-1">
                  Appointments will appear here when contacts book through conversations.
                </p>
              )}
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
                        <Badge
                          variant={STATUS_STYLES[appointment.status]?.variant || 'secondary'}
                          className={STATUS_STYLES[appointment.status]?.color}
                        >
                          {STATUS_STYLES[appointment.status]?.label || appointment.status}
                        </Badge>
                        {appointment.notes && (
                          <span title="Has notes">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          </span>
                        )}
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

                  <div className="flex items-center gap-2">
                    {appointment.calendar_event_id && (
                      <div className="text-xs text-muted-foreground mr-2">
                        Synced
                      </div>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={updatingId === appointment.id}>
                          {updatingId === appointment.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="w-4 h-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => updateStatus(appointment.id, 'completed')}
                          disabled={appointment.status === 'completed'}
                        >
                          <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                          Mark Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateStatus(appointment.id, 'no_show')}
                          disabled={appointment.status === 'no_show'}
                        >
                          <UserX className="w-4 h-4 mr-2 text-orange-400" />
                          Mark No Show
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateStatus(appointment.id, 'cancelled')}
                          disabled={appointment.status === 'cancelled'}
                        >
                          <XCircle className="w-4 h-4 mr-2 text-red-400" />
                          Cancel
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openNotesDialog(appointment)}>
                          <FileText className="w-4 h-4 mr-2" />
                          {appointment.notes ? 'Edit Notes' : 'Add Notes'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Dialog */}
      <Dialog open={notesDialog.open} onOpenChange={(open) => !open && setNotesDialog({ open: false, appointment: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Notes</DialogTitle>
            <DialogDescription>
              {notesDialog.appointment && (
                <>Notes for appointment with {getContactName(notesDialog.appointment.contacts)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="Add notes about this appointment..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialog({ open: false, appointment: null })}>
              Cancel
            </Button>
            <Button onClick={saveNotes} disabled={savingNotes}>
              {savingNotes ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Notes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
