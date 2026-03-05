/**
 * SessionRoom.jsx — Live session room with Agora video and chat
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  ArrowLeft, Users, Video, VideoOff, 
  Send, Loader2, LogOut, UserPlus, Radio, X, Crown, MessageCircle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { logActivity } from '../lib/activity'
import { SessionRoomSkeleton } from '../components/ui/Skeletons'
import ErrorBoundary from '../components/layout/ErrorBoundary'
import useAgora, { uuidToAgoraUid } from '../hooks/useAgora'
import VideoGrid from '../components/ui/VideoGrid'
import VideoControls from '../components/ui/VideoControls'

export default function SessionRoom() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewers, setViewers] = useState([])
  const [showViewerList, setShowViewerList] = useState(false)
  const [pinnedUid, setPinnedUid] = useState(null)
  
  // Chat state
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showChat, setShowChat] = useState(false)
  
  const messagesEndRef = useRef(null)
  const presenceChannelRef = useRef(null)
  const isHost = session?.host_id === user?.id

  // Agora hook
  const {
    joined: agoraJoined,
    joining: agoraJoining,
    join: agoraJoin,
    leave: agoraLeave,
    startPublishing,
    stopPublishing,
    isPublishing,
    toggleCamera,
    flipCamera,
    isCamOn,
    localVideoTrack,
    remoteUsers,
  } = useAgora()

  // ─── Supabase Presence for live viewer tracking & name resolution ───
  // Each user broadcasts { user_id, full_name, avatar_url } when they join.
  // This replaces the fragile session_viewers DB approach for UI data.
  useEffect(() => {
    if (!sessionId || !user) return

    const channel = supabase.channel(`session-presence-${sessionId}`, {
      config: { presence: { key: user.id } },
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      // state = { [key]: [{ user_id, full_name, avatar_url, ... }], ... }
      const allViewers = Object.values(state)
        .flat()
        .map((p) => ({
          id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
        }))
      setViewers(allViewers)
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
          avatar_url: user.user_metadata?.avatar_url || null,
        })
      }
    })

    presenceChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      presenceChannelRef.current = null
    }
  }, [sessionId, user?.id])

  // Build Agora UID → name mapping from Presence viewers + host
  const remoteNames = Object.fromEntries([
    // Include the host so their name always resolves
    ...(session?.host ? [[uuidToAgoraUid(session.host.id), session.host.full_name]] : []),
    ...viewers.map((v) => [uuidToAgoraUid(v.id), v.full_name]),
  ])

  // Host auto-joins with video; viewers auto-join as spectators (no publishing)
  useEffect(() => {
    if (session && !agoraJoined && !agoraJoining) {
      if (isHost) {
        agoraJoin(`session-${sessionId}`, uuidToAgoraUid(user.id), { video: true })
      } else {
        // Viewers join channel without publishing so they can see the host's video
        agoraJoin(`session-${sessionId}`, uuidToAgoraUid(user.id), { video: false })
      }
    }
  }, [session, isHost])

  // Viewer publishes their own camera on "Join with Video"
  const [viewerInVideo, setViewerInVideo] = useState(false)

  const joinAsViewer = async () => {
    setViewerInVideo(true)
    await startPublishing()
  }

  const leaveVideoAsViewer = async () => {
    await stopPublishing()
    setViewerInVideo(false)
    setPinnedUid(null)
  }

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch session data
  useEffect(() => {
    if (!sessionId || !user) return
    
    fetchSession()
    fetchMessages()
    joinSession()

    return () => {
      leaveSession()
    }
  }, [sessionId, user])

  // Real-time chat subscription
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`session-chat-${sessionId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'session_messages',
          filter: `session_id=eq.${sessionId}`
        },
        async (payload) => {
          const { data } = await supabase
            .from('session_messages')
            .select(`
              *,
              author:profiles(id, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setMessages(prev => [...prev, data])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  // Real-time session status subscription — keeps session state in sync and
  // auto-kicks viewers when the host ends the session. Also handles the case
  // where a user lands on an "upcoming" session that then goes "live" — the
  // UI updates instantly without a page refresh.
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`session-status-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sessionId}`
        },
        async (payload) => {
          const updated = payload.new

          if (updated.status === 'ended') {
            // Leave Agora silently
            agoraLeave().catch(() => {})
            // Navigate everyone back
            navigate('/sessions')
            return
          }

          // For any other status change (upcoming → live, viewer_count, etc.)
          // merge the new fields into the existing session so UI reacts instantly.
          setSession(prev => {
            if (!prev) return prev
            return { ...prev, ...updated, host: prev.host }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const fetchSession = async () => {
    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          host:profiles!sessions_host_id_fkey(id, full_name, avatar_url)
        `)
        .eq('id', sessionId)
        .single()

      if (error) throw error
      
      if (data.status === 'ended') {
        navigate('/sessions')
        return
      }
      
      setSession(data)
    } catch (error) {
      console.error('Error fetching session:', error)
      navigate('/sessions')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('session_messages')
      .select(`
        *,
        author:profiles(id, full_name, avatar_url)
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) {
      setMessages(data)
    }
  }

  const joinSession = async () => {
    // Best-effort DB insert for viewer_count persistence
    try {
      await supabase
        .from('session_viewers')
        .upsert({
          session_id: sessionId,
          user_id: user.id
        }, { onConflict: 'session_id,user_id' })

      // Log activity for streak
      logActivity(user.id, 'session')
    } catch (e) {
      // Non-critical — Presence handles live UI
      console.warn('session_viewers insert failed (non-critical):', e)
    }
  }

  const leaveSession = async () => {
    // Leave Agora if joined
    if (agoraJoined) {
      await agoraLeave()
    }

    // Best-effort DB cleanup
    try {
      await supabase
        .from('session_viewers')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
    } catch (e) {
      console.warn('session_viewers delete failed (non-critical):', e)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return
    
    setSending(true)
    
    try {
      const { error } = await supabase
        .from('session_messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          content: newMessage.trim()
        })

      if (error) throw error
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const endSession = async () => {
    if (!confirm('Are you sure you want to end this session?')) return
    
    try {
      await supabase
        .from('sessions')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      navigate('/sessions')
    } catch (error) {
      console.error('Error ending session:', error)
    }
  }

  const handleLeave = () => {
    navigate('/sessions')
  }

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return <SessionRoomSkeleton />
  }

  if (!session) {
    return (
      <div className="fade-in text-center py-20">
        <p className="text-muted">Session not found.</p>
        <Link to="/sessions" className="text-accent hover:underline mt-2 inline-block">
          Back to Sessions
        </Link>
      </div>
    )
  }

  return (
    <div className="fade-in h-[calc(100vh-140px)] flex flex-col -mt-6">
      {/* Top bar */}
      <div 
        className="flex items-center justify-between gap-4 p-4 flex-shrink-0"
        style={{ 
          backgroundColor: '#131929',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/sessions"
            className="p-1.5 text-muted hover:text-cream transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-lg text-cream font-bold">
                {session.title}
              </h1>
              {session.status === 'live' && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-[10px] font-bold">LIVE</span>
                </div>
              )}
            </div>
            {session.description && (
              <p className="text-muted text-xs line-clamp-1 max-w-md">
                {session.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Chat toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-muted 
                     hover:text-cream transition-colors"
          >
            <MessageCircle size={16} />
            <span className="text-sm">Chat</span>
          </button>
          
          <button
            onClick={() => setShowViewerList(!showViewerList)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-muted 
                     hover:text-cream transition-colors text-sm"
          >
            <Users size={16} />
            <span>{viewers.length}</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Video area */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          {/* Video / Placeholder */}
          <div className="flex-1 min-h-0">
            {agoraJoined && (remoteUsers.some(u => u.hasVideo) || (isHost && isCamOn) || (viewerInVideo && isCamOn)) ? (
              /* Agora video grid — show local tile only if host or viewer with cam on */
              <div className="h-full">
                <VideoGrid
                  localVideoTrack={localVideoTrack}
                  localName={user?.user_metadata?.full_name || 'You'}
                  isCamOn={isCamOn}
                  remoteUsers={remoteUsers}
                  remoteNames={remoteNames}
                  pinnedUid={pinnedUid}
                  onPin={setPinnedUid}
                  showLocal={(isHost || viewerInVideo) && isCamOn}
                />
              </div>
            ) : agoraJoined ? (
              /* Connected but no one has video on */
              <div
                className="h-full flex flex-col items-center justify-center relative"
                style={{
                  backgroundColor: '#0A0F1E',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <p className="text-muted text-sm">Waiting for host to start video...</p>
              </div>
            ) : (
              /* Placeholder when not in Agora */
              <div
                className="h-full flex flex-col items-center justify-center relative"
                style={{
                  backgroundColor: '#0A0F1E',
                  borderRadius: '8px',
                  border:
                    session.status === 'live'
                      ? '2px solid #A8FF3E'
                      : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div
                  className={`relative w-32 h-32 rounded-full bg-slate overflow-hidden mb-4
                             ${session.status === 'live' ? 'ring-4 ring-accent/50 animate-pulse' : ''}`}
                >
                  {session.host?.avatar_url ? (
                    <img
                      src={session.host.avatar_url}
                      alt={session.host.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted text-4xl">
                      {session.host?.full_name?.charAt(0) || '?'}
                    </div>
                  )}
                </div>

                <p className="text-cream font-heading font-semibold text-lg">
                  {session.host?.full_name}
                </p>
                <p className="text-muted text-sm">
                  {agoraJoining ? 'Connecting...' : 'Host'}
                </p>
              </div>
            )}
          </div>

          {/* Bottom controls — overlaid on video */}
          <div 
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 p-3 z-10"
            style={{ 
              background: 'linear-gradient(transparent, rgba(10,15,30,0.85))'
            }}
          >
            {isHost ? (
              <>
                {agoraJoined && (
                  <VideoControls
                    isCamOn={isCamOn}
                    onToggleCam={toggleCamera}
                    onFlipCam={flipCamera}
                    onLeave={async () => {
                      await agoraLeave()
                    }}
                  />
                )}

                <button
                  onClick={endSession}
                  className="px-6 py-3 bg-red-500 text-white font-medium text-sm 
                           hover:bg-red-600 transition-colors rounded-full ml-4"
                >
                  End Session
                </button>
              </>
            ) : (
              <>
                {viewerInVideo ? (
                  <VideoControls
                    isCamOn={isCamOn}
                    onToggleCam={toggleCamera}
                    onFlipCam={flipCamera}
                    onLeave={leaveVideoAsViewer}
                  />
                ) : session.allow_guests ? (
                  <button
                    onClick={joinAsViewer}
                    disabled={!agoraJoined}
                    className="px-4 py-2.5 bg-accent/10 text-accent text-sm 
                             hover:bg-accent/20 transition-colors rounded
                             disabled:opacity-50"
                  >
                    {!agoraJoined ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> Connecting...
                      </span>
                    ) : (
                      'Join with Video'
                    )}
                  </button>
                ) : null}

                <button
                  onClick={handleLeave}
                  className="px-4 py-2.5 bg-transparent border border-slate/50 text-muted 
                           text-sm hover:text-cream hover:border-cream/30 transition-all"
                  style={{ borderRadius: '4px' }}
                >
                  Leave
                </button>
              </>
            )}
          </div>
        </main>

        {/* Chat panel */}
        {showChat && (
        <aside 
          className="w-[320px] flex-shrink-0 border-l border-slate/10 flex flex-col"
          style={{ backgroundColor: '#131929' }}
        >
          {/* Chat header */}
          <div 
            className="p-4 flex flex-col flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-sm text-cream font-semibold">
                Live Chat
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowViewerList(!showViewerList)}
                  className="text-muted hover:text-cream transition-colors text-xs"
                >
                  {showViewerList ? 'Show Chat' : `${viewers.length} Viewers`}
                </button>
                <button
                    onClick={() => setShowChat(false)}
                    className="p-1 text-muted hover:text-cream"
                  >
                    <X size={16} />
                  </button>
              </div>
            </div>
          </div>

          {showViewerList ? (
            /* Viewer list */
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {viewers.map((viewer) => (
                  <div 
                    key={viewer.id}
                    className="flex items-center gap-2 p-2"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate overflow-hidden">
                      {viewer.avatar_url ? (
                        <img 
                          src={viewer.avatar_url} 
                          alt={viewer.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                          {viewer.full_name?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                    <span className="text-cream text-sm flex-1">{viewer.full_name}</span>
                    {viewer.id === session.host_id && (
                      <Crown size={12} className="text-yellow-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted text-sm">No messages yet.</p>
                    <p className="text-muted text-xs">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwn = message.user_id === user.id
                    const isHostMessage = message.user_id === session.host_id
                    
                    return (
                      <div key={message.id} className="group">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate overflow-hidden flex-shrink-0">
                            {message.author?.avatar_url ? (
                              <img 
                                src={message.author.avatar_url} 
                                alt={message.author.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">
                                {message.author?.full_name?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${isHostMessage ? 'text-accent' : 'text-cream'}`}>
                                {message.author?.full_name}
                              </span>
                              {isHostMessage && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded">
                                  Host
                                </span>
                              )}
                              <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatTime(message.created_at)}
                              </span>
                            </div>
                            <p className="text-cream text-sm break-words">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              {session.chat_control !== 'disabled' && (
                <form 
                  onSubmit={sendMessage}
                  className="p-4 border-t border-slate/10 flex-shrink-0"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Send a message..."
                      className="flex-1 px-3 py-2 bg-transparent border border-slate/50 text-cream 
                               placeholder-muted text-sm focus:outline-none focus:border-accent/50"
                      style={{ borderRadius: '4px' }}
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      className="px-3 py-2 bg-accent text-navy hover:opacity-90 
                               transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderRadius: '4px' }}
                    >
                      {sending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </aside>
        )}
      </div>
    </div>
  )
}