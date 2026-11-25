import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'

export function useAuth() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // First, get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        setUserEmail(session.user.email ?? null)
      } else {
        router.push('/login')
      }
      setReady(true)
    })

    // Then listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      } else if (session?.user) {
        setUserId(session.user.id)
        setUserEmail(session.user.email ?? null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { userId, userEmail, ready }
}
