import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Camera, FileText, GraduationCap, BookOpen, Palette, Clock, Pencil, Users, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const ITEMS = [
  { key: 'avatar', label: 'Upload a profile photo', points: 20, icon: Camera, action: 'profile-edit' },
  { key: 'bio', label: 'Write a bio (20+ chars)', points: 15, icon: Pencil, action: 'profile-edit' },
  { key: 'university', label: 'Add your university', points: 10, icon: GraduationCap, action: 'profile-edit' },
  { key: 'subjects', label: 'Select 3+ subjects', points: 15, icon: BookOpen, action: 'profile-edit' },
  { key: 'study_style', label: 'Set your study style', points: 10, icon: Palette, action: 'profile-edit' },
  { key: 'availability', label: 'Set your availability', points: 10, icon: Clock, action: 'profile-edit' },
  { key: 'has_post', label: 'Make at least 1 post', points: 10, icon: FileText, action: '/home' },
  { key: 'has_connection', label: 'Connect with a mate', points: 10, icon: Users, action: '/find-mate' },
]

function computeScore(profile, postCount, connectionCount) {
  const completed = {}
  completed.avatar = !!profile?.avatar_url
  completed.bio = !!(profile?.bio && profile.bio.length >= 20)
  completed.university = !!profile?.university
  completed.subjects = !!(profile?.subjects && profile.subjects.length >= 3)
  completed.study_style = !!profile?.study_style
  completed.availability = !!profile?.availability
  completed.has_post = postCount > 0
  completed.has_connection = connectionCount > 0

  let score = 0
  ITEMS.forEach(item => {
    if (completed[item.key]) score += item.points
  })

  return { score, completed }
}

// ─── Circular Progress Ring ───
function ProgressRing({ score, size = 100, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(61,74,107,0.4)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#A8FF3E" strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-heading font-bold text-cream" style={{ fontSize: size * 0.28 }}>
          {score}%
        </span>
      </div>
    </div>
  )
}

// ─── Full Widget (Profile page) ───
export default function ProfileCompletion({ userId }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [postCount, setPostCount] = useState(0)
  const [connectionCount, setConnectionCount] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      const [{ data: p }, { count: posts }, { count: conns }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('connections').select('*', { count: 'exact', head: true })
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
      ])
      setProfile(p)
      setPostCount(posts || 0)
      setConnectionCount(conns || 0)
      setLoaded(true)
    })()
  }, [userId])

  if (!loaded) return null

  const { score, completed } = computeScore(profile, postCount, connectionCount)
  if (score === 100) return null

  const incomplete = ITEMS.filter(i => !completed[i.key])

  const handleClick = (action) => {
    if (action === 'profile-edit') {
      // Scroll to top where Edit Profile button is
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      navigate(action)
    }
  }

  return (
    <div
      className="p-5"
      style={{
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px',
      }}
    >
      <div className="flex items-center gap-5">
        <ProgressRing score={score} size={90} strokeWidth={7} />
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-cream font-semibold text-sm mb-1">Your Profile</h3>
          <p className="text-muted text-xs leading-relaxed">
            Complete your profile to be discovered by more mates
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {ITEMS.map(item => {
          const done = completed[item.key]
          return (
            <button
              key={item.key}
              onClick={() => !done && handleClick(item.action)}
              disabled={done}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors rounded
                         ${done ? 'opacity-50 cursor-default' : 'hover:bg-slate/20 cursor-pointer'}`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                             ${done ? 'bg-accent/20' : 'border border-slate/50'}`}>
                {done && <Check size={12} className="text-accent" />}
              </div>
              <item.icon size={14} className={done ? 'text-accent/50' : 'text-muted'} />
              <span className={`text-xs ${done ? 'text-muted line-through' : 'text-cream'}`}>
                {item.label}
              </span>
              <span className="ml-auto text-[10px] text-muted">{item.points}pts</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Banner (Home page, dismissible) ───
export function ProfileCompletionBanner({ userId }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [postCount, setPostCount] = useState(0)
  const [connectionCount, setConnectionCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const dismissedAt = localStorage.getItem('profile_banner_dismissed')
    if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true)
      return
    }

    if (!userId) return
    ;(async () => {
      const [{ data: p }, { count: posts }, { count: conns }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('connections').select('*', { count: 'exact', head: true })
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
      ])
      setProfile(p)
      setPostCount(posts || 0)
      setConnectionCount(conns || 0)
      setLoaded(true)
    })()
  }, [userId])

  const handleDismiss = () => {
    localStorage.setItem('profile_banner_dismissed', String(Date.now()))
    setDismissed(true)
  }

  if (dismissed || !loaded) return null

  const { score } = computeScore(profile, postCount, connectionCount)
  if (score >= 60) return null

  return (
    <div
      className="flex items-center gap-3 p-3"
      style={{
        backgroundColor: '#131929',
        border: '1px solid rgba(168,255,62,0.15)',
        borderRadius: '6px',
      }}
    >
      <ProgressRing score={score} size={48} strokeWidth={4} />
      <div className="flex-1 min-w-0">
        <p className="text-cream text-sm">
          Your profile is <span className="text-accent font-bold">{score}%</span> complete.
        </p>
        <p className="text-muted text-xs">Complete it to get better mate suggestions.</p>
      </div>
      <button
        onClick={() => navigate('/profile')}
        className="px-3 py-1.5 bg-accent/10 text-accent text-xs hover:bg-accent/20 
                 transition-colors rounded flex-shrink-0"
      >
        Complete
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 text-muted hover:text-cream transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Helper for FindMate scoring ───
export function getProfileCompletenessScore(profile) {
  let score = 0
  if (profile?.avatar_url) score += 20
  if (profile?.bio && profile.bio.length >= 20) score += 15
  if (profile?.university) score += 10
  if (profile?.subjects && profile.subjects.length >= 3) score += 15
  if (profile?.study_style) score += 10
  if (profile?.availability) score += 10
  // has_post and has_connection not available from profile alone — skip for sort
  return score
}
