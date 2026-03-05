import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Grid2X2, Flag, Radio, TrendingUp, MessageSquare } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function AdminOverview() {
  const [stats, setStats] = useState({ users: 0, activeToday: 0, rooms: 0, reports: 0, messages: 0 })
  const [signupChart, setSignupChart] = useState([])
  const [postChart, setPostChart] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString()

    const [
      { count: userCount },
      { count: activeCount },
      { count: roomCount },
      { count: reportCount },
      { count: msgCount },
      { data: signups },
      { data: posts },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('daily_activity').select('*', { count: 'exact', head: true }).eq('activity_date', today),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('direct_messages').select('*', { count: 'exact', head: true }).gte('created_at', today + 'T00:00:00'),
      supabase.from('profiles').select('created_at').gte('created_at', thirtyDaysAgo).order('created_at'),
      supabase.from('posts').select('created_at').gte('created_at', fourteenDaysAgo).order('created_at'),
    ])

    setStats({
      users: userCount || 0,
      activeToday: activeCount || 0,
      rooms: roomCount || 0,
      reports: reportCount || 0,
      messages: msgCount || 0,
    })

    // Group signups by day
    const signupMap = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
      signupMap[d] = 0
    }
    signups?.forEach(s => {
      const d = s.created_at.split('T')[0]
      if (signupMap[d] !== undefined) signupMap[d]++
    })
    setSignupChart(Object.entries(signupMap).map(([date, count]) => ({
      date: date.slice(5),
      count,
    })))

    // Group posts by day
    const postMap = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
      postMap[d] = 0
    }
    posts?.forEach(p => {
      const d = p.created_at.split('T')[0]
      if (postMap[d] !== undefined) postMap[d]++
    })
    setPostChart(Object.entries(postMap).map(([date, count]) => ({
      date: date.slice(5),
      count,
    })))

    setLoading(false)
  }

  const cards = [
    { label: 'Total Users', value: stats.users, icon: Users, color: '#A8FF3E' },
    { label: 'Active Today', value: stats.activeToday, icon: TrendingUp, color: '#60A5FA' },
    { label: 'Total Rooms', value: stats.rooms, icon: Grid2X2, color: '#FBBF24' },
    { label: 'Open Reports', value: stats.reports, icon: Flag, color: '#F87171' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      <h1 className="font-heading text-2xl text-cream font-bold mb-6">Dashboard Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted text-sm">{label}</span>
              <Icon size={18} style={{ color }} />
            </div>
            <div className="font-heading text-2xl text-cream font-bold">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div style={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }} className="p-5">
          <h3 className="font-heading text-cream font-semibold mb-4">Signups (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={signupChart}>
              <XAxis dataKey="date" tick={{ fill: '#6B7A9E', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#6B7A9E', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#F0EDE6' }}
                labelStyle={{ color: '#6B7A9E' }}
              />
              <Line type="monotone" dataKey="count" stroke="#A8FF3E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }} className="p-5">
          <h3 className="font-heading text-cream font-semibold mb-4">Posts (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={postChart}>
              <XAxis dataKey="date" tick={{ fill: '#6B7A9E', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#6B7A9E', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#F0EDE6' }}
                labelStyle={{ color: '#6B7A9E' }}
              />
              <Bar dataKey="count" fill="#60A5FA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Extra stat */}
      <div style={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }} className="p-5 inline-flex items-center gap-3">
        <MessageSquare size={18} className="text-accent" />
        <span className="text-cream font-medium">{stats.messages} messages today</span>
      </div>
    </div>
  )
}
