import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Pencil, Calendar, Clock, Phone, CheckCircle2, LinkIcon } from 'lucide-react'
import { BusinessHours, Client, Workflow, CalendarConnection } from '@/types/database'

interface ClientPageProps {
  params: { id: string }
}

export default async function ClientPage({ params }: ClientPageProps) {
  const supabase = createClient()

  const { data: clientData, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !clientData) {
    notFound()
  }

  const client = clientData as Client

  const { data: workflowsData } = await supabase
    .from('workflows')
    .select('*')
    .eq('client_id', params.id)
    .order('created_at', { ascending: false })

  const workflows = (workflowsData || []) as Workflow[]
  const workflowIds = workflows.map(w => w.id)

  // Fetch calendar connection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: calendarData } = await (supabase as any)
    .from('calendar_connections')
    .select('*')
    .eq('client_id', params.id)
    .single() as { data: CalendarConnection | null }

  const calendarConnection = calendarData

  const statsResult = workflowIds.length > 0
    ? await supabase
        .from('contacts')
        .select('status')
        .in('workflow_id', workflowIds)
    : { data: [] as { status: string }[] }

  const stats = statsResult.data || []

  const contactStats = {
    total: stats.length,
    booked: stats.filter(s => s.status === 'booked').length,
    inConversation: stats.filter(s => s.status === 'in_conversation').length,
  }

  const businessHours = client.business_hours as BusinessHours

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Clients
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
          <p className="text-muted-foreground">{client.brand_name}</p>
        </div>
        <Button asChild>
          <Link href={`/clients/${client.id}/edit`}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit Client
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{contactStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Booked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{contactStats.booked}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">{contactStats.inConversation}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar Integration Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Calendar Integration
            </CardTitle>
            <CardDescription>
              Connect a calendar to enable automatic appointment booking
            </CardDescription>
          </CardHeader>
          <CardContent>
            {calendarConnection ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {calendarConnection.provider === 'google' ? 'Google Calendar' : 'Calendar'} Connected
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Calendar ID: {calendarConnection.calendar_id || 'Primary'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/connect/calendar/${client.id}`} target="_blank">
                      Reconnect
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <LinkIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">No calendar connected</p>
                    <p className="text-sm text-muted-foreground">
                      Share the link below with your client to connect their calendar
                    </p>
                  </div>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/connect/calendar/${client.id}`} target="_blank">
                    Connect Calendar
                  </Link>
                </Button>
              </div>
            )}
            <Separator className="my-4" />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Shareable link for this client:</p>
              <code className="block p-3 bg-muted rounded-lg text-sm text-foreground break-all">
                {process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com'}/connect/calendar/{client.id}
              </code>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Timezone</p>
                <p className="font-medium text-foreground">{client.timezone}</p>
              </div>
            </div>

            {client.twilio_phone_number && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Twilio Phone</p>
                  <p className="font-medium text-foreground">{client.twilio_phone_number}</p>
                </div>
              </div>
            )}

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <p className="font-medium text-foreground">Business Hours</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(businessHours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between">
                    <span className="capitalize text-muted-foreground">{day}</span>
                    <span className="text-foreground">
                      {hours ? `${hours.start} - ${hours.end}` : 'Closed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Workflows</CardTitle>
              <CardDescription>{workflows?.length || 0} workflows</CardDescription>
            </div>
            <Button size="sm" asChild>
              <Link href={`/workflows?client=${client.id}`}>View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!workflows || workflows.length === 0 ? (
              <p className="text-muted-foreground text-sm">No workflows yet</p>
            ) : (
              <div className="space-y-3">
                {workflows.slice(0, 5).map((workflow) => (
                  <div
                    key={workflow.id}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border/50"
                  >
                    <div>
                      <p className="font-medium text-foreground">{workflow.name}</p>
                      <p className="text-sm text-muted-foreground">{workflow.channel}</p>
                    </div>
                    <Badge
                      variant={workflow.status === 'active' ? 'success' : 'secondary'}
                    >
                      {workflow.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
