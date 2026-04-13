import { Link, useLocation, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, BookOpen, Plus,
  ShieldCheck, Zap,
} from 'lucide-react'

const NAV = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sessions',  label: 'Sessions',  icon: ClipboardList },
  { to: '/framework', label: 'Framework', icon: BookOpen },
]

export default function AppShell() {
  const { pathname } = useLocation()
  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Sidebar ── */}
      <aside className="bg-white border-r border-gray-200 w-60 flex flex-col shrink-0">

        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-sm">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">
              Quality Check
            </span>
          </div>
          <p className="text-xs text-gray-400 pl-10 font-medium tracking-wider uppercase">
            Audit Agent
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`nav-item ${isActive(to) ? 'active' : ''}`}
            >
              <Icon size={15} className="shrink-0" />
              {label}
            </Link>
          ))}

          <div className="h-px bg-gray-100 my-3" />

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-3 mb-2">
            Workflow
          </p>

          <Link
            to="/sessions"
            className={`nav-item ${pathname.includes('/check') ? 'active' : ''}`}
          >
            <Zap size={15} className="shrink-0" />
            Quality Check
          </Link>
        </nav>

        {/* New Session CTA */}
        <div className="p-3 border-t border-gray-100">
          <Link
            to="/sessions/new"
            className="btn-primary w-full justify-center text-sm py-2.5"
          >
            <Plus size={14} />
            New Session
          </Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  )
}
