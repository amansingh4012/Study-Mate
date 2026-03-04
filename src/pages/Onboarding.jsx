import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Camera, Loader2, Check, X as XIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const SUBJECTS = [
  'Computer Science', 'Web Dev', 'Machine Learning', 'UI/UX Design',
  'Data Science', 'Cybersecurity', 'Mathematics', 'Physics', 'Chemistry',
  'Biology', 'Medicine', 'Law', 'Business', 'Economics', 'Psychology',
  'History', 'Literature', 'Languages', 'Music Theory', 'Architecture',
]

const STUDY_STYLES = [
  { id: 'night-owl', label: 'Night Owl', description: 'Most productive after dark' },
  { id: 'early-bird', label: 'Early Bird', description: 'Best work before noon' },
  { id: 'flexible', label: 'Flexible', description: 'Adapts to any schedule' },
]

const GOALS = [
  'Find a study partner',
  'Join study groups',
  'Share resources',
  'Stay accountable',
  'Casual learning',
]

const AVAILABILITY_OPTIONS = [
  'Weekday mornings',
  'Weekday evenings',
  'Weekends',
  'Anytime',
]

export default function Onboarding() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const fileInputRef = useRef(null)
  const signupEmail = location.state?.email || user?.email || ''
  
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  
  // Step 1 data
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarFile, setAvatarFile] = useState(null) // raw file for deferred upload
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || '')
  const [username, setUsername] = useState(user?.user_metadata?.username || '')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState(null)
  const [bio, setBio] = useState('')
  const [university, setUniversity] = useState('')
  
  // Step 2 data
  const [selectedSubjects, setSelectedSubjects] = useState([])
  
  // Step 3 data
  const [studyStyle, setStudyStyle] = useState('')
  const [selectedGoals, setSelectedGoals] = useState([])
  const [availability, setAvailability] = useState('')
  
  // Errors
  const [errors, setErrors] = useState({})

  // Username validation
  const isValidUsername = (val) => {
    if (val.length < 3 || val.length > 30) return false
    if (!/^[a-zA-Z0-9]/.test(val) || !/[a-zA-Z0-9]$/.test(val)) return false
    const dotCount = (val.match(/\./g) || []).length
    const underscoreCount = (val.match(/_/g) || []).length
    if (dotCount > 1 || underscoreCount > 1) return false
    if (!/^[a-zA-Z0-9._]+$/.test(val)) return false
    return true
  }

  const checkUsernameAvailability = async (uname) => {
    if (!isValidUsername(uname)) {
      setUsernameAvailable(null)
      return
    }
    setCheckingUsername(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', uname.toLowerCase())
        .maybeSingle()
      if (!error) {
        // If the found profile is our own, it's fine
        setUsernameAvailable(!data || data.id === user?.id)
      }
    } catch {
      setUsernameAvailable(null)
    } finally {
      setCheckingUsername(false)
    }
  }

  const handleUsernameChange = (e) => {
    const val = e.target.value.toLowerCase()
    setUsername(val)
    setUsernameAvailable(null)
    const trimmed = val.trim().toLowerCase()
    if (trimmed.length >= 3 && isValidUsername(trimmed)) {
      clearTimeout(window._onboardUsernameTimer)
      window._onboardUsernameTimer = setTimeout(() => checkUsernameAvailability(trimmed), 400)
    }
  }

  // Populate display name once user becomes available (may be null on initial mount)
  useEffect(() => {
    if (user?.user_metadata?.full_name && !displayName) {
      setDisplayName(user.user_metadata.full_name)
    }
    if (user?.user_metadata?.username && !username) {
      setUsername(user.user_metadata.username)
    }
  }, [user])

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Always store the file for deferred upload at finish time
    setAvatarFile(file)
    
    // Show preview immediately
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubjectToggle = (subject) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subject)) {
        return prev.filter(s => s !== subject)
      }
      if (prev.length >= 5) return prev
      return [...prev, subject]
    })
  }

  const handleGoalToggle = (goal) => {
    setSelectedGoals(prev => {
      if (prev.includes(goal)) {
        return prev.filter(g => g !== goal)
      }
      return [...prev, goal]
    })
  }

  const validateStep = (step) => {
    const newErrors = {}
    
    if (step === 1) {
      if (!displayName.trim()) {
        newErrors.displayName = 'Display name is required'
      }
      const trimmedUsername = username.trim().toLowerCase()
      if (!trimmedUsername) {
        newErrors.username = 'Username is required'
      } else if (!isValidUsername(trimmedUsername)) {
        newErrors.username = '3-30 chars: letters, numbers, max one dot & one underscore'
      } else if (usernameAvailable === false) {
        newErrors.username = 'This username is already taken'
      }
    }
    
    if (step === 2) {
      if (selectedSubjects.length === 0) {
        newErrors.subjects = 'Select at least one subject'
      }
    }
    
    if (step === 3) {
      if (!studyStyle) {
        newErrors.studyStyle = 'Select your study style'
      }
      if (selectedGoals.length === 0) {
        newErrors.goals = 'Select at least one goal'
      }
      if (!availability) {
        newErrors.availability = 'Select your availability'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    setCurrentStep(prev => prev - 1)
  }

  const handleFinish = async () => {
    if (!validateStep(3)) return
    
    setLoading(true)
    
    try {
      // Get session first — retry up to 3 times with delay
      let session = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data } = await supabase.auth.getSession()
        session = data?.session
        if (session) break
        await new Promise(r => setTimeout(r, 1000))
      }

      // Upload avatar (needs session for user ID in filename)
      let finalAvatarUrl = avatarUrl
      if (avatarFile && session) {
        try {
          const fileExt = avatarFile.name.split('.').pop()
          const fileName = `${session.user.id}-${Date.now()}.${fileExt}`
          
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatarFile, { upsert: true })
          
          if (uploadError) {
            console.error('Avatar upload error:', uploadError.message)
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName)
            finalAvatarUrl = publicUrl
          }
        } catch (err) {
          console.error('Avatar upload failed:', err)
        }
      }

      const profileData = {
        full_name: displayName,
        username: username.trim().toLowerCase(),
        bio: bio,
        avatar_url: finalAvatarUrl,
        university: university,
        subjects: selectedSubjects,
        study_style: studyStyle,
        goals: selectedGoals.join(', '),
        availability: availability,
        updated_at: new Date().toISOString(),
      }

      // Cache to localStorage as safety net
      // Include avatar as base64 so it can be uploaded later if no session now
      try {
        const cacheData = { ...profileData }
        if (avatarPreview && !finalAvatarUrl) {
          // No avatar was uploaded (no session) — store the base64 preview
          cacheData._pendingAvatarBase64 = avatarPreview
        }
        localStorage.setItem('pendingOnboardingData', JSON.stringify(cacheData))
      } catch (e) {
        console.warn('Could not cache to localStorage:', e)
      }
      
      if (session) {
        // We have a session — try to save to DB
        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', session.user.id)
          .select()
          .maybeSingle()

        if (updateError) {
          console.error('Update error:', updateError)
        }

        // If UPDATE didn't return a row, try upsert
        if (!updated) {
          console.warn('UPDATE returned no data, trying upsert...')
          const { data: upserted, error: upsertError } = await supabase
            .from('profiles')
            .upsert({
              id: session.user.id,
              email: session.user.email,
              ...profileData,
            })
            .select()
            .maybeSingle()

          if (upsertError) {
            console.error('Upsert error:', upsertError)
          }
          
          if (upserted) {
            localStorage.removeItem('pendingOnboardingData')
          }
        } else {
          localStorage.removeItem('pendingOnboardingData')
        }

        // Also sync to auth metadata (doesn't require RLS)
        await supabase.auth.updateUser({
          data: {
            full_name: displayName,
            username: username.trim().toLowerCase(),
            avatar_url: finalAvatarUrl,
            university: university,
            bio: bio,
            subjects: selectedSubjects,
            study_style: studyStyle,
            goals: selectedGoals.join(', '),
            availability: availability,
          }
        })
      } else {
        console.warn('No session available — data cached in localStorage, will sync on next login')
      }
      
      navigate('/verify-email', { state: { email: signupEmail } })
    } catch (error) {
      console.error('Error saving profile:', error)
      setErrors({ submit: `Profile data cached locally. It will sync when you log in.` })
      navigate('/verify-email', { state: { email: signupEmail } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <span className="font-heading text-2xl text-cream font-bold">
            StudyMate
          </span>
          <span className="w-2 h-2 bg-accent rounded-full ml-0.5 mb-3"></span>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-12">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                step === currentStep
                  ? 'bg-accent'
                  : step < currentStep
                  ? 'bg-accent/50'
                  : 'bg-slate'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="fade-in">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl text-cream font-bold text-center mb-2">
                Who are you?
              </h1>
              <p className="text-muted text-center mb-10">
                Let's set up your profile
              </p>

              <div className="space-y-6">
                {/* Avatar Upload */}
                <div className="flex flex-col items-center mb-8">
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploadingAvatar}
                    className="relative w-28 h-28 rounded-full bg-slate/50 border-2 border-dashed 
                             border-slate hover:border-accent transition-colors duration-200
                             flex items-center justify-center overflow-hidden group"
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera size={32} className="text-muted group-hover:text-accent transition-colors" />
                    )}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-navy/70 flex items-center justify-center">
                        <Loader2 size={24} className="text-accent animate-spin" />
                      </div>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <p className="text-muted text-sm mt-3">Click to upload photo</p>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-cream text-sm font-body mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-[#161B2E] text-cream px-4 py-3 border border-slate/50 
                             focus:border-accent focus:outline-none transition-colors duration-200"
                    style={{ borderRadius: '4px' }}
                    placeholder="Your name"
                  />
                  {errors.displayName && (
                    <p className="text-[#E57373] text-sm mt-1.5">{errors.displayName}</p>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label className="block text-cream text-sm font-body mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={handleUsernameChange}
                      className="w-full bg-[#161B2E] text-cream px-4 py-3 pr-10 border border-slate/50 
                               focus:border-accent focus:outline-none transition-colors duration-200"
                      style={{ borderRadius: '4px' }}
                      placeholder="e.g. john_doe"
                      maxLength={30}
                    />
                    {username.trim().length >= 3 && (
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

                {/* Bio */}
                <div>
                  <label className="block text-cream text-sm font-body mb-2">
                    Short Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 120))}
                    className="w-full bg-[#161B2E] text-cream px-4 py-3 border border-slate/50 
                             focus:border-accent focus:outline-none transition-colors duration-200
                             resize-none h-24"
                    style={{ borderRadius: '4px' }}
                    placeholder="Tell us a bit about yourself..."
                  />
                  <p className="text-muted text-sm mt-1 text-right">
                    {bio.length}/120
                  </p>
                </div>

                {/* University */}
                <div>
                  <label className="block text-cream text-sm font-body mb-2">
                    University / School <span className="text-muted">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    className="w-full bg-[#161B2E] text-cream px-4 py-3 border border-slate/50 
                             focus:border-accent focus:outline-none transition-colors duration-200"
                    style={{ borderRadius: '4px' }}
                    placeholder="Where do you study?"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl text-cream font-bold text-center mb-2">
                What do you study?
              </h1>
              <p className="text-muted text-center mb-10">
                Select 1-5 subjects you're interested in
              </p>

              <div className="flex flex-wrap gap-3 justify-center">
                {SUBJECTS.map((subject) => {
                  const isSelected = selectedSubjects.includes(subject)
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => handleSubjectToggle(subject)}
                      className={`px-4 py-2 border transition-all duration-200 font-body text-sm
                               ${isSelected
                                 ? 'bg-accent text-navy border-accent font-medium'
                                 : 'bg-transparent text-muted border-slate/50 hover:border-cream/50'
                               }`}
                      style={{ borderRadius: '20px' }}
                    >
                      {subject}
                    </button>
                  )
                })}
              </div>

              {errors.subjects && (
                <p className="text-[#E57373] text-sm mt-4 text-center">{errors.subjects}</p>
              )}

              <p className="text-muted text-sm mt-6 text-center">
                {selectedSubjects.length}/5 selected
              </p>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl text-cream font-bold text-center mb-2">
                How do you study?
              </h1>
              <p className="text-muted text-center mb-10">
                Help us find your perfect study match
              </p>

              {/* Study Style Cards */}
              <div className="mb-8">
                <label className="block text-cream text-sm font-body mb-3">
                  Your study style
                </label>
                <div className="grid gap-4 sm:grid-cols-3">
                  {STUDY_STYLES.map((style) => {
                    const isSelected = studyStyle === style.id
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setStudyStyle(style.id)}
                        className={`p-5 border text-left transition-all duration-200 relative
                                 ${isSelected
                                   ? 'bg-accent/10 border-accent'
                                   : 'bg-[#161B2E] border-slate/50 hover:border-cream/30'
                                 }`}
                        style={{ borderRadius: '6px' }}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3">
                            <Check size={18} className="text-accent" />
                          </div>
                        )}
                        <h3 className={`font-heading font-semibold text-lg mb-1 ${
                          isSelected ? 'text-accent' : 'text-cream'
                        }`}>
                          {style.label}
                        </h3>
                        <p className="text-muted text-sm">{style.description}</p>
                      </button>
                    )
                  })}
                </div>
                {errors.studyStyle && (
                  <p className="text-[#E57373] text-sm mt-2">{errors.studyStyle}</p>
                )}
              </div>

              {/* Goals */}
              <div className="mb-8">
                <label className="block text-cream text-sm font-body mb-3">
                  Your goals
                </label>
                <div className="flex flex-wrap gap-3">
                  {GOALS.map((goal) => {
                    const isSelected = selectedGoals.includes(goal)
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => handleGoalToggle(goal)}
                        className={`px-4 py-2 border transition-all duration-200 font-body text-sm
                                 ${isSelected
                                   ? 'bg-accent text-navy border-accent font-medium'
                                   : 'bg-transparent text-muted border-slate/50 hover:border-cream/50'
                                 }`}
                        style={{ borderRadius: '20px' }}
                      >
                        {goal}
                      </button>
                    )
                  })}
                </div>
                {errors.goals && (
                  <p className="text-[#E57373] text-sm mt-2">{errors.goals}</p>
                )}
              </div>

              {/* Availability */}
              <div>
                <label className="block text-cream text-sm font-body mb-2">
                  When are you usually available?
                </label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full bg-[#161B2E] text-cream px-4 py-3 border border-slate/50 
                           focus:border-accent focus:outline-none transition-colors duration-200
                           appearance-none cursor-pointer"
                  style={{ borderRadius: '4px' }}
                >
                  <option value="" className="bg-[#161B2E]">Select availability</option>
                  {AVAILABILITY_OPTIONS.map(option => (
                    <option key={option} value={option} className="bg-[#161B2E]">
                      {option}
                    </option>
                  ))}
                </select>
                {errors.availability && (
                  <p className="text-[#E57373] text-sm mt-1.5">{errors.availability}</p>
                )}
              </div>

              {errors.submit && (
                <div className="bg-[#E57373]/10 border border-[#E57373]/30 px-4 py-3 mt-6"
                     style={{ borderRadius: '4px' }}>
                  <p className="text-[#E57373] text-sm">{errors.submit}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4 mt-12">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 bg-transparent border border-cream/20 text-cream font-heading 
                       font-medium uppercase py-4 hover:border-cream/40 hover:bg-cream/5
                       transition-all duration-200"
              style={{ borderRadius: '4px' }}
            >
              Back
            </button>
          )}
          
          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 bg-accent text-navy font-heading font-bold uppercase py-4 
                       hover:bg-accent/90 active:scale-[0.99] transition-all duration-200"
              style={{ borderRadius: '4px' }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={loading}
              className="flex-1 bg-accent text-navy font-heading font-bold uppercase py-4 
                       hover:bg-accent/90 active:scale-[0.99] transition-all duration-200
                       disabled:opacity-70 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
              style={{ borderRadius: '4px' }}
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Finish'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
