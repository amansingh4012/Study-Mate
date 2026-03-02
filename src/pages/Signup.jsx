import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
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
    
    setLoading(true)
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            interest: formData.interest,
          },
        },
      })
      
      if (error) throw error
      
      // If email confirmation is off, session is immediately available
      // If on, data.session will be null — still navigate to onboarding
      // and the Onboarding page will verify the session before saving
      navigate('/onboarding')
    } catch (error) {
      setSubmitError(error.message || 'An error occurred during signup')
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
