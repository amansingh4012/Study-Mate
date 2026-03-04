import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isProfileIncomplete } from '../lib/profileCheck'
import { Loader2 } from 'lucide-react'

/**
 * Handles Supabase auth redirects:
 * - Email confirmation (token_hash + type in URL)
 * - PKCE code exchange (code in URL)
 * - Magic link / OAuth callbacks
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const url = new URL(window.location.href)
        const params = url.searchParams

        // Handle PKCE flow: exchange code for session
        const code = params.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('Code exchange error:', error.message)
            setError('Email confirmation failed. Please try logging in or request a new confirmation email.')
            setTimeout(() => navigate('/login'), 3000)
            return
          }
          // Session established — check if profile is complete
          const { data: { user } } = await supabase.auth.getUser()
          if (user && await isProfileIncomplete(user.id)) {
            // Profile incomplete — go to onboarding instead
            navigate('/onboarding', { replace: true })
          } else {
            navigate('/home', { replace: true })
          }
          return
        }

        // Handle token_hash flow (newer Supabase email templates)
        const tokenHash = params.get('token_hash')
        const type = params.get('type')
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type,
          })
          if (error) {
            console.error('Token verification error:', error.message)
            setError('Email confirmation failed. Please try logging in or request a new confirmation email.')
            setTimeout(() => navigate('/login'), 3000)
            return
          }
          // Session confirmed — check if profile is complete
          const { data: { user } } = await supabase.auth.getUser()
          if (user && await isProfileIncomplete(user.id)) {
            // Profile incomplete — go to onboarding instead
            navigate('/onboarding', { replace: true })
          } else {
            navigate('/home', { replace: true })
          }
          return
        }

        // Handle hash fragment (implicit flow) — #access_token=...
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        if (accessToken) {
          // The Supabase client auto-detects this via detectSessionInUrl
          // Just wait a moment for onAuthStateChange to fire
          await new Promise(r => setTimeout(r, 1000))
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            if (await isProfileIncomplete(session.user.id)) {
              navigate('/onboarding', { replace: true })
            } else {
              navigate('/home', { replace: true })
            }
            return
          }
        }

        // Handle error in URL
        const errorDesc = params.get('error_description') || hashParams?.get('error_description')
        if (errorDesc) {
          setError(decodeURIComponent(errorDesc))
          setTimeout(() => navigate('/login'), 3000)
          return
        }

        // No recognizable tokens — redirect to home
        navigate('/home', { replace: true })
      } catch (err) {
        console.error('Auth callback error:', err)
        setError('Something went wrong during authentication.')
        setTimeout(() => navigate('/login'), 3000)
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <div className="space-y-4">
            <p className="text-[#E57373] text-lg font-body">{error}</p>
            <p className="text-muted text-sm">Redirecting to login...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="text-accent animate-spin" />
            <p className="text-cream text-lg font-body">Confirming your account...</p>
          </div>
        )}
      </div>
    </div>
  )
}
