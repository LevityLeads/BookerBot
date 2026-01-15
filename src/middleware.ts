// Auth middleware disabled for now - can be re-enabled later
// import { type NextRequest } from 'next/server'
// import { updateSession } from '@/lib/supabase/middleware'

// export async function middleware(request: NextRequest) {
//   return await updateSession(request)
// }

export const config = {
  matcher: [],
}
