'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface FollowUpButtonProps {
  contactId: string
  followUpsSent: number
  maxFollowUps: number
  canSendFollowUp: boolean
  ineligibilityReason?: string | null
}

export function FollowUpButton({
  contactId,
  followUpsSent,
  maxFollowUps,
  canSendFollowUp: initialCanSend,
  ineligibilityReason,
}: FollowUpButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [currentFollowUpsSent, setCurrentFollowUpsSent] = useState(followUpsSent)
  const [canSend, setCanSend] = useState(initialCanSend)

  const handleSendFollowUp = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}/follow-up`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResult({
          success: true,
          message: data.message || `Follow-up #${data.followUpNumber} sent!`,
        })
        setCurrentFollowUpsSent(data.followUpNumber)

        // Disable button if max reached
        if (data.followUpNumber >= maxFollowUps) {
          setCanSend(false)
        }
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to send follow-up',
        })
      }
    } catch {
      setResult({
        success: false,
        message: 'Network error - please try again',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const nextFollowUpNumber = currentFollowUpsSent + 1

  return (
    <div className="space-y-2">
      <Button
        onClick={handleSendFollowUp}
        disabled={!canSend || isLoading}
        variant={canSend ? 'default' : 'secondary'}
        size="sm"
        className="w-full"
        title={!canSend ? ineligibilityReason || 'Cannot send follow-up' : undefined}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : canSend ? (
          <>
            <Send className="w-4 h-4 mr-2" />
            Send Follow-up #{nextFollowUpNumber}
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4 mr-2" />
            {currentFollowUpsSent >= maxFollowUps ? 'Max Reached' : 'Unavailable'}
          </>
        )}
      </Button>

      {result && (
        <div
          className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${
            result.success
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {result.success ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}

      {!canSend && ineligibilityReason && !result && (
        <p className="text-xs text-muted-foreground">{ineligibilityReason}</p>
      )}
    </div>
  )
}
