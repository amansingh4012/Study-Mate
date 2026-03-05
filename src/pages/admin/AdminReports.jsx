import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Flag, CheckCircle, XCircle, Ban, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

const PER_PAGE = 20

export default function AdminReports() {
  const [reports, setReports] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('all') // all, pending, post, message, user, room
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
  }, [page, filter])

  async function fetchReports() {
    setLoading(true)
    let query = supabase
      .from('reports')
      .select(`
        *,
        reporter:reporter_id(full_name, username),
        reported:reported_user_id(full_name, username)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)

    if (filter === 'pending') query = query.eq('status', 'pending')
    else if (['post', 'message', 'user', 'room'].includes(filter)) query = query.eq('type', filter)

    const { data, count } = await query
    setReports(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('reports').update({ status }).eq('id', id)
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  async function deleteReport(id) {
    await supabase.from('reports').delete().eq('id', id)
    setReports(prev => prev.filter(r => r.id !== id))
    setTotal(prev => prev - 1)
  }

  async function banReportedUser(report) {
    if (!report.reported_user_id) return
    await supabase.from('profiles').update({ is_banned: true }).eq('id', report.reported_user_id)
    await updateStatus(report.id, 'reviewed')
  }

  async function deleteContent(report) {
    if (!report.content_id) return
    if (report.type === 'post') {
      await supabase.from('posts').delete().eq('id', report.content_id)
    } else if (report.type === 'message') {
      await supabase.from('room_messages').delete().eq('id', report.content_id)
    } else if (report.type === 'room') {
      await supabase.from('rooms').delete().eq('id', report.content_id)
    }
    await updateStatus(report.id, 'reviewed')
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  const filters = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'post', label: 'Posts' },
    { value: 'message', label: 'Messages' },
    { value: 'user', label: 'Users' },
    { value: 'room', label: 'Rooms' },
  ]

  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    reviewed: 'bg-accent/20 text-accent',
    dismissed: 'bg-white/[0.06] text-muted',
  }

  const typeColors = {
    post: 'bg-blue-500/20 text-blue-400',
    message: 'bg-purple-500/20 text-purple-400',
    user: 'bg-red-500/20 text-red-400',
    room: 'bg-orange-500/20 text-orange-400',
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl text-cream font-bold">Reports ({total})</h1>
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

      {/* Table */}
      <div style={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-muted font-medium px-4 py-3">Type</th>
                <th className="text-left text-muted font-medium px-4 py-3">Reason</th>
                <th className="text-left text-muted font-medium px-4 py-3">Reporter</th>
                <th className="text-left text-muted font-medium px-4 py-3">Reported User</th>
                <th className="text-left text-muted font-medium px-4 py-3">Status</th>
                <th className="text-left text-muted font-medium px-4 py-3">Date</th>
                <th className="text-right text-muted font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center text-muted py-8">Loading...</td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted py-8">No reports found</td></tr>
              ) : reports.map(report => (
                <tr key={report.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[report.type] || ''}`}>
                      {report.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-cream max-w-[200px] truncate">{report.reason}</div>
                    {report.content_text && (
                      <div className="text-muted text-xs truncate max-w-[200px] mt-0.5">"{report.content_text}"</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {report.reporter?.full_name || report.reporter?.username || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {report.reported?.full_name || report.reported?.username || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[report.status] || ''}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(report.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {report.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateStatus(report.id, 'reviewed')}
                            className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-accent transition-colors"
                            title="Mark Reviewed"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            onClick={() => updateStatus(report.id, 'dismissed')}
                            className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-cream transition-colors"
                            title="Dismiss"
                          >
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                      {report.content_id && report.type !== 'user' && (
                        <button
                          onClick={() => deleteContent(report)}
                          className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-red-400 transition-colors"
                          title="Delete Content"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {report.reported_user_id && (
                        <button
                          onClick={() => banReportedUser(report)}
                          className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-red-400 transition-colors"
                          title="Ban User"
                        >
                          <Ban size={14} />
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
