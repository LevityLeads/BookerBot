import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  Clock,
  User,
  Building2,
} from 'lucide-react'
import { Contact, Workflow, Client, Message, Appointment } from '@/types/database'

type ContactWithDetails = Contact & {
  workflows: Workflow & {
    clients: Client
  }
  messages: Message[]
  appointments: Appointment[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-secondary text-secondary-foreground',
  contacted: 'bg-blue-500/20 text-blue-400',
  in_conversation: 'bg-yellow-500/20 text-yellow-400',
  qualified: 'bg-purple-500/20 text-purple-400',
  booked: 'bg-green-500/20 text-green-400',
  opted_out: 'bg-red-500/20 text-red-400',
  unresponsive: 'bg-orange-500/20 text-orange-400',
  handed_off: 'bg-pink-500/20 text-pink-400',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  in_conversation: 'In Conversation',
  qualified: 'Qualified',
  booked: 'Booked',
  opted_out: 'Opted Out',
  unresponsive: 'Unresponsive',
  handed_off: 'Handed Off',
}

export default async function ContactDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: contact, error } = await supabase
    .from('contacts')
    .select(`
      *,
      workflows(
        *,
        clients(*)
      ),
      messages(
        id,
        direction,
        channel,
        content,
        status,
        ai_generated,
        created_at
      ),
      appointments(
        id,
        start_time,
        end_time,
        status,
        notes,
        created_at
      )
    `)
    .eq('id', params.id)
    .order('created_at', { foreignTable: 'messages', ascending: true })
    .single()

  if (error || !contact) {
    notFound()
  }

  const typedContact = contact as unknown as ContactWithDetails
  const contactName = `${typedContact.first_name || ''} ${typedContact.last_name || ''}`.trim() || 'Unknown Contact'

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/contacts"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-foreground">{contactName}</h1>
              <Badge className={STATUS_COLORS[typedContact.status]}>
                {STATUS_LABELS[typedContact.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {typedContact.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  {typedContact.phone}
                </span>
              )}
              {typedContact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {typedContact.email}
                </span>
              )}
            </div>
          </div>
          <Link href={`/contacts/${params.id}/edit`}>
            <Button variant="outline">
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/workflows/${typedContact.workflows.id}`}
              className="font-medium hover:underline text-foreground"
            >
              {typedContact.workflows.name}
            </Link>
            <p className="text-sm text-muted-foreground">{typedContact.workflows.clients.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Follow-ups</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{typedContact.follow_ups_sent}</p>
            <p className="text-sm text-muted-foreground">
              of {typedContact.workflows.follow_up_count} max
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-foreground">
              {typedContact.last_message_at
                ? new Date(typedContact.last_message_at).toLocaleDateString()
                : 'No messages yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              Created {new Date(typedContact.created_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="conversation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversation" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Conversation ({typedContact.messages.length})
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Appointments ({typedContact.appointments.length})
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversation">
          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
              <CardDescription>All messages with this contact</CardDescription>
            </CardHeader>
            <CardContent>
              {typedContact.messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                  <p>No messages yet</p>
                  <p className="text-sm">Messages will appear here once the workflow starts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {typedContact.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          message.direction === 'outbound'
                            ? 'bg-cyan-600 text-white'
                            : 'bg-secondary text-foreground'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div
                          className={`flex items-center gap-2 mt-1 text-xs ${
                            message.direction === 'outbound' ? 'text-cyan-200' : 'text-muted-foreground'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {new Date(message.created_at).toLocaleString()}
                          {message.ai_generated && (
                            <Badge variant="outline" className="text-xs py-0 px-1">
                              AI
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle>Appointments</CardTitle>
              <CardDescription>Scheduled and past appointments</CardDescription>
            </CardHeader>
            <CardContent>
              {typedContact.appointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                  <p>No appointments yet</p>
                  <p className="text-sm">Appointments will appear here once booked</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {typedContact.appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-foreground">
                          {new Date(appointment.start_time).toLocaleDateString()} at{' '}
                          {new Date(appointment.start_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Duration:{' '}
                          {Math.round(
                            (new Date(appointment.end_time).getTime() -
                              new Date(appointment.start_time).getTime()) /
                              60000
                          )}{' '}
                          minutes
                        </div>
                        {appointment.notes && (
                          <div className="text-sm text-muted-foreground mt-1">{appointment.notes}</div>
                        )}
                      </div>
                      <Badge
                        className={
                          appointment.status === 'confirmed'
                            ? 'bg-green-500/20 text-green-400'
                            : appointment.status === 'completed'
                            ? 'bg-blue-500/20 text-blue-400'
                            : appointment.status === 'cancelled'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-orange-500/20 text-orange-400'
                        }
                      >
                        {appointment.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
              <CardDescription>All information about this contact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Contact Information</h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">First Name</dt>
                      <dd className="font-medium text-foreground">{typedContact.first_name || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Last Name</dt>
                      <dd className="font-medium text-foreground">{typedContact.last_name || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd className="font-medium text-foreground">{typedContact.phone || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="font-medium text-foreground">{typedContact.email || '-'}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Workflow Details</h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Workflow</dt>
                      <dd className="font-medium text-foreground">{typedContact.workflows.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Client</dt>
                      <dd className="font-medium text-foreground">{typedContact.workflows.clients.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Channel</dt>
                      <dd className="font-medium text-foreground capitalize">{typedContact.workflows.channel}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>
                        <Badge className={STATUS_COLORS[typedContact.status]}>
                          {STATUS_LABELS[typedContact.status]}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {typedContact.opted_out && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <Building2 className="w-5 h-5" />
                    <span className="font-medium">Contact has opted out</span>
                  </div>
                  {typedContact.opted_out_at && (
                    <p className="text-sm text-red-400/80 mt-1">
                      Opted out on {new Date(typedContact.opted_out_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {Object.keys(typedContact.custom_fields as object || {}).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Custom Fields</h3>
                  <dl className="space-y-2">
                    {Object.entries(typedContact.custom_fields as Record<string, unknown>).map(
                      ([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <dt className="text-muted-foreground">{key}</dt>
                          <dd className="font-medium text-foreground">{String(value)}</dd>
                        </div>
                      )
                    )}
                  </dl>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
