/**
 * Public Calendar Connect Page
 * /connect/calendar/[clientId]
 *
 * Simple page for clients to connect their Google Calendar
 */

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarIcon } from 'lucide-react'
import { ConnectButton } from './connect-button'

interface PageProps {
  params: Promise<{ clientId: string }>
}

type ClientData = {
  id: string
  name: string
  brand_name: string | null
  brand_logo_url: string | null
}

type ConnectionData = {
  id: string
  provider: string
  calendar_id: string | null
}

export default async function ConnectCalendarPage({ params }: PageProps) {
  const { clientId } = await params
  const supabase = await createClient()

  // Fetch client info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client, error } = await (supabase as any)
    .from('clients')
    .select('id, name, brand_name, brand_logo_url')
    .eq('id', clientId)
    .single() as { data: ClientData | null; error: Error | null }

  if (error || !client) {
    notFound()
  }

  // Check if already connected
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingConnection } = await (supabase as any)
    .from('calendar_connections')
    .select('id, provider, calendar_id')
    .eq('client_id', clientId)
    .single() as { data: ConnectionData | null }

  const displayName = client.brand_name || client.name

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-cyan-950/20">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {client.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.brand_logo_url}
              alt={displayName}
              className="h-12 mx-auto mb-4 object-contain"
            />
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
              <CalendarIcon className="w-8 h-8 text-navy-900" />
            </div>
          )}
          <CardTitle className="text-2xl">Connect Your Calendar</CardTitle>
          <CardDescription className="text-base">
            {displayName} uses BookerBot to schedule appointments.
            Connect your calendar to enable automatic booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {existingConnection ? (
            <div className="text-center space-y-4">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <p className="text-green-400 font-medium">
                  Calendar already connected
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your {existingConnection.provider === 'google' ? 'Google Calendar' : 'calendar'} is connected and ready.
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Want to connect a different account?
              </div>
              <ConnectButton clientId={clientId} variant="outline">
                Reconnect Google Calendar
              </ConnectButton>
            </div>
          ) : (
            <ConnectButton clientId={clientId} size="lg" className="w-full">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </ConnectButton>
          )}

          <p className="text-xs text-center text-muted-foreground pt-4">
            We only access your calendar to check availability and create appointments.
            We never read your existing events&apos; details.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
