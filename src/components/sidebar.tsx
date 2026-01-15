'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  Workflow,
  Users,
  Calendar,
  BarChart3,
  LogOut,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { User } from '@supabase/supabase-js'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Building2 },
  { name: 'Workflows', href: '/workflows', icon: Workflow },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Appointments', href: '/appointments', icon: Calendar },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
]

interface SidebarProps {
  user?: User | null
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col w-64 bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="w-8 h-8 text-primary" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 4L4 10V22L16 28L28 22V10L16 4Z" stroke="currentColor" strokeWidth="2" fill="none"/>
            <path d="M16 4L16 28" stroke="currentColor" strokeWidth="2"/>
            <path d="M4 10L28 22" stroke="currentColor" strokeWidth="2"/>
            <path d="M28 10L4 22" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-primary">Levity</span>
            <span className="text-lg font-bold text-foreground -mt-1">BookerBot</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <item.icon className={cn('w-5 h-5 mr-3', isActive && 'text-primary')} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.email || 'Admin'}
            </p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" className="flex-1 justify-start text-muted-foreground hover:text-foreground" asChild>
            <Link href="/settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Link>
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
