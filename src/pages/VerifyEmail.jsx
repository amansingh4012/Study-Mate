import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MailCheck, Loader2, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function VerifyEmail() {
  const location = useLocation()
  const email = location.state?.email || ''

  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState('')

  const handleResend = async () => {
    if (!email) {
      setResendError('No email address available. Please sign up again.')
      return
    }

    setResendLoading(true)
    setResendError('')
    setResendSuccess(false)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      setResendSuccess(true)
    } catch (err) {
      setResendError(err.message || 'Failed to resend. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex">
      {/* Left Side - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      >
        <div>
          {/* Logo */}
          <div className="flex items-center">
            <span className="font-heading text-2xl text-cream font-bold">
              StudyMate
            </span>
            <span className="w-2 h-2 bg-accent rounded-full ml-0.5 mb-3"></span>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="font-heading text-5xl xl:text-6xl text-cream font-bold leading-tight mb-8">
            Almost there!
          </h1>
          <p className="text-muted text-lg leading-relaxed">
            One last step before you join thousands of students learning and growing together.
          </p>
        </div>

        <div></div>
      </div>

      {/* Right Side - Verification Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md text-center">
          {/* Mobile Logo */}
          <div className="flex items-center justify-center lg:hidden mb-8">
            <span className="font-heading text-2xl text-cream font-bold">
              StudyMate
            </span>
            <span className="w-2 h-2 bg-accent rounded-full ml-0.5 mb-3"></span>
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
              <MailCheck className="w-10 h-10 text-accent" />
            </div>
          </div>

          {/* Heading */}
          <h2 className="font-heading text-3xl sm:text-4xl text-cream font-bold mb-4">
            Verify your email
          </h2>

          {/* Description */}
          <p className="text-muted text-base leading-relaxed mb-2">
            We&apos;ve sent a verification link to
          </p>
          {email && (
            <p className="text-cream font-body font-semibold text-lg mb-6">
              {email}
            </p>
          )}
          <p className="text-muted text-sm leading-relaxed mb-8">
            Please check your inbox (and spam folder) and click the link to confirm your account. Once verified, you can log in and start studying with your mates!
          </p>

          {/* CTA - Go to Login */}
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 w-full bg-accent text-navy font-heading font-bold px-6 py-3.5 rounded-md transition-all duration-200 hover:bg-accent/90 active:scale-[0.98] mb-4"
          >
            Go to Login
            <ArrowRight className="w-5 h-5" />
          </Link>

          {/* Resend */}
          <div className="mt-4">
            <p className="text-muted text-sm mb-3">
              Didn&apos;t receive the email?
            </p>
            <button
              onClick={handleResend}
              disabled={resendLoading || resendSuccess}
              className="text-accent font-heading font-semibold text-sm hover:underline disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {resendLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : resendSuccess ? (
                'Verification email resent!'
              ) : (
                'Resend verification email'
              )}
            </button>

            {resendError && (
              <p className="text-red-400 text-sm mt-2">{resendError}</p>
            )}
            {resendSuccess && (
              <p className="text-accent/80 text-sm mt-2">
                Check your inbox — a new link is on its way.
              </p>
            )}
          </div>

          {/* Footer note */}
          <p className="text-muted/50 text-xs mt-10">
            If you continue to have trouble, contact us at support@studymate.app
          </p>
        </div>
      </div>
    </div>
  )
}
