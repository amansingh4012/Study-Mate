import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Grid2X2, Flag, Radio, ArrowLeft, Shield } from 'lucide-react'

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/rooms', icon: Grid2X2, label: 'Rooms' },
  { to: '/admin/reports', icon: Flag, label: 'Reports' },
  { to: '/admin/sessions', icon: Radio, label: 'Sessions' },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-navy flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/[0.06] flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-5 border-b border-white/[0.06] flex items-center gap-2">
          <Shield size={20} className="text-accent" />
          <span className="font-heading text-cream font-bold text-lg">Admin Panel</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:text-cream hover:bg-white/[0.04]'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted hover:text-cream hover:bg-white/[0.04] transition-colors w-full"
          >
            <ArrowLeft size={18} />
            Back to App
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
