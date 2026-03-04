import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, X } from 'lucide-react'
import { supabase, isMissingCredentials } from '../lib/supabase'
import { isProfileIncomplete } from '../lib/profileCheck'

export default function Login() {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isEmailNotConfirmed, setIsEmailNotConfirmed] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  
  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    
    if (!validateForm()) return

    if (isMissingCredentials) {
      setSubmitError(
        'App configuration error: Supabase credentials are not set. ' +
        'If this is a deployed site, the environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) need to be added in the hosting dashboard.'
      )
      return
    }
    
    setLoading(true)
    setIsEmailNotConfirmed(false)
    setResendSuccess(false)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })
      
      if (error) throw error
      
      // Check if profile is complete
      const { data: { user } } = await supabase.auth.getUser()
      if (user && await isProfileIncomplete(user.id)) {
        navigate('/onboarding')
      } else {
        navigate('/home')
      }
    } catch (error) {
      const msg = error.message || ''
      const msgLower = msg.toLowerCase()
      if (msgLower.includes('failed to fetch') || msgLower.includes('networkerror') || msgLower.includes('fetch')) {
        setSubmitError(
          'Network error: Cannot reach the authentication server. ' +
          'This usually means the app is misconfigured. Please contact the developer.'
        )
        console.error('Supabase fetch failed. Current URL target:', import.meta.env.VITE_SUPABASE_URL || 'NOT SET (using placeholder)')
      } else if (msgLower.includes('email not confirmed') || msgLower.includes('email_not_confirmed')) {
        setIsEmailNotConfirmed(true)
        setSubmitError(
          'Your email is not confirmed yet. Please check your inbox (and spam folder) for the confirmation link, then try logging in again.'
        )
      } else if (msgLower.includes('invalid login credentials') || msgLower.includes('invalid_credentials')) {
        // Supabase sometimes returns "Invalid login credentials" for unconfirmed emails too
        setIsEmailNotConfirmed(true)
        setSubmitError(
          'Login failed. This can happen if your email is not yet confirmed. ' +
          'Please check your inbox (and spam folder) for a confirmation email from StudyMate, then try again. ' +
          'If you\'ve already confirmed, double-check your email and password.'
        )
      } else {
        setSubmitError(msg || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    setResendLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: formData.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      setResendSuccess(true)
    } catch (error) {
      setSubmitError('Failed to resend confirmation email. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotError('')
    
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address')
      return
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      setForgotError('Please enter a valid email address')
      return
    }
    
    setForgotLoading(true)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })
      
      if (error) throw error
      
      setForgotSuccess(true)
    } catch (error) {
      // Don't reveal if email exists or not
      setForgotSuccess(true)
    } finally {
      setForgotLoading(false)
    }
  }

  const closeForgotModal = () => {
    setShowForgotModal(false)
    setForgotEmail('')
    setForgotSuccess(false)
    setForgotError('')
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
            Welcome back.
          </h1>
          <p className="text-muted text-xl leading-relaxed">
            Your study crew is waiting.
          </p>
        </div>
        
        <div></div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex items-center lg:hidden mb-8">
            <span className="font-heading text-2xl text-cream font-bold">
              StudyMate
            </span>
            <span className="w-2 h-2 bg-accent rounded-full ml-0.5 mb-3"></span>
          </div>
          
          {/* Mobile Heading */}
          <h1 className="font-heading text-3xl sm:text-4xl text-cream font-bold mb-2 lg:hidden">
            Welcome back.
          </h1>
          
          <h2 className="font-heading text-2xl text-cream font-semibold mb-8">
            Login to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-cream text-sm font-body mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-[#161B2E] text-cream px-4 py-3 border border-slate/50 
                         focus:border-accent focus:outline-none transition-colors duration-200"
                style={{ borderRadius: '4px' }}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-[#E57373] text-sm mt-1.5">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-cream text-sm font-body mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-[#161B2E] text-cream px-4 py-3 pr-12 border border-slate/50 
                           focus:border-accent focus:outline-none transition-colors duration-200"
                  style={{ borderRadius: '4px' }}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-cream 
                           transition-colors duration-200"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[#E57373] text-sm mt-1.5">{errors.password}</p>
              )}
              
              {/* Forgot Password Link */}
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-muted text-sm hover:text-cream underline underline-offset-4 
                           transition-colors duration-200"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="bg-[#E57373]/10 border border-[#E57373]/30 px-4 py-3"
                   style={{ borderRadius: '4px' }}>
                <p className="text-[#E57373] text-sm">{submitError}</p>
                {isEmailNotConfirmed && !resendSuccess && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resendLoading}
                    className="mt-2 text-accent text-sm font-semibold hover:underline disabled:opacity-50"
                  >
                    {resendLoading ? 'Sending...' : 'Resend confirmation email'}
                  </button>
                )}
                {resendSuccess && (
                  <p className="text-green-400 text-sm mt-2">
                    Confirmation email sent! Please check your inbox.
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-navy font-heading font-bold uppercase py-4 
                       hover:bg-accent/90 active:scale-[0.99] transition-all duration-200
                       disabled:opacity-70 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
              style={{ borderRadius: '4px' }}
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center mt-8 text-muted">
            Don't have an account?{' '}
            <Link 
              to="/signup" 
              className="text-cream underline underline-offset-4 hover:text-accent transition-colors duration-200"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div 
            className="bg-[#161B2E] border border-white/[0.08] w-full max-w-md p-6 relative"
            style={{ borderRadius: '6px' }}
          >
            {/* Close Button */}
            <button
              onClick={closeForgotModal}
              className="absolute top-4 right-4 text-muted hover:text-cream transition-colors duration-200"
            >
              <X size={20} />
            </button>

            {!forgotSuccess ? (
              <>
                <h3 className="font-heading text-xl text-cream font-semibold mb-2">
                  Reset your password
                </h3>
                <p className="text-muted text-sm mb-6">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="forgotEmail" className="block text-cream text-sm font-body mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="forgotEmail"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-navy text-cream px-4 py-3 border border-slate/50 
                               focus:border-accent focus:outline-none transition-colors duration-200"
                      style={{ borderRadius: '4px' }}
                      placeholder="you@example.com"
                    />
                    {forgotError && (
                      <p className="text-[#E57373] text-sm mt-1.5">{forgotError}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-accent text-navy font-heading font-bold uppercase py-3 
                             hover:bg-accent/90 active:scale-[0.99] transition-all duration-200
                             disabled:opacity-70 disabled:cursor-not-allowed
                             flex items-center justify-center gap-2"
                    style={{ borderRadius: '4px' }}
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-heading text-xl text-cream font-semibold mb-2">
                  Check your email
                </h3>
                <p className="text-muted text-sm mb-6">
                  If an account exists for {forgotEmail}, you'll receive a password reset link shortly.
                </p>
                <button
                  onClick={closeForgotModal}
                  className="text-cream underline underline-offset-4 hover:text-accent 
                           transition-colors duration-200 text-sm"
                >
                  Back to login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
