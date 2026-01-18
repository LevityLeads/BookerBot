/**
 * Calendar Connection Error Page
 * /connect/calendar/error?reason=xxx
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface PageProps {
  searchParams: Promise<{ reason?: string }>
}

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  access_denied: {
    title: 'Access Denied',
    description: 'You chose not to grant calendar access. You can try again when you\'re ready.',
  },
  missing_params: {
    title: 'Something Went Wrong',
    description: 'The connection request was incomplete. Please try using the original link again.',
  },
  invalid_client: {
    title: 'Invalid Link',
    description: 'This calendar connection link is no longer valid. Please request a new link.',
  },
  no_calendars: {
    title: 'No Calendars Found',
    description: 'We couldn\'t find any calendars in your Google account. Please make sure you have at least one calendar.',
  },
  exchange_failed: {
    title: 'Connection Failed',
    description: 'We couldn\'t complete the connection to Google Calendar. Please try again.',
  },
  default: {
    title: 'Something Went Wrong',
    description: 'We couldn\'t connect your calendar. Please try again or contact support.',
  },
}

export default async function CalendarErrorPage({ searchParams }: PageProps) {
  const { reason } = await searchParams
  const errorInfo = ERROR_MESSAGES[reason || 'default'] || ERROR_MESSAGES.default

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-cyan-950/20">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <CardTitle className="text-2xl">{errorInfo.title}</CardTitle>
          <CardDescription className="text-base">
            {errorInfo.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <Button variant="outline" asChild>
            <Link href="javascript:history.back()">
              Go Back
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            If this problem persists, please contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
