'use client'

import { useClientContext } from '@/contexts/client-context'
import { cn } from '@/lib/utils'
import { Building2, ChevronDown, Check, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ClientSelector() {
  const { clients, selectedClient, setSelectedClientId, isLoading } = useClientContext()
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="px-4 py-3">
        <button
          onClick={() => router.push('/clients')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-dashed border-border/50 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all duration-300 group"
        >
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <Plus className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Add your first client
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
              'bg-white/5 border border-border/50',
              'hover:bg-cyan-500/5 hover:border-cyan-500/30',
              'focus:outline-none focus:ring-2 focus:ring-cyan-500/20',
              'transition-all duration-300 group'
            )}
          >
            {/* Client icon */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-cyan-400" />
            </div>

            {/* Client info */}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-foreground truncate">
                {selectedClient?.name || 'Select client'}
              </p>
              {selectedClient?.brand_name && selectedClient.brand_name !== selectedClient.name && (
                <p className="text-xs text-muted-foreground truncate">
                  {selectedClient.brand_name}
                </p>
              )}
            </div>

            {/* Chevron */}
            <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-cyan-400 transition-colors flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-[calc(var(--radix-dropdown-menu-trigger-width))] bg-card border-border/50"
          sideOffset={4}
        >
          {clients.map((client) => (
            <DropdownMenuItem
              key={client.id}
              onClick={() => setSelectedClientId(client.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 cursor-pointer',
                'focus:bg-cyan-500/10 focus:text-foreground',
                selectedClient?.id === client.id && 'bg-cyan-500/10'
              )}
            >
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-cyan-400">
                  {client.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{client.name}</p>
                {client.brand_name && client.brand_name !== client.name && (
                  <p className="text-xs text-muted-foreground truncate">{client.brand_name}</p>
                )}
              </div>
              {selectedClient?.id === client.id && (
                <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator className="bg-border/50" />

          <DropdownMenuItem
            onClick={() => router.push('/clients')}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer focus:bg-white/5"
          >
            <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center">
              <Plus className="w-3 h-3 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Manage clients</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
