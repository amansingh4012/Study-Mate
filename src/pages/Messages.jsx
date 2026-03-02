import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Send, Paperclip, ArrowLeft, Loader2, Image, X, MessageSquare, Check, CheckCheck, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ConversationSkeleton } from '../components/ui/Skeletons'
import { MessagesEmpty } from '../components/ui/EmptyState'
import ErrorBoundary from '../components/layout/ErrorBoundary'

export default function Messages() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [conversations, setConversations] = useState([])
  const [filteredConversations, setFilteredConversations] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  
  const [activeConversation, setActiveConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const presenceChannelRef = useRef(null)
  const activeConversationRef = useRef(null)

  // Keep activeConversationRef in sync
  useEffect(() => {
    activeConversationRef.current = activeConversation
  }, [activeConversation])

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 96) + 'px'
    }
  }, [newMessage])

  // Fetch conversations on mount
  useEffect(() => {
    if (!user) return
    fetchConversations()
  }, [user])

  // Online presence tracking
  useEffect(() => {
    if (!user) return

    // Subscribe to online-users presence channel
    presenceChannelRef.current = supabase
      .channel('online-users')
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannelRef.current.presenceState()
        const online = new Set()
        
        Object.values(state).forEach(presences => {
          presences.forEach(presence => {
            if (presence.user_id) {
              online.add(presence.user_id)
            }
          })
        })
        
        setOnlineUsers(online)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannelRef.current.track({
            user_id: user.id,
            online_at: new Date().toISOString()
          })
        }
      })

    // Keep presence alive every 30 seconds
    const presenceInterval = setInterval(async () => {
      if (presenceChannelRef.current) {
        await presenceChannelRef.current.track({
          user_id: user.id,
          online_at: new Date().toISOString()
        })
      }
    }, 30000)

    return () => {
      clearInterval(presenceInterval)
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack()
        supabase.removeChannel(presenceChannelRef.current)
      }
    }
  }, [user])

  // Handle URL param for direct chat opening
  useEffect(() => {
    const targetUserId = searchParams.get('user')
    if (targetUserId && conversations.length > 0) {
      const conv = conversations.find(c => c.other_user.id === targetUserId)
      if (conv) {
        handleSelectConversation(conv)
        setSearchParams({})
      }
    }
  }, [searchParams, conversations])

  // Filter conversations based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = conversations.filter(conv =>
        conv.other_user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredConversations(filtered)
    } else {
      setFilteredConversations(conversations)
    }
  }, [searchQuery, conversations])

  // Real-time message subscription
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('direct-messages-realtime')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'direct_messages',
          filter: `to_user=eq.${user.id}`
        },
        async (payload) => {
          const msg = payload.new
          const currentConv = activeConversationRef.current
          
          // If message is for active conversation, add it to messages
          if (currentConv && msg.from_user === currentConv.other_user.id) {
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === msg.id)) return prev
              return [...prev, msg]
            })
            
            // Mark as read immediately since we're viewing this chat
            markAsRead(msg.id)
            
            // Update conversation to clear unread for this conversation
            setConversations(prev => prev.map(c => 
              c.other_user.id === msg.from_user 
                ? { ...c, unread_count: 0, last_message: msg }
                : c
            ))
          } else {
            // Update conversation list with new message and increment unread
            setConversations(prev => {
              const updated = prev.map(c => {
                if (c.other_user.id === msg.from_user) {
                  return {
                    ...c,
                    last_message: msg,
                    unread_count: (c.unread_count || 0) + 1
                  }
                }
                return c
              })
              
              // Sort by last message time (move updated conv to top)
              return updated.sort((a, b) => {
                const aTime = a.last_message?.created_at || a.created_at
                const bTime = b.last_message?.created_at || b.created_at
                return new Date(bTime) - new Date(aTime)
              })
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'direct_messages',
          filter: `from_user=eq.${user.id}`
        },
        (payload) => {
          // Update message read status in UI
          const updatedMsg = payload.new
          setMessages(prev => prev.map(m => 
            m.id === updatedMsg.id ? { ...m, read: updatedMsg.read } : m
          ))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchConversations = async () => {
    setLoading(true)
    
    try {
      // Get all connections
      const { data: connections } = await supabase
        .from('connections')
        .select(`
          id,
          user1_id,
          user2_id,
          created_at
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

      if (!connections || connections.length === 0) {
        setConversations([])
        setFilteredConversations([])
        setLoading(false)
        return
      }

      // Get other user IDs
      const otherUserIds = connections.map(c => 
        c.user1_id === user.id ? c.user2_id : c.user1_id
      )

      // Fetch other users' profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, subjects')
        .in('id', otherUserIds)

      // Build conversations with last message
      const convs = await Promise.all(
        connections.map(async (conn) => {
          const otherId = conn.user1_id === user.id ? conn.user2_id : conn.user1_id
          const profile = profiles?.find(p => p.id === otherId)

          // Get last message
          const { data: lastMsgData } = await supabase
            .from('direct_messages')
            .select('*')
            .or(`and(from_user.eq.${user.id},to_user.eq.${otherId}),and(from_user.eq.${otherId},to_user.eq.${user.id})`)
            .order('created_at', { ascending: false })
            .limit(1)

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('from_user', otherId)
            .eq('to_user', user.id)
            .eq('read', false)

          // Get display name
          const getDisplayName = () => {
            if (profile?.full_name?.trim()) return profile.full_name.trim()
            if (profile?.email) return profile.email.split('@')[0]
            return 'User'
          }

          return {
            id: conn.id,
            other_user: {
              id: otherId,
              full_name: getDisplayName(),
              avatar_url: profile?.avatar_url || null,
              subjects: profile?.subjects || []
            },
            last_message: lastMsgData?.[0] || null,
            unread_count: unreadCount || 0,
            created_at: conn.created_at
          }
        })
      )

      // Sort by last message time
      convs.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at
        const bTime = b.last_message?.created_at || b.created_at
        return new Date(bTime) - new Date(aTime)
      })

      setConversations(convs)
      setFilteredConversations(convs)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectConversation = async (conv) => {
    setActiveConversation(conv)
    setShowMobileChat(true)
    setLoadingMessages(true)
    
    try {
      // Fetch messages
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(from_user.eq.${user.id},to_user.eq.${conv.other_user.id}),and(from_user.eq.${conv.other_user.id},to_user.eq.${user.id})`)
        .order('created_at', { ascending: true })
        .limit(100)

      setMessages(data || [])

      // Mark unread messages as read
      if (conv.unread_count > 0) {
        await supabase
          .from('direct_messages')
          .update({ read: true })
          .eq('from_user', conv.other_user.id)
          .eq('to_user', user.id)
          .eq('read', false)

        // Update local state
        setConversations(prev => prev.map(c => 
          c.id === conv.id ? { ...c, unread_count: 0 } : c
        ))
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const markAsRead = async (messageId) => {
    await supabase
      .from('direct_messages')
      .update({ read: true })
      .eq('id', messageId)
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if ((!newMessage.trim() && !selectedImage) || sending || !activeConversation) return
    
    const messageContent = newMessage.trim()
    const tempId = `temp-${Date.now()}`
    
    // Create optimistic message
    const optimisticMessage = {
      id: tempId,
      from_user: user.id,
      to_user: activeConversation.other_user.id,
      content: messageContent || null,
      image_url: selectedImage ? URL.createObjectURL(selectedImage) : null,
      read: false,
      created_at: new Date().toISOString(),
      _isOptimistic: true
    }
    
    // Add to messages immediately
    setMessages(prev => [...prev, optimisticMessage])
    setNewMessage('')
    
    // Update conversation list with new message
    setConversations(prev => {
      const updated = prev.map(c => 
        c.id === activeConversation.id 
          ? { ...c, last_message: optimisticMessage }
          : c
      )
      // Move to top
      return updated.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at
        const bTime = b.last_message?.created_at || b.created_at
        return new Date(bTime) - new Date(aTime)
      })
    })
    
    const imageToUpload = selectedImage
    setSelectedImage(null)
    setSending(true)
    
    try {
      let imageUrl = null

      // Upload image if selected
      if (imageToUpload) {
        const fileExt = imageToUpload.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('message-images')
          .upload(fileName, imageToUpload)

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('message-images')
            .getPublicUrl(fileName)
          imageUrl = urlData?.publicUrl
        }
      }

      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          from_user: user.id,
          to_user: activeConversation.other_user.id,
          content: messageContent || null,
          image_url: imageUrl,
          read: false
        })
        .select()
        .single()

      if (error) throw error
      
      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => 
        m.id === tempId ? data : m
      ))
      
      // Update conversation with real message
      setConversations(prev => prev.map(c => 
        c.id === activeConversation.id 
          ? { ...c, last_message: data }
          : c
      ))
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setNewMessage(messageContent)
      setSelectedImage(imageToUpload)
    } finally {
      setSending(false)
    }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file)
    }
  }

  const formatMessageTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatLastMessageTime = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date
    
    if (diff < 24 * 60 * 60 * 1000) {
      return formatMessageTime(dateStr)
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const getDateSeparator = (dateStr, prevDateStr) => {
    const date = new Date(dateStr)
    const prevDate = prevDateStr ? new Date(prevDateStr) : null
    
    // Check if same day as previous message
    if (prevDate && 
        date.toDateString() === prevDate.toDateString()) {
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
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const isOnline = (userId) => {
    return onlineUsers.has(userId)
  }

  return (
    <div className="fade-in h-[calc(100vh-140px)] -mt-6">
      <div 
        className="h-full flex overflow-hidden"
        style={{ 
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px'
        }}
      >
        {/* Conversation list */}
        <div 
          className={`w-full lg:w-[320px] flex-shrink-0 border-r border-slate/10 flex flex-col
                     ${showMobileChat ? 'hidden lg:flex' : 'flex'}`}
        >
          {/* Search */}
          <div className="p-4 border-b border-slate/10">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 bg-transparent border border-slate/50 text-cream 
                         placeholder-muted text-sm focus:outline-none focus:border-accent/50"
                style={{ borderRadius: '4px' }}
              />
            </div>
          </div>

          {/* Conversation items */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-0">
                {[...Array(5)].map((_, i) => (
                  <ConversationSkeleton key={i} />
                ))}
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full p-4 flex items-center gap-3 text-left transition-colors duration-200
                             hover:bg-slate/20 border-l-2
                             ${activeConversation?.id === conv.id 
                               ? 'bg-slate/20 border-accent' 
                               : 'border-transparent'
                             }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-slate overflow-hidden">
                      {conv.other_user.avatar_url ? (
                        <img 
                          src={conv.other_user.avatar_url} 
                          alt={conv.other_user.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted text-lg">
                          {conv.other_user.full_name?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                    <div 
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-navy
                                 ${isOnline(conv.other_user.id) ? 'bg-accent' : 'bg-slate'}`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-cream font-medium truncate">
                        {conv.other_user.full_name}
                      </span>
                      {conv.last_message && (
                        <span className="text-muted text-xs flex-shrink-0">
                          {formatLastMessageTime(conv.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-muted text-sm truncate">
                        {conv.last_message?.image_url && !conv.last_message?.content 
                          ? 'Sent an image'
                          : conv.last_message?.content || 'No messages yet'
                        }
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 bg-accent text-navy text-xs 
                                       font-bold rounded-full flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <MessagesEmpty />
            )}
          </div>
        </div>

        {/* Chat area */}
        <div 
          className={`flex-1 flex flex-col min-w-0
                     ${showMobileChat ? 'flex' : 'hidden lg:flex'}`}
        >
          {activeConversation ? (
            <>
              {/* Chat header */}
              <div 
                className="flex items-center gap-3 p-4 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="lg:hidden p-1 text-muted hover:text-cream transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-slate overflow-hidden">
                    {activeConversation.other_user.avatar_url ? (
                      <img 
                        src={activeConversation.other_user.avatar_url} 
                        alt={activeConversation.other_user.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted">
                        {activeConversation.other_user.full_name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  <div 
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-navy
                               ${isOnline(activeConversation.other_user.id) ? 'bg-accent' : 'bg-slate'}`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-cream font-medium truncate">
                    {activeConversation.other_user.full_name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${isOnline(activeConversation.other_user.id) ? 'text-accent' : 'text-muted'}`}>
                      {isOnline(activeConversation.other_user.id) ? 'Online' : 'Offline'}
                    </span>
                    {activeConversation.other_user.subjects?.slice(0, 2).map(subject => (
                      <span 
                        key={subject}
                        className="px-1.5 py-0.5 text-[10px] border border-accent/40 text-accent"
                        style={{ borderRadius: '8px' }}
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'} animate-pulse`}>
                        <div 
                          className={`max-w-[70%] ${i % 2 === 0 ? 'bg-slate/30' : 'bg-accent/30'}`}
                          style={{ borderRadius: '12px', padding: '10px 14px' }}
                        >
                          <div className="h-4 w-32 bg-slate/50 rounded mb-1" />
                          <div className="h-3 w-20 bg-slate/30 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((message, index) => {
                    const isOwn = message.from_user === user.id
                    const prevMessage = messages[index - 1]
                    const dateSeparator = getDateSeparator(
                      message.created_at, 
                      prevMessage?.created_at
                    )

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
                        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div 
                            className={`max-w-[70%] group relative
                                       ${isOwn 
                                         ? 'bg-accent text-navy' 
                                         : 'bg-slate/30 text-cream'
                                       }`}
                            style={{ borderRadius: '12px', padding: '10px 14px' }}
                          >
                            {/* Image */}
                            {message.image_url && (
                              <img 
                                src={message.image_url}
                                alt="Shared image"
                                className="max-w-full rounded-lg mb-2"
                                style={{ maxHeight: '200px' }}
                              />
                            )}

                            {/* Content */}
                            {message.content && (
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                            )}

                            {/* Time and seen indicator */}
                            <div 
                              className={`flex items-center gap-1 mt-1
                                         ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                              <span className="text-[10px] text-muted/70">
                                {formatMessageTime(message.created_at)}
                              </span>
                              {/* Seen indicator for own messages */}
                              {isOwn && (
                                message._isOptimistic ? (
                                  <Clock className="w-3 h-3 text-muted/70" />
                                ) : message.read ? (
                                  <CheckCheck className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Check className="w-3 h-3 text-muted/70" />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted">No messages yet.</p>
                    <p className="text-muted text-sm">Start the conversation!</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Image preview */}
              {selectedImage && (
                <div className="px-4 pb-2">
                  <div className="relative inline-block">
                    <img 
                      src={URL.createObjectURL(selectedImage)}
                      alt="Selected"
                      className="h-20 rounded-lg"
                    />
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* Message input */}
              <form 
                onSubmit={sendMessage}
                className="p-4 border-t border-slate/10 flex-shrink-0"
              >
                <div className="flex gap-2 items-end">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-muted hover:text-cream transition-colors flex-shrink-0"
                  >
                    <Paperclip size={20} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage(e)
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 px-4 py-2.5 bg-transparent border border-slate/50 text-cream 
                             placeholder-muted text-sm resize-none
                             focus:outline-none focus:border-accent/50"
                    style={{ borderRadius: '20px', maxHeight: '96px' }}
                  />

                  <button
                    type="submit"
                    disabled={(!newMessage.trim() && !selectedImage) || sending}
                    className="p-2.5 bg-accent text-navy rounded-full hover:opacity-90 
                             transition-opacity disabled:opacity-50 disabled:cursor-not-allowed
                             flex-shrink-0"
                  >
                    {sending ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Send size={20} />
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate/30 flex items-center justify-center">
                  <Send size={24} className="text-muted" />
                </div>
                <p className="text-cream font-medium mb-1">Your Messages</p>
                <p className="text-muted text-sm">
                  Select a conversation to start chatting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
