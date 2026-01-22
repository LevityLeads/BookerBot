import { Sidebar } from '@/components/sidebar'
import { ClientProvider } from '@/contexts/client-context'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth disabled for now - can be re-enabled later
  // const supabase = createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { redirect('/login') }

  return (
    <ClientProvider>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </ClientProvider>
  )
}
