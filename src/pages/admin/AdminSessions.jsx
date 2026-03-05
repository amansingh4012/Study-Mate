import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Radio, ExternalLink, Square, ChevronLeft, ChevronRight, Users } from 'lucide-react'

const PER_PAGE = 20

export default function AdminSessions() {
  const [sessions, setSessions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('all') // all, live, scheduled, ended
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    fetchSessions()
  }, [page, filter])

  async function fetchSessions() {
    setLoading(true)
    let query = supabase
      .from('sessions')
      .select('*, host:host_id(full_name, username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)

    if (filter === 'live') query = query.eq('status', 'live')
    else if (filter === 'scheduled') query = query.eq('status', 'scheduled')
    else if (filter === 'ended') query = query.eq('status', 'ended')

    const { data, count } = await query

    // Fetch viewer counts for live sessions
    if (data?.length) {
      const liveIds = data.filter(s => s.status === 'live').map(s => s.id)
      if (liveIds.length) {
        const { data: viewers } = await supabase
          .from('session_viewers')
          .select('session_id')
          .in('session_id', liveIds)

        const countMap = {}
        viewers?.forEach(v => {
          countMap[v.session_id] = (countMap[v.session_id] || 0) + 1
        })
        data.forEach(s => s.viewer_count = countMap[s.id] || 0)
      }
    }

    setSessions(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  async function endSession(sessionId) {
    await supabase.from('sessions').update({ status: 'ended' }).eq('id', sessionId)
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'ended' } : s))
    setConfirm(null)
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  const filters = [
    { value: 'all', label: 'All' },
    { value: 'live', label: 'Live' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'ended', label: 'Ended' },
  ]

  const statusStyles = {
    live: 'bg-red-500/20 text-red-400',
    scheduled: 'bg-blue-500/20 text-blue-400',
    ended: 'bg-white/[0.06] text-muted',
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl text-cream font-bold">Sessions ({total})</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(0) }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-accent/20 text-accent'
                : 'bg-white/[0.04] text-muted hover:text-cream'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Confirmation dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div style={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }} className="p-6 max-w-sm w-full mx-4">
            <h3 className="font-heading text-cream font-semibold mb-2">End Session?</h3>
            <p className="text-muted text-sm mb-4">This will immediately end the live session for all viewers.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-md text-sm text-muted hover:text-cream transition-colors">
                Cancel
              </button>
              <button
                onClick={() => endSession(confirm)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                End Session
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
                <th className="text-left text-muted font-medium px-4 py-3">Session</th>
                <th className="text-left text-muted font-medium px-4 py-3">Host</th>
                <th className="text-left text-muted font-medium px-4 py-3">Status</th>
                <th className="text-left text-muted font-medium px-4 py-3">Viewers</th>
                <th className="text-left text-muted font-medium px-4 py-3">Created</th>
                <th className="text-right text-muted font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center text-muted py-8">Loading...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted py-8">No sessions found</td></tr>
              ) : sessions.map(session => (
                <tr key={session.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="text-cream font-medium">{session.title || 'Untitled'}</div>
                    {session.description && (
                      <div className="text-muted text-xs truncate max-w-[200px]">{session.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {session.host?.full_name || session.host?.username || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[session.status] || statusStyles.ended}`}>
                      {session.status === 'live' && (
                        <span className="inline-block w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5 animate-pulse" />
                      )}
                      {session.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {session.status === 'live' ? (
                      <div className="flex items-center gap-1.5 text-muted">
                        <Users size={13} />
                        <span>{session.viewer_count || 0}</span>
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(session.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <a
                        href={`/sessions/${session.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-cream transition-colors"
                        title="View Session"
                      >
                        <ExternalLink size={14} />
                      </a>
                      {session.status === 'live' && (
                        <button
                          onClick={() => setConfirm(session.id)}
                          className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-red-400 transition-colors"
                          title="End Session"
                        >
                          <Square size={14} />
                        </button>
                      )}
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
