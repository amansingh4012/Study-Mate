import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Check, X as XIcon } from 'lucide-react'
import { supabase, isMissingCredentials } from '../lib/supabase'

const STUDY_INTERESTS = [
  'Computer Science',
  'Design',
  'Medicine',
  'Law',
  'Business',
  'Mathematics',
  'Engineering',
  'Languages',
  'Arts',
  'Other',
]

export default function Signup() {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    interest: '',
    agreeToGuidelines: false,
  })
  
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState(null)

  // Username validation regex: letters, numbers, max one dot, max one underscore
  const isValidUsername = (val) => {
    if (val.length < 3 || val.length > 30) return false
    // Must start and end with letter or number
    if (!/^[a-zA-Z0-9]/.test(val) || !/[a-zA-Z0-9]$/.test(val)) return false
    // Only letters, numbers, at most one dot, at most one underscore
    const dotCount = (val.match(/\./g) || []).length
    const underscoreCount = (val.match(/_/g) || []).length
    if (dotCount > 1 || underscoreCount > 1) return false
    // No other special characters
    if (!/^[a-zA-Z0-9._]+$/.test(val)) return false
    return true
  }

  const checkUsernameAvailability = async (username) => {
    if (!isValidUsername(username)) {
      setUsernameAvailable(null)
      return
    }
    setCheckingUsername(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle()
      if (!error) {
        setUsernameAvailable(!data)
      }
    } catch {
      setUsernameAvailable(null)
    } finally {
      setCheckingUsername(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : name === 'username' ? value.toLowerCase() : value,
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    // Check username availability on change
    if (name === 'username') {
      setUsernameAvailable(null)
      const trimmed = value.trim().toLowerCase()
      if (trimmed.length >= 3 && isValidUsername(trimmed)) {
        clearTimeout(window._usernameTimer)
        window._usernameTimer = setTimeout(() => checkUsernameAvailability(trimmed), 400)
      }
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }

    const trimmedUsername = formData.username.trim().toLowerCase()
    if (!trimmedUsername) {
      newErrors.username = 'Username is required'
    } else if (!isValidUsername(trimmedUsername)) {
      newErrors.username = 'Username must be 3-30 characters: letters, numbers, max one dot & one underscore'
    } else if (usernameAvailable === false) {
      newErrors.username = 'This username is already taken'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Must include at least one lowercase letter'
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Must include at least one uppercase letter'
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Must include at least one number'
    } else if (!/[^a-zA-Z0-9]/.test(formData.password)) {
      newErrors.password = 'Must include at least one special character'
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    if (!formData.interest) {
      newErrors.interest = 'Please select your primary study interest'
    }
    
    if (!formData.agreeToGuidelines) {
      newErrors.agreeToGuidelines = 'You must agree to the community guidelines'
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
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            username: formData.username.trim().toLowerCase(),
            interest: formData.interest,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) throw error
      
      // If email confirmation is off, session is immediately available
      // If on, data.session will be null — still navigate to onboarding
      // and the Onboarding page will verify the session before saving
      navigate('/onboarding', { state: { email: formData.email } })
    } catch (error) {
      const msg = error.message || ''
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        setSubmitError(
          'Network error: Cannot reach the authentication server. ' +
          'This usually means the app is misconfigured. Please contact the developer.'
        )
      } else {
        setSubmitError(msg || 'An error occurred during signup')
      }
    } finally {
      setLoading(false)
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
            Learn together.<br />
            Grow together.
          </h1>
          <p className="text-muted text-lg leading-relaxed">
            "The beautiful thing about learning is that nobody can take it away from you."
          </p>
          <p className="text-muted/60 text-sm mt-4">— B.B. King</p>
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
            Learn together.
          </h1>
          
          <h2 className="font-heading text-2xl text-cream font-semibold mb-8">
            Create your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-cream text-sm font-body mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full bg-[#161B2E] text-cream px-4 py-3 border border-slate/50 
                         focus:border-accent focus:outline-none transition-colors duration-200"
                style={{ borderRadius: '4px' }}
                placeholder="Enter your full name"
              />
              {errors.fullName && (
                <p className="text-[#E57373] text-sm mt-1.5">{errors.fullName}</p>
              )}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-cream text-sm font-body mb-2">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full bg-[#161B2E] text-cream px-4 py-3 pr-10 border border-slate/50 
                           focus:border-accent focus:outline-none transition-colors duration-200"
                  style={{ borderRadius: '4px' }}
                  placeholder="e.g. john_doe"
                  maxLength={30}
                />
                {formData.username.trim().length >= 3 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? (
                      <Loader2 size={16} className="text-muted animate-spin" />
                    ) : usernameAvailable === true ? (
                      <Check size={16} className="text-accent" />
                    ) : usernameAvailable === false ? (
                      <XIcon size={16} className="text-[#E57373]" />
                    ) : null}
                  </span>
                )}
              </div>
              <p className="text-muted/60 text-xs mt-1">
                Letters, numbers, max one dot (.) and one underscore (_)
              </p>
              {errors.username && (
                <p className="text-[#E57373] text-sm mt-1">{errors.username}</p>
              )}
            </div>

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
                  placeholder="Create a password"
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
              {formData.password && !errors.password && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {[
                    { test: formData.password.length >= 6, label: '6+ chars' },
                    { test: /[a-z]/.test(formData.password), label: 'Lowercase' },
                    { test: /[A-Z]/.test(formData.password), label: 'Uppercase' },
                    { test: /[0-9]/.test(formData.password), label: 'Number' },
                    { test: /[^a-zA-Z0-9]/.test(formData.password), label: 'Special' },
                  ].map(({ test, label }) => (
                    <span key={label} className={`text-xs ${test ? 'text-accent' : 'text-muted/50'}`}>
                      {test ? '✓' : '○'} {label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-cream text-sm font-body mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full bg-[#161B2E] text-cream px-4 py-3 pr-12 border border-slate/50 
                           focus:border-accent focus:outline-none transition-colors duration-200"
                  style={{ borderRadius: '4px' }}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-cream 
                           transition-colors duration-200"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-[#E57373] text-sm mt-1.5">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Study Interest */}
            <div>
              <label htmlFor="interest" className="block text-cream text-sm font-body mb-2">
                Primary Study Interest
              </label>
              <select
                id="interest"
                name="interest"
                value={formData.interest}
                onChange={handleChange}
                className="w-full bg-[#161B2E] text-cream px-4 py-3 border border-slate/50 
                         focus:border-accent focus:outline-none transition-colors duration-200
                         appearance-none cursor-pointer"
                style={{ borderRadius: '4px' }}
              >
                <option value="" className="bg-[#161B2E]">Select your interest</option>
                {STUDY_INTERESTS.map(interest => (
                  <option key={interest} value={interest} className="bg-[#161B2E]">
                    {interest}
                  </option>
                ))}
              </select>
              {errors.interest && (
                <p className="text-[#E57373] text-sm mt-1.5">{errors.interest}</p>
              )}
            </div>

            {/* Guidelines Checkbox */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="agreeToGuidelines"
                  checked={formData.agreeToGuidelines}
                  onChange={handleChange}
                  className="mt-1 w-4 h-4 bg-[#161B2E] border border-slate/50 
                           checked:bg-accent checked:border-accent cursor-pointer
                           focus:ring-0 focus:ring-offset-0"
                  style={{ borderRadius: '2px' }}
                />
                <span className="text-cream/80 text-sm">
                  I agree to the community guidelines
                </span>
              </label>
              {errors.agreeToGuidelines && (
                <p className="text-[#E57373] text-sm mt-1.5">{errors.agreeToGuidelines}</p>
              )}
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="bg-[#E57373]/10 border border-[#E57373]/30 px-4 py-3"
                   style={{ borderRadius: '4px' }}>
                <p className="text-[#E57373] text-sm">{submitError}</p>
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
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center mt-8 text-muted">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="text-cream underline underline-offset-4 hover:text-accent transition-colors duration-200"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
