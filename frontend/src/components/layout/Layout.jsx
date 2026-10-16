import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'
import { notificationsAPI } from '../../services/api'
import { SIDEBAR_GROUPS } from '../../constants'
import {
  LayoutDashboard, User, Code2, FileCode, Bot, Target,
  Calendar, Settings, LogOut, Menu, X, ChevronLeft, Search, Bell, GitBranch, Network,
} from 'lucide-react'

const iconMap = {
  LayoutDashboard, User, Code2, FileCode, Bot, Target, Calendar, Settings, GitBranch, Network,
}

const BOTTOM_NAV = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/problems', label: 'Problems', icon: Code2 },
  { path: '/submissions', label: 'Submissions', icon: FileCode },
  { path: '/ai-coach', label: 'AI Coach', icon: Bot },
  { path: '/github', label: 'GitHub', icon: GitBranch },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef = useRef(null)
  const searchRef = useRef(null)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/problems?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const fetchNotifications = async () => {
    try {
      const [notifs, count] = await Promise.all([
        notificationsAPI.getNotifications(),
        notificationsAPI.getUnreadCount(),
      ])
      setNotifications(notifs.data.notifications)
      setUnreadCount(count.data.count)
    } catch {}
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleFocusSearch = () => searchRef.current?.focus()
    const handleClose = () => { setNotifOpen(false); setMobileOpen(false) }
    document.addEventListener('shortcut:focusSearch', handleFocusSearch)
    document.addEventListener('shortcut:close', handleClose)
    return () => {
      document.removeEventListener('shortcut:focusSearch', handleFocusSearch)
      document.removeEventListener('shortcut:close', handleClose)
    }
  }, [])

  const handleMarkAllRead = async () => {
    await notificationsAPI.markAllAsRead()
    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-dark-800 dark:border-dark-800 border-gray-200">
        <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">LC</span>
        </div>
        {!collapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-bold text-lg">
            LeetCoach
          </motion.span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dark-500 text-gray-400">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.links.map(({ path, label, icon }) => {
                const Icon = iconMap[icon]
                return (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
                  >
                    {Icon && <Icon size={20} />}
                    {!collapsed && <span>{label}</span>}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-dark-800 dark:border-dark-800 border-gray-200">
        <button onClick={handleLogout} className="sidebar-link w-full text-red-400 dark:text-red-400 text-red-500 hover:text-red-300 dark:hover:text-red-300 hover:text-red-600 hover:bg-red-400/10 dark:hover:bg-red-400/10 hover:bg-red-50">
          <LogOut size={20} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-dark-950 dark:bg-dark-950 bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col border-r border-dark-800 dark:border-dark-800 border-gray-200 bg-dark-900/50 dark:bg-dark-900/50 bg-white/50 transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-dark-900 dark:bg-dark-900 bg-white border-r border-dark-800 dark:border-dark-800 border-gray-200 z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-dark-800 dark:border-dark-800 border-gray-200 bg-dark-900/30 dark:bg-dark-900/30 bg-white/30 backdrop-blur-xl">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 hover:bg-dark-800 dark:hover:bg-dark-800 hover:bg-gray-100 rounded-xl">
              <Menu size={20} />
            </button>
            <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:block p-2 hover:bg-dark-800 dark:hover:bg-dark-800 hover:bg-gray-100 rounded-xl">
              <ChevronLeft size={20} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative hidden sm:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 dark:text-dark-500 text-gray-400" />
              <form onSubmit={handleSearch}>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search problems... ( / )"
                  className="input pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
            </div>
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 hover:bg-dark-800 hover:bg-gray-100 rounded-xl">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-12 w-80 card p-0 z-50 shadow-xl max-h-96 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-dark-800 border-gray-200">
                      <h3 className="font-semibold text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-xs text-primary-400 hover:text-primary-300">Mark all read</button>
                      )}
                    </div>
                    <div className="overflow-y-auto max-h-80 scrollbar-thin">
                      {notifications.length === 0 ? (
                        <p className="text-dark-500 text-gray-400 text-sm text-center py-8">No notifications yet</p>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className={`px-4 py-3 border-b border-dark-800/50 border-gray-200/50 ${!n.read ? 'bg-primary-600/5' : ''}`}>
                            <p className="text-sm font-medium">{n.title}</p>
                            <p className="text-dark-400 text-gray-500 text-xs mt-0.5">{n.message}</p>
                            <p className="text-dark-500 text-gray-400 text-[10px] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-medium overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  user?.name?.charAt(0) || 'U'
                )}
              </div>
              <span className="hidden md:block text-sm font-medium">{user?.name}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 pb-20 lg:pb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>

        {/* Bottom Navigation - Mobile Only */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-dark-900/95 dark:bg-dark-900/95 bg-white/95 backdrop-blur-xl border-t border-dark-800 dark:border-dark-800 border-gray-200 z-30 safe-area-bottom">
          <div className="flex items-center justify-around px-2 py-1">
            {BOTTOM_NAV.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[56px] ${
                    isActive
                      ? 'text-primary-400 dark:text-primary-400 text-primary-600'
                      : 'text-dark-400 dark:text-dark-400 text-gray-400 hover:text-dark-200'
                  }`
                }
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
