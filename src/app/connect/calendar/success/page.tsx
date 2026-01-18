/**
 * Calendar Connection Success Page
 * /connect/calendar/success?client=ClientName
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ client?: string }>
}

export default async function CalendarSuccessPage({ searchParams }: PageProps) {
  const { client } = await searchParams
  const clientName = client || 'Your business'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-cyan-950/20">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <CardTitle className="text-2xl">You&apos;re all set!</CardTitle>
          <CardDescription className="text-base">
            Your calendar is now connected to {clientName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            BookerBot can now check your availability and book appointments automatically.
          </p>
          <p className="text-sm text-muted-foreground">
            You can close this tab.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
