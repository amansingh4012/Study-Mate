import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { House, Compass, Users, Grid2X2, Radio, MessageSquare, User, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import NotificationBell from './NotificationBell'
import SearchBar from './SearchBar'
import { CompactStreak } from '../ui/StreakWidget'
import InstallPrompt from '../ui/InstallPrompt'

const NAV_ITEMS = [
  { path: '/home', label: 'Home', icon: House },
  { path: '/discover', label: 'Discover', icon: Compass },
  { path: '/find-mate', label: 'Find a Mate', icon: Users },
  { path: '/rooms', label: 'Rooms', icon: Grid2X2 },
  { path: '/sessions', label: 'Sessions', icon: Radio },
  { path: '/messages', label: 'Messages', icon: MessageSquare },
  { path: '/profile', label: 'Profile', icon: User },
]

// Mobile shows only 5 items (no Profile in bottom bar)
const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 5)

export default function MainLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  // Auto-hide sidebar on session room pages so video grid gets max space
  const isSessionRoom = /^\/sessions\/[^/]+$/.test(location.pathname)
  const [sidebarOpen, setSidebarOpen] = useState(!isSessionRoom)

  useEffect(() => {
    setSidebarOpen(!isSessionRoom)
  }, [isSessionRoom])

  // Fetch and subscribe to unread messages count
  useEffect(() => {
    if (!user) return

    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('to_user', user.id)
        .eq('read', false)
      
      if (!error) {
        setUnreadCount(count || 0)
      }
    }

    fetchUnreadCount()

    // Subscribe to new messages for this user
    const channel = supabase
      .channel('unread-messages-count')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'direct_messages',
          filter: `to_user=eq.${user.id}`
        },
        () => {
          fetchUnreadCount()
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'direct_messages',
          filter: `to_user=eq.${user.id}`
        },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen bg-navy">
      {/* Sidebar toggle button — visible when sidebar is hidden (session room) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="hidden lg:flex fixed left-4 top-4 z-50 p-2 text-muted hover:text-cream transition-colors"
          style={{ backgroundColor: '#0D1323', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}
          title="Show sidebar"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Sidebar overlay for session room (click outside to close) */}
      {sidebarOpen && isSessionRoom && (
        <div
          className="hidden lg:block fixed inset-0 z-30 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside 
        className={`lg:flex lg:flex-col fixed left-0 top-0 h-full w-60 z-40 overflow-visible transition-transform duration-200
                   ${sidebarOpen ? 'hidden lg:flex translate-x-0' : 'hidden -translate-x-full'}`}
        style={{ 
          backgroundColor: '#0D1323',
          borderRight: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        {/* Logo */}
        <div className="p-6 pb-8 overflow-visible">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="font-heading text-xl text-cream font-bold">
                StudyMate
              </span>
              <span className="w-1.5 h-1.5 bg-accent rounded-full ml-0.5 mb-2"></span>
            </div>
            <NotificationBell />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 transition-all duration-200 relative
                    ${isActive 
                      ? 'text-cream bg-white/[0.04]' 
                      : 'text-muted hover:text-cream hover:bg-white/[0.02]'
                    }`
                  }
                  style={{ borderRadius: '6px' }}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div 
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-accent"
                          style={{ borderRadius: '0 2px 2px 0' }}
                        />
                      )}
                      <div className="relative">
                        <item.icon size={20} className={isActive ? 'text-accent' : ''} />
                        {item.path === '/messages' && unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                      <span className="font-body text-sm">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Compact Streak */}
        {user && <CompactStreak userId={user.id} />}

        {/* User Section */}
        <div 
          className="p-4 mx-3 mb-4"
          style={{ 
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderRadius: '6px'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate flex items-center justify-center overflow-hidden">
              {user?.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={18} className="text-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-cream text-sm font-medium truncate">{displayName}</p>
              <p className="text-muted text-xs truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-muted hover:text-cream transition-colors duration-200"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header 
        className="lg:hidden fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-40"
        style={{ 
          backgroundColor: '#0D1323',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div className="flex items-center">
          <span className="font-heading text-lg text-cream font-bold">
            StudyMate
          </span>
          <span className="w-1.5 h-1.5 bg-accent rounded-full ml-0.5 mb-2"></span>
        </div>
        <div className="flex items-center gap-2">
          <SearchBar />
          <NotificationBell />
          <NavLink to="/profile" className="p-2">
            <div className="w-8 h-8 rounded-full bg-slate flex items-center justify-center overflow-hidden">
              {user?.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={16} className="text-muted" />
              )}
            </div>
          </NavLink>
        </div>
      </header>

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Mobile Bottom Navigation */}
      <nav 
        className="lg:hidden fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around px-2 z-40"
        style={{ 
          backgroundColor: '#0D1323',
          borderTop: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        {MOBILE_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-2 transition-colors duration-200
              ${isActive ? 'text-accent' : 'text-muted'}`
            }
          >
            <div className="relative">
              <item.icon size={22} />
              {item.path === '/messages' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 flex items-center justify-center text-[9px] font-bold bg-red-500 text-white rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 font-body">{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main 
        className={`pt-14 pb-20 lg:pt-0 lg:pb-0 min-h-screen transition-[margin] duration-200
                   ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-0'}`}
      >
        {/* Desktop Search Bar */}
        {!isSessionRoom && (
          <div className="hidden lg:flex items-center justify-center py-4 px-8"
               style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <SearchBar />
          </div>
        )}
        <div className={isSessionRoom ? 'px-0 py-0' : 'max-w-[1200px] mx-auto px-4 py-6 lg:px-8 lg:py-8'}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
