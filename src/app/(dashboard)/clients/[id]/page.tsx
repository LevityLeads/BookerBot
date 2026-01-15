import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Pencil, Calendar, Clock, Phone } from 'lucide-react'
import { BusinessHours, Client, Workflow } from '@/types/database'

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
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Clients
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-gray-500">{client.brand_name}</p>
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
            <CardTitle className="text-sm font-medium text-gray-500">Total Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{contactStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Booked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{contactStats.booked}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">In Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{contactStats.inConversation}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Timezone</p>
                <p className="font-medium">{client.timezone}</p>
              </div>
            </div>

            {client.twilio_phone_number && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Twilio Phone</p>
                  <p className="font-medium">{client.twilio_phone_number}</p>
                </div>
              </div>
            )}

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <p className="font-medium">Business Hours</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(businessHours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between">
                    <span className="capitalize text-gray-500">{day}</span>
                    <span>
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
              <p className="text-gray-500 text-sm">No workflows yet</p>
            ) : (
              <div className="space-y-3">
                {workflows.slice(0, 5).map((workflow) => (
                  <div
                    key={workflow.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{workflow.name}</p>
                      <p className="text-sm text-gray-500">{workflow.channel}</p>
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
