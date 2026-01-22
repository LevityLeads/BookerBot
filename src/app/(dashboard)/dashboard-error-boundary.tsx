'use client'

import { ErrorBoundary } from '@/components/error-boundary'
import { ReactNode } from 'react'

export function DashboardErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}
