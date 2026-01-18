'use client'

import { Button, type ButtonProps } from '@/components/ui/button'

interface ConnectButtonProps extends Omit<ButtonProps, 'onClick'> {
  clientId: string
  children: React.ReactNode
}

export function ConnectButton({ clientId, children, ...props }: ConnectButtonProps) {
  const handleConnect = () => {
    // Redirect to Google OAuth initiation
    window.location.href = `/api/auth/google?clientId=${clientId}`
  }

  return (
    <Button onClick={handleConnect} {...props}>
      {children}
    </Button>
  )
}
