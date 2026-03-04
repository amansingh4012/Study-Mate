import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  User, LogOut, Edit2, X, ChevronDown, Loader2, 
  Camera, FileText, Users, DoorOpen, BookOpen, 
  Clock, Target, MessageCircle, Check
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import PostCard from '../components/ui/PostCard'
import RoomCard from '../components/ui/RoomCard'
import { ProfileSkeleton, PostCardSkeleton, RoomCardSkeleton } from '../components/ui/Skeletons'
import EmptyState, { ProfilePostsEmpty, RoomsEmpty } from '../components/ui/EmptyState'
import ErrorBoundary from '../components/layout/ErrorBoundary'

const SUBJECTS = [
  'Computer Science', 'Web Dev', 'Machine Learning', 'UI/UX Design',
  'Data Science', 'Cybersecurity', 'Mathematics', 'Physics', 'Chemistry',
  'Biology', 'Medicine', 'Law', 'Business', 'Economics', 'Psychology',
  'History', 'Literature', 'Languages', 'Music Theory', 'Architecture',
]

const STUDY_STYLES = [
  { value: 'night-owl', label: 'Night Owl' },
  { value: 'early-bird', label: 'Early Bird' },
  { value: 'flexible', label: 'Flexible' },
]

const AVAILABILITY = [
  { value: 'Weekday mornings', label: 'Weekday mornings' },
  { value: 'Weekday evenings', label: 'Weekday evenings' },
  { value: 'Weekends', label: 'Weekends' },
  { value: 'Anytime', label: 'Anytime' },
]

// Subject colors for cover gradient
const SUBJECT_COLORS = {
  'Computer Science': '#A8FF3E',
  'Web Dev': '#3B82F6',
  'Machine Learning': '#8B5CF6',
  'UI/UX Design': '#EC4899',
  'Data Science': '#6366F1',
  'Cybersecurity': '#EF4444',
  'Mathematics': '#3B82F6',
  'Physics': '#8B5CF6',
  'Chemistry': '#EC4899',
  'Biology': '#10B981',
  'Medicine': '#14B8A6',
  'Law': '#F97316',
  'Business': '#F59E0B',
  'Economics': '#F59E0B',
  'Psychology': '#6366F1',
  'History': '#EF4444',
  'Literature': '#14B8A6',
  'Languages': '#3B82F6',
  'Music Theory': '#EC4899',
  'Architecture': '#F97316',
}

export default function Profile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('posts')
  
  // Stats
  const [postCount, setPostCount] = useState(0)
  const [connectionCount, setConnectionCount] = useState(0)
  const [roomCount, setRoomCount] = useState(0)
  
  // Content
  const [posts, setPosts] = useState([])
  const [rooms, setRooms] = useState([])
  
  // Connection status
  const [connectionStatus, setConnectionStatus] = useState(null) // null | 'pending' | 'connected'
  
  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    bio: '',
    university: '',
    subjects: [],
    study_style: '',
    availability: '',
    looking_for: '',
    goals: ''
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState(null)
  const [usernameError, setUsernameError] = useState('')

  const isOwnProfile = !userId || userId === user?.id
  const profileId = userId || user?.id

  useEffect(() => {
    if (!profileId) return
    fetchProfile()
    fetchStats()
    if (!isOwnProfile) {
      checkConnectionStatus()
    }
  }, [profileId])

  useEffect(() => {
    if (activeTab === 'posts') {
      fetchPosts()
    } else if (activeTab === 'rooms') {
      fetchRooms()
    }
  }, [activeTab, profileId])

  const fetchProfile = async () => {
    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single()

      if (error) throw error
      
      let merged = data
      
      // For own profile: check if there's pending onboarding data in localStorage
      if (isOwnProfile) {
        const pendingRaw = localStorage.getItem('pendingOnboardingData')
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw)
            // Profile is empty (no bio, no subjects) — push pending data to DB
            const profileIsEmpty = !data.bio && (!data.subjects || data.subjects.length === 0)
            if (profileIsEmpty && pending.bio) {
              
              // Upload pending avatar base64 if present
              if (pending._pendingAvatarBase64) {
                try {
                  const base64 = pending._pendingAvatarBase64
                  const mimeMatch = base64.match(/data:([^;]+);/)
                  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
                  const ext = mime.split('/')[1] || 'png'
                  const byteString = atob(base64.split(',')[1])
                  const ab = new ArrayBuffer(byteString.length)
                  const ia = new Uint8Array(ab)
                  for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i)
                  }
                  const blob = new Blob([ab], { type: mime })
                  
                  const fileName = `${profileId}-${Date.now()}.${ext}`
                  const { error: upErr } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, blob, { upsert: true })
                  
                  if (!upErr) {
                    const { data: urlData } = supabase.storage
                      .from('avatars')
                      .getPublicUrl(fileName)
                    pending.avatar_url = urlData.publicUrl
                  }
                } catch (avatarErr) {
                  console.error('Avatar base64 processing failed:', avatarErr)
                }
                delete pending._pendingAvatarBase64
              }
              
              console.log('Syncing pending onboarding data to DB...')
              const { data: synced, error: syncErr } = await supabase
                .from('profiles')
                .update(pending)
                .eq('id', profileId)
                .select()
                .maybeSingle()
              
              if (!syncErr && synced) {
                console.log('Pending onboarding data synced successfully')
                merged = synced
                localStorage.removeItem('pendingOnboardingData')
              } else if (syncErr) {
                console.error('Failed to sync pending data:', syncErr)
              }
            } else {
              // Profile already has data — clear the stale cache
              localStorage.removeItem('pendingOnboardingData')
            }
          } catch (e) {
            console.error('Error parsing pending data:', e)
            localStorage.removeItem('pendingOnboardingData')
          }
        }
        
        // Also merge auth user_metadata as fallback for any still-missing fields
        if (user?.user_metadata) {
          const meta = user.user_metadata
          merged = {
            ...merged,
            full_name: merged.full_name || meta.full_name || '',
            avatar_url: merged.avatar_url || meta.avatar_url || '',
            bio: merged.bio || meta.bio || '',
            university: merged.university || meta.university || '',
            subjects: merged.subjects?.length ? merged.subjects : (meta.subjects || []),
            study_style: merged.study_style || meta.study_style || '',
            goals: merged.goals || meta.goals || '',
            availability: merged.availability || meta.availability || '',
          }
        }
      }
      
      setProfile(merged)
      
      // Initialize edit form
      if (isOwnProfile && merged) {
        setEditForm({
          full_name: merged.full_name || '',
          username: merged.username || '',
          bio: merged.bio || '',
          university: merged.university || '',
          subjects: merged.subjects || [],
          study_style: merged.study_style || '',
          availability: merged.availability || '',
          looking_for: merged.looking_for || '',
          goals: merged.goals || ''
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      if (!isOwnProfile) {
        navigate('/home')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    // Post count
    const { count: posts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', profileId)

    // Connection count
    const { count: conns } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`)

    // Room count
    const { count: rooms } = await supabase
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profileId)

    setPostCount(posts || 0)
    setConnectionCount(conns || 0)
    setRoomCount(rooms || 0)
  }

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        author:profiles!posts_author_id_fkey(id, full_name, avatar_url),
        like_count:post_likes(count),
        comment_count:comments(count)
      `)
      .eq('author_id', profileId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data && user) {
      // Batch check likes in 1 query instead of N
      const postIds = data.map(p => p.id)
      let likedIds = new Set()

      if (postIds.length > 0) {
        const { data: likesData } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds)

        likedIds = new Set((likesData || []).map(l => l.post_id))
      }

      const postsWithLikes = data.map(post => ({
        ...post,
        like_count: post.like_count?.[0]?.count || 0,
        comment_count: post.comment_count?.[0]?.count || 0,
        is_liked: likedIds.has(post.id),
        is_bookmarked: false
      }))
      setPosts(postsWithLikes)
    }
  }

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('room_members')
      .select(`
        room:rooms(
          *,
          room_members(count)
        )
      `)
      .eq('user_id', profileId)

    if (data) {
      const roomsList = data
        .map(d => d.room)
        .filter(Boolean)
        .map(room => ({
          ...room,
          member_count: room.room_members?.[0]?.count || 0,
        }))
      setRooms(roomsList)
    }
  }

  const checkConnectionStatus = async () => {
    if (!user) return

    // Check if connected
    const { data: conn } = await supabase
      .from('connections')
      .select('id')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${profileId}),and(user1_id.eq.${profileId},user2_id.eq.${user.id})`)
      .maybeSingle()

    if (conn) {
      setConnectionStatus('connected')
      return
    }

    // Check if request pending
    const { data: req } = await supabase
      .from('mate_requests')
      .select('id')
      .eq('from_user', user.id)
      .eq('to_user', profileId)
      .eq('status', 'pending')
      .maybeSingle()

    if (req) {
      setConnectionStatus('pending')
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

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
        setUsernameAvailable(!data || data.id === user?.id)
      }
    } catch {
      setUsernameAvailable(null)
    } finally {
      setCheckingUsername(false)
    }
  }

  const handleUsernameChange = (val) => {
    const lowered = val.toLowerCase()
    setEditForm(prev => ({ ...prev, username: lowered }))
    setUsernameError('')
    setUsernameAvailable(null)
    const trimmed = lowered.trim()
    if (trimmed.length >= 3 && isValidUsername(trimmed)) {
      clearTimeout(window._profileUsernameTimer)
      window._profileUsernameTimer = setTimeout(() => checkUsernameAvailability(trimmed), 400)
    }
  }

  const toggleSubject = (subject) => {
    setEditForm(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }))
  }

  const handleSaveProfile = async () => {
    // Validate username
    const trimmedUsername = editForm.username.trim().toLowerCase()
    if (trimmedUsername) {
      if (!isValidUsername(trimmedUsername)) {
        setUsernameError('3-30 chars: letters, numbers, max one dot & one underscore')
        return
      }
      if (usernameAvailable === false) {
        setUsernameError('This username is already taken')
        return
      }
    }

    setSaving(true)
    
    try {
      let avatarUrl = profile?.avatar_url

      // Upload new avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile)

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName)
          avatarUrl = urlData?.publicUrl
        }
      }

      const profileData = {
          full_name: editForm.full_name,
          username: editForm.username.trim().toLowerCase(),
          bio: editForm.bio,
          university: editForm.university,
          subjects: editForm.subjects,
          study_style: editForm.study_style,
          availability: editForm.availability,
          looking_for: editForm.looking_for,
          goals: editForm.goals,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        }

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', user.id)
        .select()
        .maybeSingle()

      if (error) throw error

      // If update returned nothing (RLS issue), try upsert
      if (!updated) {
        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert({ id: user.id, email: user.email, ...profileData })
        if (upsertErr) throw upsertErr
      }

      // Keep auth user metadata in sync
      await supabase.auth.updateUser({
        data: {
          full_name: editForm.full_name,
          username: editForm.username.trim().toLowerCase(),
          avatar_url: avatarUrl,
          university: editForm.university,
          bio: editForm.bio,
          subjects: editForm.subjects,
          study_style: editForm.study_style,
        }
      })

      setShowEditModal(false)
      setAvatarFile(null)
      setAvatarPreview(null)
      fetchProfile()
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Get primary subject color for cover
  const primarySubject = profile?.subjects?.[0]
  const coverColor = SUBJECT_COLORS[primarySubject] || '#A8FF3E'

  const studyStyleLabel = STUDY_STYLES.find(s => s.value === profile?.study_style)?.label || profile?.study_style
  const availabilityLabel = AVAILABILITY.find(a => a.value === profile?.availability)?.label || profile?.availability

  if (loading) {
    return <ProfileSkeleton />
  }

  if (!profile) {
    return (
      <div className="fade-in text-center py-20">
        <p className="text-muted">Profile not found.</p>
        <Link to="/home" className="text-accent hover:underline mt-2 inline-block">
          Go Home
        </Link>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Hero Section */}
      <div 
        className="relative mb-16"
        style={{ 
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px',
          overflow: 'hidden'
        }}
      >
        {/* Cover gradient */}
        <div 
          className="h-32"
          style={{ 
            background: `linear-gradient(135deg, ${coverColor}20 0%, transparent 60%)`
          }}
        />

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="relative -mt-10 mb-4">
            <div 
              className="w-20 h-20 rounded-full bg-slate overflow-hidden border-4 border-navy"
            >
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted">
                  <User size={32} />
                </div>
              )}
            </div>
          </div>

          {/* Profile info */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <h1 className="font-heading text-2xl text-cream font-bold mb-1">
                {profile.full_name?.trim() || (profile.email ? profile.email.split('@')[0] : 'User')}
              </h1>
              {profile.username && (
                <p className="text-accent text-sm mb-1">@{profile.username}</p>
              )}
              {profile.university && (
                <p className="text-muted text-sm mb-3">{profile.university}</p>
              )}

              {/* Subject tags */}
              {profile.subjects?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {profile.subjects.map((subject) => (
                    <span
                      key={subject}
                      className="px-2.5 py-1 text-xs border border-accent/40 text-accent"
                      style={{ borderRadius: '12px' }}
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              )}

              {/* Bio */}
              {profile.bio && (
                <p className="text-cream text-sm mb-4 max-w-xl">
                  {profile.bio}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm">
                <div className="text-center sm:text-left">
                  <span className="text-cream font-semibold">{postCount}</span>
                  <span className="text-muted ml-1">Posts</span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-cream font-semibold">{connectionCount}</span>
                  <span className="text-muted ml-1">Connections</span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-cream font-semibold">{roomCount}</span>
                  <span className="text-muted ml-1">Rooms</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-transparent border 
                             border-cream/30 text-cream text-sm hover:border-accent 
                             hover:text-accent transition-all"
                    style={{ borderRadius: '4px' }}
                  >
                    <Edit2 size={16} />
                    Edit Profile
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 bg-transparent border 
                             border-red-400/30 text-red-400 text-sm hover:bg-red-400/10 
                             transition-all"
                    style={{ borderRadius: '4px' }}
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </>
              ) : connectionStatus === 'connected' ? (
                <Link
                  to={`/messages?user=${profile.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-navy 
                           font-medium text-sm hover:opacity-90 transition-opacity"
                  style={{ borderRadius: '4px' }}
                >
                  <MessageCircle size={16} />
                  Message
                </Link>
              ) : connectionStatus === 'pending' ? (
                <button
                  disabled
                  className="flex items-center gap-2 px-4 py-2 bg-transparent border 
                           border-slate/50 text-muted text-sm cursor-not-allowed"
                  style={{ borderRadius: '4px' }}
                >
                  Request Sent
                </button>
              ) : (
                <Link
                  to={`/find-mate?user=${profile.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-transparent border 
                           border-accent text-accent font-medium text-sm 
                           hover:bg-accent hover:text-navy transition-all"
                  style={{ borderRadius: '4px' }}
                >
                  Send Note
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 sm:gap-6 mb-6 border-b border-slate/20">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 sm:flex-none pb-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2
                     ${activeTab === 'posts'
                       ? 'text-cream border-accent'
                       : 'text-muted border-transparent hover:text-cream'
                     }`}
        >
          <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
            <FileText size={16} />
            <span>Posts</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`flex-1 sm:flex-none pb-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2
                     ${activeTab === 'about'
                       ? 'text-cream border-accent'
                       : 'text-muted border-transparent hover:text-cream'
                     }`}
        >
          <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
            <User size={16} />
            <span>About</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex-1 sm:flex-none pb-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2
                     ${activeTab === 'rooms'
                       ? 'text-cream border-accent'
                       : 'text-muted border-transparent hover:text-cream'
                     }`}
        >
          <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
            <DoorOpen size={16} />
            <span>Rooms</span>
          </div>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          {posts.length > 0 ? (
            posts.map((post) => (
              <PostCard 
                key={post.id} 
                post={post}
                onLikeToggle={(postId, liked) => {
                  setPosts(prev => prev.map(p => 
                    p.id === postId 
                      ? { ...p, is_liked: liked, like_count: liked ? p.like_count + 1 : p.like_count - 1 }
                      : p
                  ))
                }}
              />
            ))
          ) : (
            <ProfilePostsEmpty />
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div 
          className="p-6 space-y-6"
          style={{ 
            backgroundColor: '#131929',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px'
          }}
        >
          {/* Study Style */}
          <div className="flex items-start gap-4">
            <div className="p-2 bg-slate/30 rounded">
              <BookOpen size={20} className="text-accent" />
            </div>
            <div>
              <h3 className="text-cream font-medium mb-1">Study Style</h3>
              <p className="text-muted text-sm">
                {studyStyleLabel || 'Not specified'}
              </p>
            </div>
          </div>

          {/* Availability */}
          <div className="flex items-start gap-4">
            <div className="p-2 bg-slate/30 rounded">
              <Clock size={20} className="text-accent" />
            </div>
            <div>
              <h3 className="text-cream font-medium mb-1">Availability</h3>
              <p className="text-muted text-sm">
                {availabilityLabel || 'Not specified'}
              </p>
            </div>
          </div>

          {/* Goals */}
          {profile.goals && (
            <div className="flex items-start gap-4">
              <div className="p-2 bg-slate/30 rounded">
                <Target size={20} className="text-accent" />
              </div>
              <div>
                <h3 className="text-cream font-medium mb-1">Goals</h3>
                <p className="text-muted text-sm">{profile.goals}</p>
              </div>
            </div>
          )}

          {/* Looking For */}
          {profile.looking_for && (
            <div className="flex items-start gap-4">
              <div className="p-2 bg-slate/30 rounded">
                <Users size={20} className="text-accent" />
              </div>
              <div>
                <h3 className="text-cream font-medium mb-1">Looking For</h3>
                <p className="text-muted text-sm">{profile.looking_for}</p>
              </div>
            </div>
          )}

          {!studyStyleLabel && !availabilityLabel && !profile.goals && !profile.looking_for && (
            <p className="text-muted text-center py-4">
              No additional information provided.
            </p>
          )}
        </div>
      )}

      {activeTab === 'rooms' && (
        <div>
          {rooms.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  isMember={true}
                  onJoin={() => {}}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="rooms"
              message="Not a member of any rooms yet."
            />
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 15, 30, 0.9)' }}
        >
          <div 
            className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            style={{ 
              backgroundColor: '#131929',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading text-xl text-cream font-semibold">Edit Profile</h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setAvatarFile(null)
                  setAvatarPreview(null)
                }}
                className="p-1 text-muted hover:text-cream transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-slate overflow-hidden">
                    {avatarPreview || profile.avatar_url ? (
                      <img 
                        src={avatarPreview || profile.avatar_url} 
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted">
                        <User size={24} />
                      </div>
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 p-1.5 bg-accent text-navy 
                                  rounded-full cursor-pointer hover:opacity-90 transition-opacity">
                    <Camera size={12} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarChange}
                      className="hidden" 
                    />
                  </label>
                </div>
                <div className="text-sm text-muted">
                  Click to upload a new photo
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-cream text-sm mb-2">Display Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-transparent border border-slate/50 text-cream 
                           placeholder-muted text-sm focus:outline-none focus:border-accent/50"
                  style={{ borderRadius: '4px' }}
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-cream text-sm mb-2">Username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="e.g. john_doe"
                    maxLength={30}
                    className="w-full px-3 py-2 pr-9 bg-transparent border border-slate/50 text-cream 
                             placeholder-muted text-sm focus:outline-none focus:border-accent/50"
                    style={{ borderRadius: '4px' }}
                  />
                  {editForm.username.trim().length >= 3 && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      {checkingUsername ? (
                        <Loader2 size={14} className="text-muted animate-spin" />
                      ) : usernameAvailable === true ? (
                        <Check size={14} className="text-accent" />
                      ) : usernameAvailable === false ? (
                        <X size={14} className="text-[#E57373]" />
                      ) : null}
                    </span>
                  )}
                </div>
                <p className="text-muted/60 text-xs mt-1">
                  Letters, numbers, max one dot (.) and one underscore (_)
                </p>
                {usernameError && (
                  <p className="text-[#E57373] text-xs mt-1">{usernameError}</p>
                )}
              </div>

              {/* University */}
              <div>
                <label className="block text-cream text-sm mb-2">University</label>
                <input
                  type="text"
                  value={editForm.university}
                  onChange={(e) => setEditForm(prev => ({ ...prev, university: e.target.value }))}
                  placeholder="Your university or institution"
                  className="w-full px-3 py-2 bg-transparent border border-slate/50 text-cream 
                           placeholder-muted text-sm focus:outline-none focus:border-accent/50"
                  style={{ borderRadius: '4px' }}
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-cream text-sm mb-2">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell others about yourself..."
                  rows={3}
                  className="w-full px-3 py-2 bg-transparent border border-slate/50 text-cream 
                           placeholder-muted text-sm resize-none
                           focus:outline-none focus:border-accent/50"
                  style={{ borderRadius: '4px' }}
                  maxLength={300}
                />
              </div>

              {/* Subjects */}
              <div>
                <label className="block text-cream text-sm mb-2">Subjects</label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      className={`px-3 py-1.5 text-xs border transition-all duration-200
                                 ${editForm.subjects.includes(subject)
                                   ? 'border-accent bg-accent/20 text-accent'
                                   : 'border-slate/50 text-muted hover:text-cream'
                                 }`}
                      style={{ borderRadius: '12px' }}
                    >
                      {subject}
                    </button>
                  ))}
                </div>
              </div>

              {/* Study Style */}
              <div>
                <label className="block text-cream text-sm mb-2">Study Style</label>
                <div className="relative">
                  <select
                    value={editForm.study_style}
                    onChange={(e) => setEditForm(prev => ({ ...prev, study_style: e.target.value }))}
                    className="w-full appearance-none bg-transparent border border-slate/50 text-cream 
                             px-3 py-2 pr-8 text-sm focus:outline-none focus:border-accent/50"
                    style={{ borderRadius: '4px' }}
                  >
                    <option value="" className="bg-navy">Select study style</option>
                    {STUDY_STYLES.map(s => (
                      <option key={s.value} value={s.value} className="bg-navy">{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>

              {/* Availability */}
              <div>
                <label className="block text-cream text-sm mb-2">Availability</label>
                <div className="relative">
                  <select
                    value={editForm.availability}
                    onChange={(e) => setEditForm(prev => ({ ...prev, availability: e.target.value }))}
                    className="w-full appearance-none bg-transparent border border-slate/50 text-cream 
                             px-3 py-2 pr-8 text-sm focus:outline-none focus:border-accent/50"
                    style={{ borderRadius: '4px' }}
                  >
                    <option value="" className="bg-navy">Select availability</option>
                    {AVAILABILITY.map(a => (
                      <option key={a.value} value={a.value} className="bg-navy">{a.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>

              {/* Looking For */}
              <div>
                <label className="block text-cream text-sm mb-2">Looking For</label>
                <textarea
                  value={editForm.looking_for}
                  onChange={(e) => setEditForm(prev => ({ ...prev, looking_for: e.target.value }))}
                  placeholder="What kind of study mate are you looking for?"
                  rows={2}
                  className="w-full px-3 py-2 bg-transparent border border-slate/50 text-cream 
                           placeholder-muted text-sm resize-none
                           focus:outline-none focus:border-accent/50"
                  style={{ borderRadius: '4px' }}
                  maxLength={200}
                />
              </div>

              {/* Goals */}
              <div>
                <label className="block text-cream text-sm mb-2">Study Goals</label>
                <textarea
                  value={editForm.goals}
                  onChange={(e) => setEditForm(prev => ({ ...prev, goals: e.target.value }))}
                  placeholder="What are your study goals?"
                  rows={2}
                  className="w-full px-3 py-2 bg-transparent border border-slate/50 text-cream 
                           placeholder-muted text-sm resize-none
                           focus:outline-none focus:border-accent/50"
                  style={{ borderRadius: '4px' }}
                  maxLength={200}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setAvatarFile(null)
                  setAvatarPreview(null)
                }}
                className="flex-1 py-2.5 bg-transparent border border-slate/50 text-muted 
                         text-sm hover:text-cream hover:border-cream/30 transition-all"
                style={{ borderRadius: '4px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 py-2.5 bg-accent text-navy font-medium text-sm 
                         hover:opacity-90 transition-opacity
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
                style={{ borderRadius: '4px' }}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
