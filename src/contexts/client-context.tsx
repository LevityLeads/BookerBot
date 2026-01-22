'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Client } from '@/types/database'

const STORAGE_KEY = 'bookerbot_selected_client'

type ClientContextType = {
  clients: Client[]
  selectedClientId: string | null
  selectedClient: Client | null
  isLoading: boolean
  setSelectedClientId: (id: string | null) => void
  refreshClients: () => Promise<void>
}

const ClientContext = createContext<ClientContextType | undefined>(undefined)

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // Fetch clients from database
  const fetchClients = useCallback(async (): Promise<Client[]> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Failed to fetch clients:', error)
      return []
    }

    const clientsList = (data || []) as Client[]
    setClients(clientsList)
    return clientsList
  }, [])

  // Initialize: load from localStorage and fetch clients
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)

      // Load saved selection from localStorage
      const saved = localStorage.getItem(STORAGE_KEY)

      // Fetch clients
      const fetchedClients = await fetchClients()

      // Validate saved selection exists in fetched clients
      if (saved && fetchedClients.some(c => c.id === saved)) {
        setSelectedClientIdState(saved)
      } else if (fetchedClients.length > 0) {
        // Auto-select first client if none saved or saved is invalid
        setSelectedClientIdState(fetchedClients[0].id)
        localStorage.setItem(STORAGE_KEY, fetchedClients[0].id)
      }

      setIsLoading(false)
      setIsInitialized(true)
    }

    init()
  }, [fetchClients])

  // Persist selection to localStorage
  const setSelectedClientId = useCallback((id: string | null) => {
    setSelectedClientIdState(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Refresh clients (e.g., after adding a new client)
  const refreshClients = useCallback(async () => {
    await fetchClients()
  }, [fetchClients])

  // Get the full selected client object
  const selectedClient = clients.find(c => c.id === selectedClientId) || null

  // Don't render children until initialized to prevent hydration mismatch
  if (!isInitialized) {
    return null
  }

  return (
    <ClientContext.Provider
      value={{
        clients,
        selectedClientId,
        selectedClient,
        isLoading,
        setSelectedClientId,
        refreshClients,
      }}
    >
      {children}
    </ClientContext.Provider>
  )
}

export function useClientContext() {
  const context = useContext(ClientContext)
  if (context === undefined) {
    throw new Error('useClientContext must be used within a ClientProvider')
  }
  return context
}

// Convenience hook for just the selected client ID
export function useSelectedClientId() {
  const { selectedClientId } = useClientContext()
  return selectedClientId
}

// Convenience hook for the full selected client
export function useSelectedClient() {
  const { selectedClient } = useClientContext()
  return selectedClient
}
