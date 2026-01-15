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
  pending: 'bg-gray-100 text-gray-800',
  contacted: 'bg-blue-100 text-blue-800',
  in_conversation: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-purple-100 text-purple-800',
  booked: 'bg-green-100 text-green-800',
  opted_out: 'bg-red-100 text-red-800',
  unresponsive: 'bg-orange-100 text-orange-800',
  handed_off: 'bg-pink-100 text-pink-800',
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
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{contactName}</h1>
              <Badge className={STATUS_COLORS[typedContact.status]}>
                {STATUS_LABELS[typedContact.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
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
            <CardTitle className="text-sm font-medium text-gray-500">Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/workflows/${typedContact.workflows.id}`}
              className="font-medium hover:underline"
            >
              {typedContact.workflows.name}
            </Link>
            <p className="text-sm text-gray-500">{typedContact.workflows.clients.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Follow-ups</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{typedContact.follow_ups_sent}</p>
            <p className="text-sm text-gray-500">
              of {typedContact.workflows.follow_up_count} max
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Last Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {typedContact.last_message_at
                ? new Date(typedContact.last_message_at).toLocaleDateString()
                : 'No messages yet'}
            </p>
            <p className="text-sm text-gray-500">
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
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
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
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div
                          className={`flex items-center gap-2 mt-1 text-xs ${
                            message.direction === 'outbound' ? 'text-blue-200' : 'text-gray-500'
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
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p>No appointments yet</p>
                  <p className="text-sm">Appointments will appear here once booked</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {typedContact.appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          {new Date(appointment.start_time).toLocaleDateString()} at{' '}
                          {new Date(appointment.start_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-sm text-gray-500">
                          Duration:{' '}
                          {Math.round(
                            (new Date(appointment.end_time).getTime() -
                              new Date(appointment.start_time).getTime()) /
                              60000
                          )}{' '}
                          minutes
                        </div>
                        {appointment.notes && (
                          <div className="text-sm text-gray-500 mt-1">{appointment.notes}</div>
                        )}
                      </div>
                      <Badge
                        className={
                          appointment.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : appointment.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : appointment.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-orange-100 text-orange-800'
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
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">First Name</dt>
                      <dd className="font-medium">{typedContact.first_name || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Last Name</dt>
                      <dd className="font-medium">{typedContact.last_name || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Phone</dt>
                      <dd className="font-medium">{typedContact.phone || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Email</dt>
                      <dd className="font-medium">{typedContact.email || '-'}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Workflow Details</h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Workflow</dt>
                      <dd className="font-medium">{typedContact.workflows.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Client</dt>
                      <dd className="font-medium">{typedContact.workflows.clients.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Channel</dt>
                      <dd className="font-medium capitalize">{typedContact.workflows.channel}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Status</dt>
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
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <Building2 className="w-5 h-5" />
                    <span className="font-medium">Contact has opted out</span>
                  </div>
                  {typedContact.opted_out_at && (
                    <p className="text-sm text-red-600 mt-1">
                      Opted out on {new Date(typedContact.opted_out_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {Object.keys(typedContact.custom_fields as object || {}).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Custom Fields</h3>
                  <dl className="space-y-2">
                    {Object.entries(typedContact.custom_fields as Record<string, unknown>).map(
                      ([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <dt className="text-gray-500">{key}</dt>
                          <dd className="font-medium">{String(value)}</dd>
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
