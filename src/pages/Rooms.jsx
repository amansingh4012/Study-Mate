import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Users, Radio, Target, Coffee, BookOpen, Moon, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { RoomCardSkeleton } from '../components/ui/Skeletons'
import ErrorBoundary from '../components/layout/ErrorBoundary'

// Fixed room icons mapping
const ROOM_ICONS = {
  '🎯': Target,
  '☕': Coffee,
  '📚': BookOpen,
  '🌙': Moon,
}

// Fixed room IDs
const FIXED_ROOM_IDS = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
]

export default function Rooms() {
  const { user } = useAuth()
  
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [memberRoomIds, setMemberRoomIds] = useState([])
  const [joiningId, setJoiningId] = useState(null)
  const [activeUsers, setActiveUsers] = useState({}) // { roomId: count }
  const presenceChannelsRef = useRef([])

  useEffect(() => {
    if (!user) return
    fetchRooms()
    fetchMemberships()
    subscribeToPresence()

    return () => {
      // Cleanup presence channels
      presenceChannelsRef.current.forEach(ch => supabase.removeChannel(ch))
      presenceChannelsRef.current = []
    }
  }, [user?.id])

  // Subscribe to presence for all rooms to get live active counts
  const subscribeToPresence = () => {
    presenceChannelsRef.current.forEach(ch => supabase.removeChannel(ch))
    presenceChannelsRef.current = []

    FIXED_ROOM_IDS.forEach(roomId => {
      const channel = supabase
        .channel(`room-presence-${roomId}`)
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          const count = Object.keys(state).length
          setActiveUsers(prev => ({ ...prev, [roomId]: count }))
        })
        .subscribe()
      
      presenceChannelsRef.current.push(channel)
    })
  }

  const fetchRooms = async () => {
    setLoading(true)
    
    try {
      // Fetch rooms + real member count from room_members
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          room_members(count)
        `)
        .in('id', FIXED_ROOM_IDS)
        .eq('is_active', true)

      if (error) throw error
      
      // Sort in defined order and attach real member count
      const sorted = FIXED_ROOM_IDS
        .map(id => {
          const room = data?.find(r => r.id === id)
          if (!room) return null
          return {
            ...room,
            member_count: room.room_members?.[0]?.count || 0,
          }
        })
        .filter(Boolean)
      
      setRooms(sorted)
    } catch (error) {
      console.error('Error fetching rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMemberships = async () => {
    if (!user) return
    
    const { data } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', user.id)

    if (data) {
      setMemberRoomIds(data.map(m => m.room_id))
    }
  }

  const handleJoin = async (room) => {
    setJoiningId(room.id)
    try {
      const { error } = await supabase
        .from('room_members')
        .insert({
          room_id: room.id,
          user_id: user.id
        })

      if (error) throw error

      setMemberRoomIds(prev => [...prev, room.id])
      // Re-fetch to get updated real member count
      fetchRooms()
    } catch (error) {
      console.error('Error joining room:', error)
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl text-cream font-bold mb-2">
          Focus Rooms
        </h1>
        <p className="text-muted text-lg">
          Join a room and study together with others in real-time
        </p>
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <RoomCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
          {rooms.map((room) => {
            const isMember = memberRoomIds.includes(room.id)
            const IconComponent = ROOM_ICONS[room.icon] || Target
            const liveCount = activeUsers[room.id] || 0
            const isLive = liveCount > 0

            return (
              <div
                key={room.id}
                className="relative overflow-hidden group"
                style={{ 
                  backgroundColor: '#131929',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px'
                }}
              >
                {/* Color accent bar */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: room.color || '#A3E635' }}
                />

                <div className="p-6">
                  {/* Top row: icon + live badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${room.color || '#A3E635'}15` }}
                    >
                      <IconComponent 
                        size={24} 
                        style={{ color: room.color || '#A3E635' }} 
                      />
                    </div>

                    {isLive && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 rounded-full">
                        <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                        <span className="text-accent text-[10px] font-bold tracking-wider">
                          {liveCount} ACTIVE
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Room info */}
                  <h3 className="font-heading text-cream font-bold text-xl mb-2">
                    {room.name}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    {room.description}
                  </p>

                  {/* Category pill */}
                  {room.category && (
                    <span 
                      className="inline-block px-3 py-1 text-xs font-medium mb-4"
                      style={{ 
                        backgroundColor: `${room.color || '#A3E635'}15`,
                        color: room.color || '#A3E635',
                        borderRadius: '20px'
                      }}
                    >
                      {room.category}
                    </span>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted mb-5">
                    <div className="flex items-center gap-1.5">
                      <Users size={13} />
                      <span>{room.member_count} members</span>
                    </div>
                    {isLive && (
                      <div className="flex items-center gap-1.5 text-accent">
                        <Radio size={13} />
                        <span>{liveCount} studying now</span>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  {isMember ? (
                    <Link
                      to={`/rooms/${room.id}`}
                      className="block w-full py-3 text-center font-medium text-sm transition-all duration-200
                               hover:opacity-90"
                      style={{ 
                        backgroundColor: room.color || '#A3E635',
                        color: '#0B1120',
                        borderRadius: '6px'
                      }}
                    >
                      Enter Room
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleJoin(room)}
                      disabled={joiningId === room.id}
                      className="w-full py-3 bg-transparent border font-medium text-sm 
                               transition-all duration-200 hover:bg-opacity-10
                               disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        borderColor: `${room.color || '#A3E635'}60`,
                        color: room.color || '#A3E635',
                        borderRadius: '6px'
                      }}
                    >
                      {joiningId === room.id ? 'Joining...' : 'Join Room'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
