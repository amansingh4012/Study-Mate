import { createContext, useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // Log auth events for debugging
        if (event === 'SIGNED_IN') {
          console.log('Auth: User signed in')
        } else if (event === 'SIGNED_OUT') {
          console.log('Auth: User signed out')
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Auth: Token refreshed')
        } else if (event === 'USER_UPDATED') {
          console.log('Auth: User updated')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error.message)
    }
    setLoading(false)
  }

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signOut,
  }), [user?.id, session?.access_token, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
