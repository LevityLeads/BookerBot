import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Pencil, MessageSquare, Mail, Users, CheckCircle, Phone } from 'lucide-react'
import { Client, Workflow, Contact } from '@/types/database'

interface WorkflowPageProps {
  params: { id: string }
}

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const supabase = createClient()

  const { data: workflowData, error } = await supabase
    .from('workflows')
    .select('*, clients(name, brand_name)')
    .eq('id', params.id)
    .single()

  if (error || !workflowData) {
    notFound()
  }

  const workflow = workflowData as Workflow & { clients: Pick<Client, 'name' | 'brand_name'> }

  const { data: contactsData } = await supabase
    .from('contacts')
    .select('status')
    .eq('workflow_id', params.id)

  const contacts = (contactsData || []) as Pick<Contact, 'status'>[]

  const contactStats = {
    total: contacts.length,
    booked: contacts.filter(c => c.status === 'booked').length,
    inConversation: contacts.filter(c => c.status === 'in_conversation').length,
    pending: contacts.filter(c => c.status === 'pending').length,
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/workflows"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Workflows
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-foreground">{workflow.name}</h1>
            <Badge
              variant={
                workflow.status === 'active'
                  ? 'success'
                  : workflow.status === 'paused'
                  ? 'secondary'
                  : 'outline'
              }
            >
              {workflow.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            <Link href={`/clients/${workflow.client_id}`} className="hover:underline">
              {workflow.clients?.name}
            </Link>
            {' - '}
            {workflow.channel.toUpperCase()}
          </p>
        </div>
        <Button asChild>
          <Link href={`/workflows/${workflow.id}/edit`}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit Workflow
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-3xl font-bold text-foreground">{contactStats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Booked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-3xl font-bold text-green-400">{contactStats.booked}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <span className="text-3xl font-bold text-blue-400">{contactStats.inConversation}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-yellow-400" />
              <span className="text-3xl font-bold text-yellow-400">{contactStats.pending}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Workflow Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Channel</p>
              <p className="font-medium text-foreground flex items-center gap-2">
                {workflow.channel === 'sms' && <MessageSquare className="w-4 h-4" />}
                {workflow.channel === 'whatsapp' && <Phone className="w-4 h-4" />}
                {workflow.channel === 'email' && <Mail className="w-4 h-4" />}
                {workflow.channel.toUpperCase()}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium text-foreground">
                {new Date(workflow.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium text-foreground">
                {new Date(workflow.updated_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Instructions</CardTitle>
            <CardDescription>Instructions for the AI assistant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">System Instructions</p>
              <pre className="text-sm bg-secondary/50 border border-border/50 p-4 rounded-lg whitespace-pre-wrap overflow-auto max-h-40 text-foreground">
                {workflow.instructions || 'No instructions configured.'}
              </pre>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Initial Message Template</p>
              <pre className="text-sm bg-secondary/50 border border-border/50 p-4 rounded-lg whitespace-pre-wrap overflow-auto max-h-40 text-foreground">
                {workflow.initial_message_template || 'No template configured.'}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
