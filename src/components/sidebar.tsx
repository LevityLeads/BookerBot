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
  Zap,
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
    <div className="flex flex-col w-72 bg-gradient-card border-r border-border/50 relative overflow-hidden">
      {/* Subtle glow effect at top */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="flex items-center h-20 px-6 border-b border-border/50 relative">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-glow">
              <Zap className="w-5 h-5 text-navy-900" />
            </div>
            <div className="absolute inset-0 rounded-xl bg-cyan-400/20 blur-xl" />
          </div>
          <div>
            <span className="text-lg font-bold text-foreground">Levity</span>
            <span className="text-lg font-bold gradient-text ml-1">BookerBot</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 relative overflow-hidden',
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 shadow-inner-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-400 rounded-r-full shadow-glow" />
              )}

              {/* Hover glow effect */}
              <div className={cn(
                'absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 transition-opacity duration-300',
                'group-hover:opacity-100'
              )} />

              <item.icon className={cn(
                'w-5 h-5 mr-3 transition-all duration-300',
                isActive ? 'text-cyan-400' : 'text-muted-foreground group-hover:text-cyan-400'
              )} />

              <span className="relative">{item.name}</span>

              {/* Active glow dot */}
              {isActive && (
                <div className="absolute right-4 w-2 h-2 rounded-full bg-cyan-400 shadow-glow animate-pulse" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Divider with gradient */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* User section */}
      <div className="p-4 space-y-4">
        <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/5 border border-border/50">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center">
              <span className="text-sm font-semibold gradient-text">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.email || 'Admin'}
            </p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-300"
            asChild
          >
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
              className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Bottom gradient glow */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-purple-500/5 to-transparent pointer-events-none" />
    </div>
  )
}
