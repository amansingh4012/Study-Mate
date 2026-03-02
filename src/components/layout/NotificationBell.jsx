import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X, UserPlus, UserCheck, MessageSquare, Heart, Radio, Check, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../ui/Toast'

// Get icon based on notification type
const getTypeIcon = (type) => {
  switch (type) {
    case 'mate_request':
      return <UserPlus size={16} className="text-accent" />
    case 'mate_accepted':
      return <UserCheck size={16} className="text-green-500" />
    case 'room_message':
      return <MessageSquare size={16} className="text-blue-400" />
    case 'post_like':
      return <Heart size={16} className="text-red-400" />
    case 'session_live':
      return <Radio size={16} className="text-purple-400" />
    default:
      return <Bell size={16} className="text-muted" />
  }
}

// Format time ago
const formatTimeAgo = (date) => {
  const now = new Date()
  const diff = now - new Date(date)
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()
  
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  
  const dropdownRef = useRef(null)

  // Track screen size for responsive dropdown positioning
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) throw error
      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.read).length || 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and real-time subscription
  useEffect(() => {
    if (!user) return

    fetchNotifications()

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Add new notification to list
          setNotifications(prev => [payload.new, ...prev.slice(0, 19)])
          setUnreadCount(prev => prev + 1)
          
          // Show toast notification
          addToast({
            type: payload.new.type,
            title: payload.new.title,
            message: payload.new.message
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          setNotifications(prev => 
            prev.map(n => n.id === payload.new.id ? payload.new : n)
          )
          // Recalculate unread count
          setNotifications(prev => {
            setUnreadCount(prev.filter(n => !n.read).length)
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, addToast])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Mark single notification as read
  const markAsRead = async (notification) => {
    if (notification.read) {
      // If already read, just navigate
      if (notification.link) {
        navigate(notification.link)
        setIsOpen(false)
      }
      return
    }

    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id)
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      
      // Navigate if link exists
      if (notification.link) {
        navigate(notification.link)
        setIsOpen(false)
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    if (unreadCount === 0) return

    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
      
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted hover:text-cream transition-colors"
      >
        <Bell size={20} />
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel - fixed position to avoid sidebar clipping */}
      {isOpen && (
        <div 
          className="fixed w-80 max-h-[70vh] overflow-hidden
                     bg-slate border border-white/10 shadow-xl z-[60]"
          style={{ 
            borderRadius: '12px',
            top: '64px',
            left: isDesktop ? '16px' : 'auto',
            right: isDesktop ? 'auto' : '16px'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="font-medium text-cream">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
              >
                <Check size={12} />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="overflow-y-auto max-h-[calc(70vh-100px)]">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-muted animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => markAsRead(notification)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left
                             transition-colors hover:bg-white/5
                             ${!notification.read ? 'bg-white/[0.03]' : ''}`}
                >
                  {/* Type icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getTypeIcon(notification.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!notification.read ? 'text-cream font-medium' : 'text-cream/80'}`}>
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                    )}
                    <p className="text-[10px] text-muted/70 mt-1">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {!notification.read && (
                    <div className="flex-shrink-0 w-2 h-2 mt-2 bg-accent rounded-full" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-white/10">
              <button
                onClick={() => {
                  // Could navigate to a full notifications page if you have one
                  setIsOpen(false)
                }}
                className="text-xs text-muted hover:text-cream transition-colors"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
