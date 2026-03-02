import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Radio, Users, Clock, Bell, Play, X, ChevronDown, 
  Calendar, Loader2, BookOpen, Beaker, Code, PenTool,
  Briefcase, Calculator, Languages, Brain
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { SessionCardSkeleton } from '../components/ui/Skeletons'
import { SessionsEmpty } from '../components/ui/EmptyState'
import ErrorBoundary from '../components/layout/ErrorBoundary'

const SUBJECT_ICONS = {
  'CS & Dev': Code,
  'Design': PenTool,
  'Science': Beaker,
  'Medicine': Brain,
  'Business': Briefcase,
  'Math': Calculator,
  'Languages': Languages,
  'Other': BookOpen
}

const SUBJECTS = [
  'CS & Dev', 'Design', 'Science', 'Medicine', 
  'Business', 'Math', 'Languages', 'Other'
]

const CHAT_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'followers', label: 'Followers only' },
  { value: 'disabled', label: 'Off' }
]

export default function Sessions() {
  const { user } = useAuth()
  
  const [liveSessions, setLiveSessions] = useState([])
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [reminders, setReminders] = useState([])
  
  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newSession, setNewSession] = useState({
    title: '',
    subject: 'CS & Dev',
    description: '',
    schedule_type: 'now',
    scheduled_at: '',
    allow_guests: true,
    chat_control: 'everyone'
  })

  useEffect(() => {
    if (!user) return
    fetchSessions()
    fetchReminders()
  }, [user])

  const fetchSessions = async () => {
    setLoading(true)
    
    try {
      // Live sessions
      const { data: live } = await supabase
        .from('sessions')
        .select(`
          *,
          host:profiles!sessions_host_id_fkey(id, full_name, avatar_url)
        `)
        .eq('status', 'live')
        .order('viewer_count', { ascending: false })
        .limit(6)

      // Upcoming sessions
      const { data: upcoming } = await supabase
        .from('sessions')
        .select(`
          *,
          host:profiles!sessions_host_id_fkey(id, full_name, avatar_url)
        `)
        .eq('status', 'upcoming')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(8)

      // Recent sessions
      const { data: recent } = await supabase
        .from('sessions')
        .select(`
          *,
          host:profiles!sessions_host_id_fkey(id, full_name, avatar_url)
        `)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false })
        .limit(4)

      setLiveSessions(live || [])
      setUpcomingSessions(upcoming || [])
      setRecentSessions(recent || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReminders = async () => {
    const { data } = await supabase
      .from('session_reminders')
      .select('session_id')
      .eq('user_id', user.id)

    if (data) {
      setReminders(data.map(r => r.session_id))
    }
  }

  const toggleReminder = async (sessionId) => {
    const hasReminder = reminders.includes(sessionId)
    
    try {
      if (hasReminder) {
        await supabase
          .from('session_reminders')
          .delete()
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
        
        setReminders(prev => prev.filter(id => id !== sessionId))
      } else {
        await supabase
          .from('session_reminders')
          .insert({
            session_id: sessionId,
            user_id: user.id
          })
        
        setReminders(prev => [...prev, sessionId])
      }
    } catch (error) {
      console.error('Error toggling reminder:', error)
    }
  }

  const handleCreateSession = async () => {
    if (!newSession.title.trim()) return
    
    setCreating(true)
    
    try {
      const sessionData = {
        title: newSession.title.trim(),
        subject: newSession.subject,
        description: newSession.description.trim() || null,
        host_id: user.id,
        allow_guests: newSession.allow_guests,
        chat_control: newSession.chat_control,
        viewer_count: 0
      }

      const isGoingLive = newSession.schedule_type === 'now'
      
      if (isGoingLive) {
        sessionData.status = 'live'
        sessionData.started_at = new Date().toISOString()
      } else {
        sessionData.status = 'upcoming'
        sessionData.scheduled_at = newSession.scheduled_at
      }

      const { data, error } = await supabase
        .from('sessions')
        .insert(sessionData)
        .select()
        .single()

      if (error) throw error

      // Notify connections when going live
      if (isGoingLive) {
        const hostName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone'
        
        // Fetch connections
        const { data: connections } = await supabase
          .from('connections')
          .select('user1_id, user2_id')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        
        if (connections && connections.length > 0) {
          const notificationInserts = connections.map(conn => ({
            user_id: conn.user1_id === user.id ? conn.user2_id : conn.user1_id,
            type: 'session_live',
            title: `${hostName} is now live!`,
            message: newSession.title.trim(),
            link: `/sessions/${data.id}`
          }))
          
          await supabase.from('notifications').insert(notificationInserts)
        }
      }

      setShowCreateModal(false)
      setNewSession({
        title: '',
        subject: 'CS & Dev',
        description: '',
        schedule_type: 'now',
        scheduled_at: '',
        allow_guests: true,
        chat_control: 'everyone'
      })
      
      if (isGoingLive) {
        window.location.href = `/sessions/${data.id}`
      } else {
        fetchSessions()
      }
    } catch (error) {
      console.error('Error creating session:', error)
      alert('Failed to create session. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const formatScheduledTime = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = date - now
    
    if (diff < 60 * 60 * 1000) {
      return `In ${Math.round(diff / 60000)} min`
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  const SubjectIcon = ({ subject, size = 32 }) => {
    const Icon = SUBJECT_ICONS[subject] || BookOpen
    return <Icon size={size} className="text-muted" />
  }

  if (loading) {
    return (
      <div className="fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-cream font-bold mb-2">
              Live Sessions
            </h1>
            <p className="text-muted text-lg">
              Real-time study sessions with your mates
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl text-cream font-bold mb-2">
            Live Sessions
          </h1>
          <p className="text-muted text-lg">
            Real-time study sessions with your mates
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-navy 
                   font-bold text-sm hover:opacity-90 transition-opacity self-start"
          style={{ borderRadius: '4px' }}
        >
          <Radio size={18} />
          Go Live
        </button>
      </div>

      {/* Live Now Section */}
      {liveSessions.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <h2 className="font-heading text-xl text-cream font-semibold">
              Live Now
            </h2>
          </div>
          
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {liveSessions.slice(0, 3).map((session) => (
              <LiveSessionCard 
                key={session.id} 
                session={session} 
                SubjectIcon={SubjectIcon}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <section className="mb-10">
          <h2 className="font-heading text-xl text-cream font-semibold mb-4">
            Upcoming
          </h2>
          
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {upcomingSessions.map((session) => (
              <UpcomingSessionCard
                key={session.id}
                session={session}
                hasReminder={reminders.includes(session.id)}
                onToggleReminder={() => toggleReminder(session.id)}
                formatTime={formatScheduledTime}
                SubjectIcon={SubjectIcon}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <section>
          <h2 className="font-heading text-xl text-cream font-semibold mb-4">
            Recent
          </h2>
          
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recentSessions.map((session) => (
              <RecentSessionCard
                key={session.id}
                session={session}
                SubjectIcon={SubjectIcon}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {liveSessions.length === 0 && upcomingSessions.length === 0 && recentSessions.length === 0 && (
        <SessionsEmpty onCreate={() => setShowCreateModal(true)} />
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
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
              <h3 className="font-heading text-xl text-cream font-semibold">Go Live</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-muted hover:text-cream transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-cream text-sm mb-2">
                  Session Title *
                </label>
                <input
                  type="text"
                  value={newSession.title}
                  onChange={(e) => setNewSession(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., JavaScript Basics Q&A"
                  className="w-full px-3 py-2 bg-transparent border border-slate/50 text-cream 
                           placeholder-muted text-sm focus:outline-none focus:border-accent/50"
                  style={{ borderRadius: '4px' }}
                  maxLength={80}
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-cream text-sm mb-2">
                  Subject/Topic
                </label>
                <div className="relative">
                  <select
                    value={newSession.subject}
                    onChange={(e) => setNewSession(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full appearance-none bg-transparent border border-slate/50 text-cream 
                             px-3 py-2 pr-8 text-sm focus:outline-none focus:border-accent/50"
                    style={{ borderRadius: '4px' }}
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s} className="bg-navy">{s}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-cream text-sm mb-2">
                  Description
                </label>
                <textarea
                  value={newSession.description}
                  onChange={(e) => setNewSession(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What will you cover in this session?"
                  className="w-full h-20 px-3 py-2 bg-transparent border border-slate/50 text-cream 
                           placeholder-muted text-sm resize-none
                           focus:outline-none focus:border-accent/50"
                  style={{ borderRadius: '4px' }}
                  maxLength={300}
                />
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-cream text-sm mb-2">
                  When
                </label>
                <div className="flex gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setNewSession(prev => ({ ...prev, schedule_type: 'now' }))}
                    className={`flex-1 py-2 text-sm border transition-all duration-200
                               ${newSession.schedule_type === 'now'
                                 ? 'border-accent text-accent bg-accent/10'
                                 : 'border-slate/50 text-muted hover:text-cream'
                               }`}
                    style={{ borderRadius: '4px' }}
                  >
                    Start Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSession(prev => ({ ...prev, schedule_type: 'later' }))}
                    className={`flex-1 py-2 text-sm border transition-all duration-200
                               ${newSession.schedule_type === 'later'
                                 ? 'border-accent text-accent bg-accent/10'
                                 : 'border-slate/50 text-muted hover:text-cream'
                               }`}
                    style={{ borderRadius: '4px' }}
                  >
                    Schedule
                  </button>
                </div>
                
                {newSession.schedule_type === 'later' && (
                  <input
                    type="datetime-local"
                    value={newSession.scheduled_at}
                    onChange={(e) => setNewSession(prev => ({ ...prev, scheduled_at: e.target.value }))}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 bg-transparent border border-slate/50 text-cream 
                             text-sm focus:outline-none focus:border-accent/50"
                    style={{ borderRadius: '4px' }}
                  />
                )}
              </div>

              {/* Allow joining */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-cream text-sm">Allow friends to join with cam</p>
                  <p className="text-muted text-xs">Let others participate in your session</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewSession(prev => ({ ...prev, allow_guests: !prev.allow_guests }))}
                  className={`w-12 h-6 rounded-full transition-colors duration-200 relative
                             ${newSession.allow_guests ? 'bg-accent' : 'bg-slate/50'}`}
                >
                  <span 
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                               ${newSession.allow_guests ? 'translate-x-7' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              {/* Chat mode */}
              <div>
                <label className="block text-cream text-sm mb-2">
                  Chat
                </label>
                <div className="relative">
                  <select
                    value={newSession.chat_control}
                    onChange={(e) => setNewSession(prev => ({ ...prev, chat_control: e.target.value }))}
                    className="w-full appearance-none bg-transparent border border-slate/50 text-cream 
                             px-3 py-2 pr-8 text-sm focus:outline-none focus:border-accent/50"
                    style={{ borderRadius: '4px' }}
                  >
                    {CHAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-navy">{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 bg-transparent border border-slate/50 text-muted 
                         text-sm hover:text-cream hover:border-cream/30 transition-all"
                style={{ borderRadius: '4px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!newSession.title.trim() || creating || 
                         (newSession.schedule_type === 'later' && !newSession.scheduled_at)}
                className="flex-1 py-2.5 bg-accent text-navy font-bold text-sm 
                         hover:opacity-90 transition-opacity
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
                style={{ borderRadius: '4px' }}
              >
                {creating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {newSession.schedule_type === 'now' ? 'Starting...' : 'Scheduling...'}
                  </>
                ) : (
                  newSession.schedule_type === 'now' ? 'Start Session' : 'Schedule'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Live Session Card Component
function LiveSessionCard({ session, SubjectIcon }) {
  return (
    <Link
      to={`/sessions/${session.id}`}
      className="block group"
    >
      <div 
        className="p-5"
        style={{ 
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px'
        }}
      >
        {/* Thumbnail */}
        <div 
          className="relative h-32 mb-4 flex items-center justify-center"
          style={{ 
            backgroundColor: '#0A0F1E',
            borderRadius: '4px'
          }}
        >
          <SubjectIcon subject={session.subject} size={48} />
          
          {/* Live badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-red-500/20">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-[10px] font-bold tracking-wider">LIVE</span>
          </div>
        </div>

        {/* Content */}
        <h3 className="font-heading text-cream font-bold mb-2 line-clamp-1 group-hover:text-accent transition-colors">
          {session.title}
        </h3>

        {/* Host */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-slate overflow-hidden">
            {session.host?.avatar_url ? (
              <img 
                src={session.host.avatar_url} 
                alt={session.host.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                {session.host?.full_name?.charAt(0) || '?'}
              </div>
            )}
          </div>
          <span className="text-muted text-sm">{session.host?.full_name}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span 
            className="px-2 py-0.5 text-xs border border-accent/40 text-accent"
            style={{ borderRadius: '10px' }}
          >
            {session.subject}
          </span>
          <div className="flex items-center gap-1.5 text-muted text-xs">
            <Users size={12} />
            <span>{session.viewer_count || 0} watching</span>
          </div>
        </div>

        {/* Join button */}
        <button
          className="w-full mt-4 py-2 bg-accent text-navy font-medium text-sm
                   transition-opacity hover:opacity-90"
          style={{ borderRadius: '4px' }}
        >
          Join
        </button>
      </div>
    </Link>
  )
}

// Upcoming Session Card Component
function UpcomingSessionCard({ session, hasReminder, onToggleReminder, formatTime, SubjectIcon }) {
  return (
    <div 
      className="p-4"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      {/* Thumbnail */}
      <div 
        className="relative h-24 mb-3 flex items-center justify-center"
        style={{ 
          backgroundColor: '#0A0F1E',
          borderRadius: '4px'
        }}
      >
        <SubjectIcon subject={session.subject} size={36} />
        
        {/* Scheduled badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-slate/30">
          <Clock size={10} className="text-muted" />
          <span className="text-muted text-[10px]">{formatTime(session.scheduled_at)}</span>
        </div>
      </div>

      <h3 className="font-heading text-cream font-bold text-sm mb-2 line-clamp-1">
        {session.title}
      </h3>

      {/* Host */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-slate overflow-hidden">
          {session.host?.avatar_url ? (
            <img 
              src={session.host.avatar_url} 
              alt={session.host.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">
              {session.host?.full_name?.charAt(0) || '?'}
            </div>
          )}
        </div>
        <span className="text-muted text-xs truncate">{session.host?.full_name}</span>
      </div>

      {/* Reminder button */}
      <button
        onClick={onToggleReminder}
        className={`w-full py-2 border text-sm transition-all duration-200
                   ${hasReminder 
                     ? 'border-accent text-accent bg-accent/10' 
                     : 'border-slate/50 text-muted hover:text-cream hover:border-cream/30'
                   }`}
        style={{ borderRadius: '4px' }}
      >
        <div className="flex items-center justify-center gap-1.5">
          <Bell size={14} />
          {hasReminder ? 'Reminder Set' : 'Set Reminder'}
        </div>
      </button>
    </div>
  )
}

// Recent Session Card Component
function RecentSessionCard({ session, SubjectIcon }) {
  return (
    <div 
      className="p-4 opacity-60"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      {/* Thumbnail */}
      <div 
        className="relative h-24 mb-3 flex items-center justify-center"
        style={{ 
          backgroundColor: '#0A0F1E',
          borderRadius: '4px'
        }}
      >
        <SubjectIcon subject={session.subject} size={36} />
        
        <div className="absolute top-2 left-2 px-2 py-1 bg-slate/30">
          <span className="text-muted text-[10px]">Ended</span>
        </div>
      </div>

      <h3 className="font-heading text-cream font-bold text-sm mb-2 line-clamp-1">
        {session.title}
      </h3>

      {/* Host */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-slate overflow-hidden">
          {session.host?.avatar_url ? (
            <img 
              src={session.host.avatar_url} 
              alt={session.host.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">
              {session.host?.full_name?.charAt(0) || '?'}
            </div>
          )}
        </div>
        <span className="text-muted text-xs truncate">{session.host?.full_name}</span>
      </div>
    </div>
  )
}
