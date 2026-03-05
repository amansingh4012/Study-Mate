import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Ban, ShieldCheck, ShieldOff, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'

const PER_PAGE = 20

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null) // { userId, action }

  useEffect(() => {
    fetchUsers()
  }, [page, search])

  async function fetchUsers() {
    setLoading(true)
    let query = supabase
      .from('profiles')
      .select('id, email, username, full_name, avatar_url, is_admin, is_banned, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)

    if (search.trim()) {
      query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, count } = await query
    setUsers(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  async function toggleBan(userId, isBanned) {
    await supabase.from('profiles').update({ is_banned: !isBanned }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !isBanned } : u))
    setConfirm(null)
  }

  async function toggleAdmin(userId, isAdmin) {
    await supabase.from('profiles').update({ is_admin: !isAdmin }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !isAdmin } : u))
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl text-cream font-bold">Users ({total})</h1>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search users..."
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
            <h3 className="font-heading text-cream font-semibold mb-2">
              {confirm.action === 'ban' ? 'Ban User?' : 'Unban User?'}
            </h3>
            <p className="text-muted text-sm mb-4">
              {confirm.action === 'ban'
                ? 'This user will be signed out and unable to access the platform.'
                : 'This user will regain access to the platform.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-md text-sm text-muted hover:text-cream transition-colors">
                Cancel
              </button>
              <button
                onClick={() => toggleBan(confirm.userId, confirm.action === 'unban')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  confirm.action === 'ban' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-accent/20 text-accent hover:bg-accent/30'
                }`}
              >
                {confirm.action === 'ban' ? 'Ban User' : 'Unban User'}
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
                <th className="text-left text-muted font-medium px-4 py-3">User</th>
                <th className="text-left text-muted font-medium px-4 py-3">Email</th>
                <th className="text-left text-muted font-medium px-4 py-3">Joined</th>
                <th className="text-left text-muted font-medium px-4 py-3">Status</th>
                <th className="text-right text-muted font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center text-muted py-8">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted py-8">No users found</td></tr>
              ) : users.map(user => (
                <tr key={user.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate flex items-center justify-center text-cream text-xs font-bold overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (user.full_name?.[0] || '?').toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="text-cream font-medium">{user.full_name || 'No name'}</div>
                        <div className="text-muted text-xs">@{user.username || 'no-username'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3 text-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {user.is_admin && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-accent/20 text-accent">Admin</span>
                      )}
                      {user.is_banned && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">Banned</span>
                      )}
                      {!user.is_admin && !user.is_banned && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/[0.06] text-muted">Active</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <a
                        href={`/profile/${user.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-white/[0.06] text-muted hover:text-cream transition-colors"
                        title="View Profile"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        onClick={() => toggleAdmin(user.id, user.is_admin)}
                        className={`p-1.5 rounded hover:bg-white/[0.06] transition-colors ${user.is_admin ? 'text-accent' : 'text-muted hover:text-cream'}`}
                        title={user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      >
                        {user.is_admin ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                      </button>
                      <button
                        onClick={() => setConfirm({ userId: user.id, action: user.is_banned ? 'unban' : 'ban' })}
                        className={`p-1.5 rounded hover:bg-white/[0.06] transition-colors ${user.is_banned ? 'text-accent hover:text-accent' : 'text-muted hover:text-red-400'}`}
                        title={user.is_banned ? 'Unban' : 'Ban'}
                      >
                        <Ban size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-muted text-sm">
              Page {page + 1} of {totalPages}
            </span>
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
