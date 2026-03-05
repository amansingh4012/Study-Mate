import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export function ProtectedRoute({ children }) {
  const { session, loading, user } = useAuth()
  const [banned, setBanned] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user) { setChecking(false); return }
    supabase.from('profiles').select('is_banned').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.is_banned) setBanned(true)
        setChecking(false)
      })
  }, [user?.id])

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-cream text-lg font-body">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (banned) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-heading text-2xl text-red-400 font-bold mb-2">Account Suspended</h1>
          <p className="text-muted">Your account has been suspended. Contact support if you believe this is an error.</p>
        </div>
      </div>
    )
  }

  return children
}

export function AdminRoute({ children }) {
  const { user, session, loading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!user) { setChecking(false); return }

    async function checkAdmin() {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      console.log('Admin check:', { data, error, userId: user.id })

      if (data?.is_admin) {
        setIsAdmin(true)
      }
      setChecking(false)
    }

    checkAdmin()
  }, [user?.id, loading])

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-cream text-lg font-body">Loading...</div>
      </div>
    )
  }

  if (!session || !isAdmin) {
    return <Navigate to="/home" replace />
  }

  return children
}
