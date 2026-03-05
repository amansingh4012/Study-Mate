import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Trash2, ExternalLink, Users, ChevronLeft, ChevronRight } from 'lucide-react'

const PER_PAGE = 20

export default function AdminRooms() {
  const [rooms, setRooms] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    fetchRooms()
  }, [page, search])

  async function fetchRooms() {
    setLoading(true)
    let query = supabase
      .from('rooms')
      .select('id, name, description, subject, max_members, created_by, created_at, profiles!rooms_created_by_fkey(full_name, username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)

    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`)
    }

    const { data, count } = await query
    
    // Fetch member counts
    if (data?.length) {
      const ids = data.map(r => r.id)
      const { data: members } = await supabase
        .from('room_members')
        .select('room_id')
        .in('room_id', ids)

      const countMap = {}
      members?.forEach(m => {
        countMap[m.room_id] = (countMap[m.room_id] || 0) + 1
      })
      data.forEach(r => r.member_count = countMap[r.id] || 0)
    }

    setRooms(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  async function deleteRoom(roomId) {
    await supabase.from('rooms').delete().eq('id', roomId)
    setRooms(prev => prev.filter(r => r.id !== roomId))
    setTotal(prev => prev - 1)
    setConfirm(null)
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl text-cream font-bold">Rooms ({total})</h1>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search rooms..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="pl-9 pr-4 py-2 rounded-md bg-card border border-white/[0.06] text-cream text-sm placeholder:text-muted focus:outline-none focus:border-accent/40 w-64"
          />
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div style={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }} className="p-6 max-w-sm w-full mx-4">
            <h3 className="font-heading text-cream font-semibold mb-2">Delete Room?</h3>
            <p className="text-muted text-sm mb-4">This will permanently delete the room and all its messages, members, and resources.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-md text-sm text-muted hover:text-cream transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteRoom(confirm)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Delete Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-muted font-medium px-4 py-3">Room</th>
                <th className="text-left text-muted font-medium px-4 py-3">Subject</th>
                <th className="text-left text-muted font-medium px-4 py-3">Creator</th>
                <th className="text-left text-muted font-medium px-4 py-3">Members</th>
                <th className="text-left text-muted font-medium px-4 py-3">Created</th>
                <th className="text-right text-muted font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center text-muted py-8">Loading...</td></tr>
              ) : rooms.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted py-8">No rooms found</td></tr>
              ) : rooms.map(room => (
                <tr key={room.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="text-cream font-medium">{room.name}</div>
                    {room.description && (
                      <div className="text-muted text-xs truncate max-w-[200px]">{room.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{room.subject || '-'}</td>
                  <td className="px-4 py-3 text-muted">
                    {room.profiles?.full_name || room.profiles?.username || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-muted">
                      <Users size={13} />
                      <span>{room.member_count}{room.max_members ? `/${room.max_members}` : ''}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(room.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <a
                        href={`/rooms/${room.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-cream transition-colors"
                        title="View Room"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        onClick={() => setConfirm(room.id)}
                        className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-red-400 transition-colors"
                        title="Delete Room"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-muted text-sm">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
