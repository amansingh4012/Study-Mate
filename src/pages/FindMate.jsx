import { useState, useEffect } from 'react'
import { X, ChevronDown, Loader2, Check, XCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { logActivity } from '../lib/activity'
import MateCard from '../components/ui/MateCard'
import { MateCardSkeleton } from '../components/ui/Skeletons'
import { FindMateEmpty } from '../components/ui/EmptyState'
import ErrorBoundary from '../components/layout/ErrorBoundary'

const SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
  'Economics', 'Psychology', 'History', 'Literature', 'Philosophy'
]

const STUDY_STYLES = [
  { value: 'quiet', label: 'Quiet focused' },
  { value: 'collaborative', label: 'Collaborative' },
  { value: 'mixed', label: 'Mixed style' }
]

const AVAILABILITY = [
  { value: 'mornings', label: 'Mornings' },
  { value: 'afternoons', label: 'Afternoons' },
  { value: 'evenings', label: 'Evenings' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'flexible', label: 'Flexible' }
]

export default function FindMate() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('browse') // 'browse' | 'requests'
  
  // Browse state
  const [mates, setMates] = useState([])
  const [loading, setLoading] = useState(true)
  const [connections, setConnections] = useState({}) // { mateId: 'connected' | 'pending' }
  
  // Filters
  const [subjectFilter, setSubjectFilter] = useState('')
  const [studyStyleFilter, setStudyStyleFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('')
  
  // Modal state
  const [showSendNoteModal, setShowSendNoteModal] = useState(false)
  const [selectedMate, setSelectedMate] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [noteSubject, setNoteSubject] = useState('')
  const [sendingNote, setSendingNote] = useState(false)
  
  // Requests state
  const [sentRequests, setSentRequests] = useState([])
  const [receivedRequests, setReceivedRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(true)

  // User's subjects for the note modal
  const [userSubjects, setUserSubjects] = useState([])

  // Fetch user profile
  useEffect(() => {
    if (!user) return
    
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('subjects')
        .eq('id', user.id)
        .single()
      
      if (data?.subjects) setUserSubjects(data.subjects)
    }
    
    fetchProfile()
  }, [user])

  // Fetch mates and connections
  useEffect(() => {
    if (!user) return
    fetchMates()
    fetchConnections()
  }, [user, subjectFilter, studyStyleFilter, availabilityFilter])

  // Fetch requests when tab changes
  useEffect(() => {
    if (activeTab === 'requests' && user) {
      fetchRequests()
    }
  }, [activeTab, user])

  const fetchMates = async () => {
    setLoading(true)
    
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (subjectFilter) {
        query = query.contains('subjects', [subjectFilter])
      }
      
      if (studyStyleFilter) {
        query = query.eq('study_style', studyStyleFilter)
      }
      
      if (availabilityFilter) {
        query = query.eq('availability', availabilityFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setMates(data || [])
    } catch (error) {
      console.error('Error fetching mates:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchConnections = async () => {
    if (!user) return

    // Fetch existing connections
    const { data: connData } = await supabase
      .from('connections')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

    // Fetch pending requests
    const { data: reqData } = await supabase
      .from('mate_requests')
      .select('to_user')
      .eq('from_user', user.id)
      .eq('status', 'pending')

    const connMap = {}
    
    connData?.forEach(conn => {
      const otherId = conn.user1_id === user.id ? conn.user2_id : conn.user1_id
      connMap[otherId] = 'connected'
    })
    
    reqData?.forEach(req => {
      if (!connMap[req.to_user]) {
        connMap[req.to_user] = 'pending'
      }
    })

    setConnections(connMap)
  }

  const fetchRequests = async () => {
    setLoadingRequests(true)
    
    try {
      // Sent requests
      const { data: sent } = await supabase
        .from('mate_requests')
        .select(`
          *,
          to_profile:profiles!mate_requests_to_user_fkey(id, full_name, avatar_url)
        `)
        .eq('from_user', user.id)
        .order('created_at', { ascending: false })

      // Received requests
      const { data: received } = await supabase
        .from('mate_requests')
        .select(`
          *,
          from_profile:profiles!mate_requests_from_user_fkey(id, full_name, avatar_url)
        `)
        .eq('to_user', user.id)
        .order('created_at', { ascending: false })

      setSentRequests(sent || [])
      setReceivedRequests(received || [])
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoadingRequests(false)
    }
  }

  const handleSendNote = (mate) => {
    setSelectedMate(mate)
    setNoteText('')
    setNoteSubject(userSubjects[0] || '')
    setShowSendNoteModal(true)
  }

  const submitNote = async () => {
    if (!selectedMate || !noteText.trim()) return
    
    setSendingNote(true)
    
    try {
      const { error } = await supabase
        .from('mate_requests')
        .insert({
          from_user: user.id,
          to_user: selectedMate.id,
          note: noteText.trim(),
          subject: noteSubject || null,
          status: 'pending'
        })

      if (error) throw error

      // Create notification for the recipient
      const senderName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone'
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedMate.id,
          type: 'mate_request',
          title: `${senderName} wants to connect`,
          message: noteText.trim().slice(0, 100),
          link: '/find-mate'
        })

      // Update local connections state
      setConnections(prev => ({
        ...prev,
        [selectedMate.id]: 'pending'
      }))

      setShowSendNoteModal(false)
      setSelectedMate(null)
    } catch (error) {
      console.error('Error sending note:', error)
      alert('Failed to send note. Please try again.')
    } finally {
      setSendingNote(false)
    }
  }

  const handleAcceptRequest = async (requestId, fromUserId) => {
    try {
      // Update request status
      await supabase
        .from('mate_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)

      // Create connection
      await supabase
        .from('connections')
        .insert({
          user1_id: fromUserId,
          user2_id: user.id
        })

      // Log activity for streak
      logActivity(user.id, 'connection')

      // Create notification for the requester
      const accepterName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone'
      await supabase
        .from('notifications')
        .insert({
          user_id: fromUserId,
          type: 'mate_accepted',
          title: `${accepterName} accepted your request`,
          message: 'You are now connected! Start a conversation.',
          link: '/messages'
        })

      // Refresh requests
      fetchRequests()
      fetchConnections()
    } catch (error) {
      console.error('Error accepting request:', error)
    }
  }

  const handleDeclineRequest = async (requestId) => {
    try {
      await supabase
        .from('mate_requests')
        .update({ status: 'declined' })
        .eq('id', requestId)

      fetchRequests()
    } catch (error) {
      console.error('Error declining request:', error)
    }
  }

  const resetFilters = () => {
    setSubjectFilter('')
    setStudyStyleFilter('')
    setAvailabilityFilter('')
  }

  const hasActiveFilters = subjectFilter || studyStyleFilter || availabilityFilter

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl text-cream font-bold mb-2">
          Find Your Study Mate
        </h1>
        <p className="text-muted text-lg">
          Connect with students who share your interests and study habits.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2 text-sm font-medium transition-all duration-200
                     ${activeTab === 'browse'
                       ? 'text-cream border-b-2 border-accent'
                       : 'text-muted hover:text-cream'
                     }`}
        >
          Browse Mates
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 text-sm font-medium transition-all duration-200 relative
                     ${activeTab === 'requests'
                       ? 'text-cream border-b-2 border-accent'
                       : 'text-muted hover:text-cream'
                     }`}
        >
          My Requests
          {receivedRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-navy text-[10px] 
                           font-bold rounded-full flex items-center justify-center">
              {receivedRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'browse' ? (
        <>
          {/* Filters */}
          <div 
            className="flex gap-3 items-center mb-6 p-4 overflow-x-auto scrollbar-hide"
            style={{ 
              backgroundColor: '#131929',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px'
            }}
          >
            {/* Subject dropdown */}
            <div className="relative flex-shrink-0">
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="appearance-none bg-transparent border border-slate/50 text-cream 
                         px-3 py-2 pr-8 text-sm focus:outline-none focus:border-accent/50
                         cursor-pointer"
                style={{ borderRadius: '4px', minWidth: '140px' }}
              >
                <option value="" className="bg-navy">All Subjects</option>
                {SUBJECTS.map(s => (
                  <option key={s} value={s} className="bg-navy">{s}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            {/* Study style dropdown */}
            <div className="relative flex-shrink-0">
              <select
                value={studyStyleFilter}
                onChange={(e) => setStudyStyleFilter(e.target.value)}
                className="appearance-none bg-transparent border border-slate/50 text-cream 
                         px-3 py-2 pr-8 text-sm focus:outline-none focus:border-accent/50
                         cursor-pointer"
                style={{ borderRadius: '4px', minWidth: '140px' }}
              >
                <option value="" className="bg-navy">Any Study Style</option>
                {STUDY_STYLES.map(s => (
                  <option key={s.value} value={s.value} className="bg-navy">{s.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            {/* Availability dropdown */}
            <div className="relative flex-shrink-0">
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="appearance-none bg-transparent border border-slate/50 text-cream 
                         px-3 py-2 pr-8 text-sm focus:outline-none focus:border-accent/50
                         cursor-pointer"
                style={{ borderRadius: '4px', minWidth: '140px' }}
              >
                <option value="" className="bg-navy">Any Availability</option>
                {AVAILABILITY.map(a => (
                  <option key={a.value} value={a.value} className="bg-navy">{a.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            {/* Reset */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 text-sm text-muted hover:text-cream transition-colors flex-shrink-0"
              >
                Reset
              </button>
            )}
          </div>

          {/* Mates Grid */}
          {loading ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <MateCardSkeleton key={i} />
              ))}
            </div>
          ) : mates.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {mates.map((mate) => (
                <MateCard
                  key={mate.id}
                  mate={mate}
                  connectionStatus={connections[mate.id] || null}
                  onSendNote={handleSendNote}
                />
              ))}
            </div>
          ) : (
            <FindMateEmpty />
          )}
        </>
      ) : (
        /* My Requests Tab */
        <div className="space-y-8">
          {loadingRequests ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i}
                  className="p-4 animate-pulse"
                  style={{ 
                    backgroundColor: '#131929',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '6px'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate/50" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-slate/50 rounded mb-2" />
                      <div className="h-3 w-full bg-slate/30 rounded" />
                    </div>
                    <div className="h-8 w-20 bg-slate/30 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Received Requests */}
              <div>
                <h2 className="font-heading text-xl text-cream font-semibold mb-4">
                  Received Requests
                </h2>
                {receivedRequests.length > 0 ? (
                  <div className="space-y-3">
                    {receivedRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                        style={{ 
                          backgroundColor: '#131929',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px'
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-slate overflow-hidden flex-shrink-0">
                            {request.from_profile?.avatar_url ? (
                              <img 
                                src={request.from_profile.avatar_url} 
                                alt={request.from_profile.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted">
                                {request.from_profile?.full_name?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-cream font-medium">{request.from_profile?.full_name}</p>
                            <p className="text-muted text-sm truncate">{request.note}</p>
                            {request.subject && (
                              <p className="text-accent text-xs mt-1">Wants to study: {request.subject}</p>
                            )}
                          </div>
                        </div>
                        
                        {request.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptRequest(request.id, request.from_user)}
                              className="px-4 py-2 bg-accent text-navy text-sm font-medium
                                       hover:opacity-90 transition-opacity"
                              style={{ borderRadius: '4px' }}
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeclineRequest(request.id)}
                              className="px-4 py-2 bg-transparent border border-slate/50 text-muted 
                                       text-sm hover:text-cream hover:border-cream/30 transition-all"
                              style={{ borderRadius: '4px' }}
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span className={`text-sm px-3 py-1 rounded-full
                                          ${request.status === 'accepted' 
                                            ? 'bg-accent/20 text-accent' 
                                            : 'bg-slate/30 text-muted'}`}>
                            {request.status === 'accepted' ? 'Accepted' : 'Declined'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div 
                    className="text-center py-8"
                    style={{ 
                      backgroundColor: '#131929',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '6px'
                    }}
                  >
                    <p className="text-muted">No requests received yet.</p>
                  </div>
                )}
              </div>

              {/* Sent Requests */}
              <div>
                <h2 className="font-heading text-xl text-cream font-semibold mb-4">
                  Sent Requests
                </h2>
                {sentRequests.length > 0 ? (
                  <div className="space-y-3">
                    {sentRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                        style={{ 
                          backgroundColor: '#131929',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px'
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-slate overflow-hidden flex-shrink-0">
                            {request.to_profile?.avatar_url ? (
                              <img 
                                src={request.to_profile.avatar_url} 
                                alt={request.to_profile.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted">
                                {request.to_profile?.full_name?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-cream font-medium">{request.to_profile?.full_name}</p>
                            <p className="text-muted text-sm truncate">{request.note}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {request.status === 'pending' && (
                            <Clock size={14} className="text-muted" />
                          )}
                          {request.status === 'accepted' && (
                            <Check size={14} className="text-accent" />
                          )}
                          {request.status === 'declined' && (
                            <XCircle size={14} className="text-red-400" />
                          )}
                          <span className={`text-sm capitalize
                                          ${request.status === 'accepted' ? 'text-accent' : 
                                            request.status === 'declined' ? 'text-red-400' : 'text-muted'}`}>
                            {request.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div 
                    className="text-center py-8"
                    style={{ 
                      backgroundColor: '#131929',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '6px'
                    }}
                  >
                    <p className="text-muted">You haven't sent any requests yet.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Send Note Modal */}
      {showSendNoteModal && selectedMate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 15, 30, 0.9)' }}
        >
          <div 
            className="w-full max-w-md p-6"
            style={{ 
              backgroundColor: '#131929',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading text-xl text-cream font-semibold">Send Note</h3>
              <button
                onClick={() => setShowSendNoteModal(false)}
                className="p-1 text-muted hover:text-cream transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Recipient */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-slate overflow-hidden">
                {selectedMate.avatar_url ? (
                  <img 
                    src={selectedMate.avatar_url} 
                    alt={selectedMate.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    {selectedMate.full_name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <div>
                <p className="text-cream font-medium">{selectedMate.full_name}</p>
                {selectedMate.university && (
                  <p className="text-muted text-xs">{selectedMate.university}</p>
                )}
              </div>
            </div>

            {/* Subject dropdown */}
            {userSubjects.length > 0 && (
              <div className="mb-4">
                <label className="block text-cream text-sm mb-2">
                  I'm studying
                </label>
                <div className="relative">
                  <select
                    value={noteSubject}
                    onChange={(e) => setNoteSubject(e.target.value)}
                    className="w-full appearance-none bg-transparent border border-slate/50 text-cream 
                             px-3 py-2 pr-8 text-sm focus:outline-none focus:border-accent/50"
                    style={{ borderRadius: '4px' }}
                  >
                    <option value="" className="bg-navy">Select a subject</option>
                    {userSubjects.map(s => (
                      <option key={s} value={s} className="bg-navy">{s}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>
            )}

            {/* Note textarea */}
            <div className="mb-6">
              <label className="block text-cream text-sm mb-2">
                Introduce yourself
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value.slice(0, 280))}
                placeholder="Share why you'd like to study together..."
                className="w-full h-28 px-3 py-2 bg-transparent border border-slate/50 text-cream 
                         placeholder-muted text-sm resize-none
                         focus:outline-none focus:border-accent/50"
                style={{ borderRadius: '4px' }}
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${noteText.length >= 280 ? 'text-red-400' : 'text-muted'}`}>
                  {noteText.length}/280
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSendNoteModal(false)}
                className="flex-1 py-2.5 bg-transparent border border-slate/50 text-muted 
                         text-sm hover:text-cream hover:border-cream/30 transition-all"
                style={{ borderRadius: '4px' }}
              >
                Cancel
              </button>
              <button
                onClick={submitNote}
                disabled={!noteText.trim() || sendingNote}
                className="flex-1 py-2.5 bg-accent text-navy font-medium text-sm 
                         hover:opacity-90 transition-opacity
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
                style={{ borderRadius: '4px' }}
              >
                {sendingNote ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Note'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
