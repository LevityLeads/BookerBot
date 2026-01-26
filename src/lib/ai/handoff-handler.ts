import { createServiceClient } from '@/lib/supabase/server'
import { Contact, Workflow, Client } from '@/types/database'
import { sendMessage, isTwilioConfigured } from '@/lib/twilio/client'

type ContactWithWorkflow = Contact & {
  workflows: Workflow & {
    clients: Client
  }
}

export class HandoffHandler {
  async escalate(
    contact: ContactWithWorkflow,
    reason: string
  ): Promise<void> {
    const supabase = createServiceClient()

    // 1. Update contact status to handed_off and clear follow-up timer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('contacts')
      .update({
        status: 'handed_off',
        next_follow_up_at: null // Clear follow-up since human is taking over
      })
      .eq('id', contact.id)

    // 2. Log the escalation (create a system message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      contact_id: contact.id,
      direction: 'outbound',
      channel: contact.workflows.channel,
      content: `[SYSTEM] Escalated to human: ${reason}`,
      status: 'sent',
      ai_generated: false
    })

    // 3. Send notification to admin (if Twilio is configured)
    await this.notifyAdmin(contact, reason)

    console.log(`Contact ${contact.id} escalated: ${reason}`)
  }

  private async notifyAdmin(
    contact: ContactWithWorkflow,
    reason: string
  ): Promise<void> {
    const adminPhone = process.env.ADMIN_PHONE_NUMBER
    const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'

    // Build concise message for SMS (keep under 160 chars if possible)
    const shortMessage = `🚨 Escalation: ${contactName} (${contact.workflows.clients.name})\n${reason}\n${appUrl}/contacts/${contact.id}`

    // Full message for logging
    const fullMessage = `[BookerBot Escalation]
Contact: ${contactName}
Phone: ${contact.phone || 'N/A'}
Workflow: ${contact.workflows.name}
Client: ${contact.workflows.clients.name}

Reason: ${reason}

Review: ${appUrl}/contacts/${contact.id}`

    // Always log the notification
    console.log('=== ADMIN NOTIFICATION ===')
    console.log(`Admin phone: ${adminPhone || 'NOT CONFIGURED'}`)
    console.log(fullMessage)
    console.log('========================')

    // Send SMS if configured
    if (adminPhone && isTwilioConfigured()) {
      try {
        const result = await sendMessage({
          to: adminPhone,
          body: shortMessage,
          channel: 'sms'
        })

        if (result.success) {
          console.log(`[Escalation] Admin notification sent successfully (SID: ${result.sid})`)
        } else {
          console.error(`[Escalation] Failed to send admin notification: ${result.error}`)
        }
      } catch (error) {
        // Don't let notification failure break the escalation flow
        console.error('[Escalation] Error sending admin notification:', error)
      }
    } else if (!adminPhone) {
      console.warn('[Escalation] ADMIN_PHONE_NUMBER not configured - SMS notification skipped')
    } else {
      console.warn('[Escalation] Twilio not configured - SMS notification skipped')
    }
  }

  // Generate a graceful handoff message to send to the contact
  generateHandoffMessage(reason: string): string {
    const messages: Record<string, string> = {
      'Contact requested human assistance':
        "I'll have someone from our team reach out to you shortly. They'll be able to help you better!",

      'Multiple unresolved complex queries':
        "I want to make sure you get the best help possible. Let me have one of our team members follow up with you.",

      'Conversation exceeded turn limit without resolution':
        "Thanks for your patience! I'm going to have a team member reach out to assist you directly.",

      'Contact expressed frustration':
        "I apologize for any frustration. Let me have someone from our team reach out to you right away to help resolve this.",

      'Complex query requiring human expertise':
        "That's a great question! I'd like to have one of our specialists get back to you with more details.",
    }

    // Find matching message or use default
    for (const [key, msg] of Object.entries(messages)) {
      if (reason.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(reason.toLowerCase())) {
        return msg
      }
    }

    // Default message
    return "I'm connecting you with a team member who can assist you further. You'll hear from them shortly!"
  }

  // Check if a contact should be auto-escalated based on patterns
  shouldAutoEscalate(contact: Contact): { should: boolean; reason?: string } {
    // Already handed off
    if (contact.status === 'handed_off') {
      return { should: false }
    }

    // Opted out - don't escalate
    if (contact.opted_out || contact.status === 'opted_out') {
      return { should: false }
    }

    // Parse conversation context if exists
    const context = contact.conversation_context as Record<string, unknown> | null
    if (context) {
      const state = context.state as Record<string, unknown> | undefined

      // Too many escalation attempts
      if (state && typeof state.escalationAttempts === 'number' && state.escalationAttempts >= 2) {
        return {
          should: true,
          reason: 'Multiple unresolved escalation attempts'
        }
      }

      // Conversation going too long
      if (state && typeof state.turnCount === 'number' && state.turnCount > 20) {
        return {
          should: true,
          reason: 'Extended conversation without resolution'
        }
      }
    }

    return { should: false }
  }
}

// Export singleton instance
export const handoffHandler = new HandoffHandler()
