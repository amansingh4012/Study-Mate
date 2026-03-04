import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  ArrowLeft, Users, Crown, Pin, PinOff, Send, 
  LogOut, Loader2, Radio, ChevronUp, Video, MessageCircle, X 
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { RoomDetailSkeleton } from '../components/ui/Skeletons'
import ErrorBoundary from '../components/layout/ErrorBoundary'
import useAgora, { uuidToAgoraUid } from '../hooks/useAgora'
import VideoGrid from '../components/ui/VideoGrid'
import VideoControls from '../components/ui/VideoControls'

const MESSAGES_PER_PAGE = 50

export default function RoomDetail() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [pinnedUserIds, setPinnedUserIds] = useState([])
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState([])
  const [showMembersSidebar, setShowMembersSidebar] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [hasOlderMessages, setHasOlderMessages] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const channelRef = useRef(null)
  const textareaRef = useRef(null)

  // Video call state
  const [pinnedUid, setPinnedUid] = useState(null)

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
    isCamOn: agCamOn,
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
  } = useAgora()

  // Auto-join Agora channel as viewer when entering room (use deterministic UID)
  useEffect(() => {
    if (roomId && user && !agoraJoined && !agoraJoining) {
      agoraJoin(`room-${roomId}`, uuidToAgoraUid(user.id), { audio: false, video: false })
    }
  }, [roomId, user])

  // Build Agora UID → name mapping from room members (deterministic, no race conditions)
  const remoteNames = Object.fromEntries(
    members.map((m) => [uuidToAgoraUid(m.id), m.full_name])
  )

  // Start / stop publishing (Join Video / Leave Video)
  const joinVideo = async () => {
    await startPublishing()
  }

  const leaveVideo = async () => {
    await stopPublishing()
    setPinnedUid(null)
  }

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch room data
  useEffect(() => {
    if (!roomId || !user) return
    
    fetchRoom()
    fetchMembers()
    fetchMessages()
    fetchPins()
    joinRoomPresence()

    return () => {
      leaveRoomPresence()
    }
  }, [roomId, user])

  // Real-time messages subscription
  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          // Skip if this is our own message (we handle it optimistically)
          if (payload.new.user_id === user?.id) {
            // Check if we already have this message (from optimistic update)
            setMessages(prev => {
              const hasMessage = prev.some(msg => msg.id === payload.new.id)
              if (hasMessage) return prev
              
              // Remove any optimistic message that matches
              const withoutOptimistic = prev.filter(msg => 
                !msg._isOptimistic || msg.content !== payload.new.content
              )
              
              // Message might be added if optimistic update didn't complete yet
              return withoutOptimistic
            })
            return
          }

          // Fetch complete message with author for other users' messages
          const { data } = await supabase
            .from('room_messages')
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
  }, [roomId, user?.id])

  const fetchRoom = async () => {
    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          creator:profiles!rooms_created_by_fkey(id, full_name)
        `)
        .eq('id', roomId)
        .single()

      if (error) throw error
      setRoom(data)
    } catch (error) {
      console.error('Error fetching room:', error)
      navigate('/rooms')
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('room_members')
      .select(`
        user_id,
        joined_at,
        profile:profiles(id, full_name, avatar_url, last_seen)
      `)
      .eq('room_id', roomId)

    if (data) {
      setMembers(data.map(m => ({
        ...m.profile,
        joined_at: m.joined_at
      })))
    }
  }

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('room_messages')
      .select(`
        *,
        author:profiles(id, full_name, avatar_url)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE)

    if (data) {
      // Reverse to show oldest first
      setMessages(data.reverse())
      setHasOlderMessages(data.length === MESSAGES_PER_PAGE)
    }
  }

  const loadOlderMessages = async () => {
    if (!hasOlderMessages || loadingOlder || messages.length === 0) return
    
    setLoadingOlder(true)
    const oldestMessage = messages[0]
    
    try {
      const { data } = await supabase
        .from('room_messages')
        .select(`
          *,
          author:profiles(id, full_name, avatar_url)
        `)
        .eq('room_id', roomId)
        .lt('created_at', oldestMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE)

      if (data) {
        // Preserve scroll position
        const container = messagesContainerRef.current
        const scrollHeightBefore = container?.scrollHeight || 0
        
        setMessages(prev => [...data.reverse(), ...prev])
        setHasOlderMessages(data.length === MESSAGES_PER_PAGE)
        
        // Restore scroll position after state update
        requestAnimationFrame(() => {
          if (container) {
            const scrollHeightAfter = container.scrollHeight
            container.scrollTop = scrollHeightAfter - scrollHeightBefore
          }
        })
      }
    } catch (error) {
      console.error('Error loading older messages:', error)
    } finally {
      setLoadingOlder(false)
    }
  }

  const fetchPins = async () => {
    try {
      const { data } = await supabase
        .from('room_pins')
        .select('pinned_user_id')
        .eq('room_id', roomId)
        .eq('user_id', user.id)

      if (data) {
        setPinnedUserIds(data.map(p => p.pinned_user_id))
      }
    } catch (err) {
      // room_pins table may not exist yet — ignore
      console.warn('room_pins not available:', err.message)
    }
  }

  const joinRoomPresence = async () => {
    // Update active count (RPC may not exist yet)
    try {
      await supabase.rpc('increment_room_active', { room_id: roomId })
    } catch (err) {
      console.warn('increment_room_active RPC not available:', err.message)
    }

    // Setup presence channel
    channelRef.current = supabase
      .channel(`room-presence-${roomId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channelRef.current.presenceState()
        const typing = []
        
        Object.values(state).forEach(presences => {
          presences.forEach(presence => {
            if (presence.typing && presence.user_id !== user.id) {
              typing.push(presence.name)
            }
          })
        })
        
        setTypingUsers(typing)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channelRef.current.track({
            user_id: user.id,
            name: user.user_metadata?.full_name || 'Someone',
            typing: false,
          })
        }
      })
  }

  const leaveRoomPresence = async () => {
    // Leave Agora channel completely
    if (agoraJoined) {
      await agoraLeave()
    }

    if (channelRef.current) {
      await channelRef.current.untrack()
      supabase.removeChannel(channelRef.current)
    }
    
    // Decrement active count (RPC may not exist yet)
    try {
      await supabase.rpc('decrement_room_active', { room_id: roomId })
    } catch (err) {
      console.warn('decrement_room_active RPC not available:', err.message)
    }
  }

  const handleTyping = useCallback(async () => {
    if (!channelRef.current) return

    await channelRef.current.track({
      user_id: user.id,
      name: user.user_metadata?.full_name || 'Someone',
      typing: true
    })

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing indicator after 2 seconds
    typingTimeoutRef.current = setTimeout(async () => {
      if (channelRef.current) {
        await channelRef.current.track({
          user_id: user.id,
          name: user.user_metadata?.full_name || 'Someone',
          typing: false
        })
      }
    }, 2000)
  }, [user])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return
    
    const messageContent = newMessage.trim()
    const tempId = `temp-${Date.now()}`
    
    // Optimistically add message to UI
    const optimisticMessage = {
      id: tempId,
      room_id: roomId,
      user_id: user.id,
      content: messageContent,
      created_at: new Date().toISOString(),
      author: {
        id: user.id,
        full_name: user.user_metadata?.full_name || 'You',
        avatar_url: user.user_metadata?.avatar_url || null
      },
      _isOptimistic: true
    }
    
    setMessages(prev => [...prev, optimisticMessage])
    setNewMessage('')
    setSending(true)
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    
    try {
      const { data, error } = await supabase
        .from('room_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          content: messageContent
        })
        .select(`
          *,
          author:profiles(id, full_name, avatar_url)
        `)
        .single()

      if (error) throw error
      
      // Replace optimistic message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? data : msg
      ))
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId))
      setNewMessage(messageContent) // Restore message
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e)
    }
  }

  // Auto-resize textarea
  const handleTextareaChange = (e) => {
    setNewMessage(e.target.value)
    handleTyping()
    
    // Auto-resize
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  const togglePin = async (memberId) => {
    const isPinned = pinnedUserIds.includes(memberId)
    
    try {
      if (isPinned) {
        await supabase
          .from('room_pins')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .eq('pinned_user_id', memberId)

        setPinnedUserIds(prev => prev.filter(id => id !== memberId))
      } else {
        await supabase
          .from('room_pins')
          .insert({
            room_id: roomId,
            user_id: user.id,
            pinned_user_id: memberId
          })

        setPinnedUserIds(prev => [...prev, memberId])
      }
    } catch (error) {
      console.error('Error toggling pin:', error)
    }
  }

  const leaveRoom = async () => {
    try {
      await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', user.id)

      navigate('/rooms')
    } catch (error) {
      console.error('Error leaving room:', error)
    }
  }

  // Sort members: pinned first, then by online status
  const sortedMembers = [...members].sort((a, b) => {
    const aPinned = pinnedUserIds.includes(a.id) ? 1 : 0
    const bPinned = pinnedUserIds.includes(b.id) ? 1 : 0
    if (aPinned !== bPinned) return bPinned - aPinned
    
    const aOnline = a.last_seen && new Date(a.last_seen) > new Date(Date.now() - 24 * 60 * 60 * 1000) ? 1 : 0
    const bOnline = b.last_seen && new Date(b.last_seen) > new Date(Date.now() - 24 * 60 * 60 * 1000) ? 1 : 0
    return bOnline - aOnline
  })

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatFullDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleString([], { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getDateSeparator = (dateStr, prevDateStr) => {
    const date = new Date(dateStr)
    const prevDate = prevDateStr ? new Date(prevDateStr) : null
    
    // Check if same day as previous message
    if (prevDate && date.toDateString() === prevDate.toDateString()) {
      return null
    }
    
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === now.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
    }
  }

  // Check if message should show avatar (first message of a group from same user)
  const shouldShowAvatar = (message, index) => {
    if (index === 0) return true
    const prevMessage = messages[index - 1]
    if (!prevMessage) return true
    
    // Different user = show avatar
    if (prevMessage.user_id !== message.user_id) return true
    
    // Same user but different day = show avatar
    const currDate = new Date(message.created_at)
    const prevDate = new Date(prevMessage.created_at)
    if (currDate.toDateString() !== prevDate.toDateString()) return true
    
    // Same user but more than 5 minutes apart = show avatar
    const timeDiff = currDate - prevDate
    if (timeDiff > 5 * 60 * 1000) return true
    
    return false
  }

  // Check if this is last message in a group (used for spacing)
  const isLastInGroup = (message, index) => {
    if (index === messages.length - 1) return true
    const nextMessage = messages[index + 1]
    if (!nextMessage) return true
    return shouldShowAvatar(nextMessage, index + 1)
  }

  if (loading) {
    return <RoomDetailSkeleton />
  }

  if (!room) {
    return (
      <div className="fade-in text-center py-20">
        <p className="text-muted">Room not found.</p>
        <Link to="/rooms" className="text-accent hover:underline mt-2 inline-block">
          Back to Rooms
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
            to="/rooms"
            className="p-1.5 text-muted hover:text-cream transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          
          <div>
            <h1 className="font-heading text-lg text-cream font-bold">
              {room.name}
            </h1>
            {room.description && (
              <p className="text-muted text-xs line-clamp-1">
                {room.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Join / Leave Video button */}
          {isPublishing ? (
            <button
              onClick={leaveVideo}
              className="flex items-center gap-1.5 px-3 py-1.5 text-red-400
                       hover:text-red-300 transition-colors text-sm"
            >
              <Video size={14} />
              <span className="hidden sm:inline">Leave Video</span>
            </button>
          ) : (
            <button
              onClick={joinVideo}
              disabled={agoraJoining}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent
                       hover:bg-accent/20 transition-colors text-sm rounded disabled:opacity-50"
            >
              {agoraJoining ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Video size={14} />
              )}
              <span className="hidden sm:inline">Join Video</span>
            </button>
          )}

          <button
            onClick={() => setShowMembersSidebar(!showMembersSidebar)}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors text-sm rounded
                       ${showMembersSidebar ? 'bg-accent/20 text-accent' : 'text-muted hover:text-cream'}`}
          >
            <Users size={16} />
            <span className="hidden sm:inline">{members.length}</span>
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors text-sm rounded
                       ${showChat ? 'bg-accent/20 text-accent' : 'text-muted hover:text-cream'}`}
          >
            <MessageCircle size={16} />
            <span className="hidden sm:inline">Chat</span>
          </button>

          <button
            onClick={leaveRoom}
            className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 
                     hover:text-red-300 transition-colors text-sm"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Main content — Video + inline panels */}
      <div className="flex flex-1 min-h-0">
        {/* Members sidebar — inline toggle */}
        {showMembersSidebar && (
        <aside 
          className="w-[240px] flex-shrink-0 border-r border-slate/10 overflow-y-auto"
          style={{ backgroundColor: '#131929' }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-sm text-cream font-semibold">
                Members ({members.length})
              </h3>
              <button
                onClick={() => setShowMembersSidebar(false)}
                className="p-1 text-muted hover:text-cream"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-1">
              {sortedMembers.map((member) => {
                const isOnline = member.last_seen && 
                  new Date(member.last_seen) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                const isPinned = pinnedUserIds.includes(member.id)
                const isCreator = member.id === room.creator?.id

                return (
                  <div
                    key={member.id}
                    className={`flex items-center gap-2 p-2 group transition-colors
                               ${isPinned ? 'bg-accent/5' : 'hover:bg-slate/20'}`}
                    style={{ borderRadius: '4px' }}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-slate overflow-hidden">
                        {member.avatar_url ? (
                          <img 
                            src={member.avatar_url} 
                            alt={member.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                            {member.full_name?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <div 
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-navy
                                   ${isOnline ? 'bg-accent' : 'bg-slate'}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-cream text-sm truncate">
                          {member.full_name}
                        </span>
                        {isCreator && (
                          <Crown size={12} className="text-yellow-500 flex-shrink-0" />
                        )}
                        {isPinned && (
                          <Pin size={10} className="text-accent flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {member.id !== user.id && (
                      <button
                        onClick={() => togglePin(member.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted 
                                 hover:text-cream transition-all"
                        title={isPinned ? 'Unpin' : 'Pin'}
                      >
                        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
        )}

        {/* Center — Video Grid (takes remaining space) */}
        <div className="flex-1 flex flex-col min-w-0"
             style={{ backgroundColor: '#0A0F1E' }}>
          {agoraJoined && (isPublishing || remoteUsers.length > 0) ? (
            <>
              <div className="flex-1 p-3 min-h-0">
                <VideoGrid
                  localVideoTrack={isPublishing ? localVideoTrack : null}
                  localAudioTrack={isPublishing ? localAudioTrack : null}
                  localName={user?.user_metadata?.full_name || 'You'}
                  isCamOn={agCamOn}
                  remoteUsers={remoteUsers}
                  remoteNames={remoteNames}
                  pinnedUid={pinnedUid}
                  onPin={setPinnedUid}
                />
              </div>
              {isPublishing && !showChat && (
                <div className="flex justify-center py-3 flex-shrink-0 border-t border-slate/10">
                  <VideoControls
                    isCamOn={agCamOn}
                    onToggleCam={toggleCamera}
                    onFlipCam={flipCamera}
                    onLeave={leaveVideo}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Video size={48} className="text-slate/40 mb-4" />
              <p className="text-muted text-sm">No active video</p>
              <p className="text-slate/40 text-xs mt-1">Click "Join Video" to start your camera</p>
            </div>
          )}
        </div>

        {/* Right — Chat panel — inline toggle */}
        {showChat && (
        <div className="w-[340px] flex-shrink-0 flex flex-col border-l border-slate/10"
             style={{ backgroundColor: '#131929' }}>
          {/* Chat header */}
          <div className="flex items-center justify-between p-3 border-b border-slate/10 flex-shrink-0">
            <h3 className="font-heading text-sm text-cream font-semibold">Chat</h3>
            <button
              onClick={() => setShowChat(false)}
              className="p-1 text-muted hover:text-cream"
            >
              <X size={16} />
            </button>
          </div>
          {/* Messages */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4"
          >
            {/* Load older messages button */}
            {hasOlderMessages && messages.length > 0 && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={loadOlderMessages}
                  disabled={loadingOlder}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-muted 
                           hover:text-cream transition-colors disabled:opacity-50"
                >
                  {loadingOlder ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ChevronUp size={14} />
                  )}
                  Load older messages
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="text-center py-8">
                <Radio size={32} className="text-muted mx-auto mb-3" />
                <p className="text-muted">No messages yet.</p>
                <p className="text-muted text-sm">Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((message, index) => {
                  const isOwn = message.user_id === user.id
                  const prevMessage = index > 0 ? messages[index - 1] : null
                  const dateSeparator = getDateSeparator(message.created_at, prevMessage?.created_at)
                  const showAvatar = shouldShowAvatar(message, index)
                  const lastInGroup = isLastInGroup(message, index)
                  
                  return (
                    <div key={message.id}>
                      {/* Date separator */}
                      {dateSeparator && (
                        <div className="flex items-center justify-center my-4">
                          <span className="px-3 py-1 text-xs text-muted bg-slate/30 rounded-full">
                            {dateSeparator}
                          </span>
                        </div>
                      )}

                      {/* Message */}
                      <div
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} 
                                   ${lastInGroup ? 'mb-3' : 'mb-0.5'}`}
                      >
                        <div className={`flex gap-2 max-w-[80%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                          {/* Avatar */}
                          {!isOwn && (
                            <div className={`w-8 h-8 flex-shrink-0 ${showAvatar ? 'visible' : 'invisible'}`}>
                              {showAvatar && (
                                <div className="w-8 h-8 rounded-full bg-slate overflow-hidden">
                                  {message.author?.avatar_url ? (
                                    <img 
                                      src={message.author.avatar_url} 
                                      alt={message.author.full_name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                                      {message.author?.full_name?.charAt(0) || '?'}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="min-w-0">
                            {/* Author name - only on first message of group */}
                            {!isOwn && showAvatar && (
                              <p className="text-muted text-xs mb-1">
                                {message.author?.full_name}
                              </p>
                            )}
                            
                            {/* Message bubble */}
                            <div 
                              className={`group relative px-3 py-2 ${
                                isOwn 
                                  ? 'bg-accent text-navy' 
                                  : 'bg-slate/30 text-cream'
                              } ${message._isOptimistic ? 'opacity-70' : ''}`}
                              style={{ borderRadius: '8px' }}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                              
                              {/* Timestamp tooltip on hover */}
                              <span 
                                className={`absolute -bottom-5 text-[10px] text-muted opacity-0 
                                           group-hover:opacity-100 transition-opacity whitespace-nowrap z-10
                                           ${isOwn ? 'right-0' : 'left-0'}`}
                              >
                                {formatFullDate(message.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="px-4 pb-2">
              <p className="text-muted text-xs">
                {typingUsers.length === 1 
                  ? `${typingUsers[0]} is typing...`
                  : `${typingUsers.slice(0, 2).join(', ')}${typingUsers.length > 2 ? ` and ${typingUsers.length - 2} more` : ''} are typing...`
                }
              </p>
            </div>
          )}

          {/* Message input */}
          <form 
            onSubmit={sendMessage}
            className="p-4 border-t border-slate/10 flex-shrink-0"
          >
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="flex-1 px-4 py-2.5 bg-transparent border border-slate/50 text-cream 
                         placeholder-muted text-sm focus:outline-none focus:border-accent/50
                         resize-none overflow-hidden"
                style={{ borderRadius: '4px', maxHeight: '120px' }}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="px-4 py-2.5 bg-accent text-navy hover:opacity-90 
                         transition-opacity disabled:opacity-50 disabled:cursor-not-allowed
                         flex-shrink-0"
                style={{ borderRadius: '4px' }}
              >
                {sending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </form>
        </div>
        )}
      </div>
    </div>
  )
}