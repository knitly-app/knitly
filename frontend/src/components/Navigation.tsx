import { Link, useLocation } from '@tanstack/react-router'
import { Bell, Home, MessageCircle, Plus, Settings, Shield, User, Users } from 'lucide-preact'
import { useAuth } from '../hooks/useAuth'
import { useUnreadCount } from '../hooks/useNotifications'
import { useChatStatus } from '../hooks/useChat'
import { useUIStore } from '../stores/ui'

export function Navigation() {
  const location = useLocation()
  const unreadCount = useUnreadCount()
  const chatOnline = useChatStatus()
  const openCreatePost = useUIStore((s) => s.openCreatePost)
  const { user } = useAuth()

  const navLinks = [
    { to: '/' as const, label: 'Moments', icon: Home },
    { to: '/chat' as const, label: 'Lobby', icon: MessageCircle, chatBadge: true },
    { to: '/notifications' as const, label: 'Activity', icon: Bell, badge: true },
    { to: '/members' as const, label: 'Members', icon: Users },
    { to: '/profile/$id' as const, params: { id: 'me' }, label: 'Profile', icon: User },
    ...(user?.role === 'admin'
      ? [{ to: '/admin' as const, label: 'Admin', icon: Shield }]
      : []),
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 flex items-center justify-around px-4 z-50 safe-pb">
        <Link to="/" className={`p-2 transition-colors ${isActive('/') ? 'text-accent-500' : 'text-gray-400'}`}>
          <Home size={24} strokeWidth={isActive('/') ? 2.5 : 2} />
        </Link>

        <Link to="/chat" className={`p-2 transition-colors relative ${isActive('/chat') ? 'text-accent-500' : 'text-gray-400'}`}>
          <MessageCircle size={24} strokeWidth={isActive('/chat') ? 2.5 : 2} />
          {chatOnline > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white" />
          )}
        </Link>

        <div className="relative -mt-10">
          <button
            onClick={openCreatePost}
            className="w-12 h-12 bg-accent-500 rounded-full shadow-xl flex items-center justify-center transition-transform transform active:scale-90 hover:bg-accent-600"
          >
            <Plus size={28} className="text-white" />
          </button>
        </div>

        <Link to="/notifications" className={`p-2 transition-colors relative ${isActive('/notifications') ? 'text-accent-500' : 'text-gray-400'}`}>
          <Bell size={24} strokeWidth={isActive('/notifications') ? 2.5 : 2} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-500 rounded-full border-2 border-white" />
          )}
        </Link>

        <Link to="/profile/$id" params={{ id: 'me' }} className={`p-2 transition-colors ${isActive('/profile') ? 'text-accent-500' : 'text-gray-400'}`}>
          <User size={24} strokeWidth={isActive('/profile') ? 2.5 : 2} />
        </Link>
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 lg:w-64 flex-col items-center lg:items-start p-6 lg:p-8 border-r border-gray-100 bg-white z-50">
        <Link to="/" className="mb-12 lg:mb-10 flex items-center">
          <span className="text-accent-500 font-black text-3xl lg:text-2xl tracking-tighter">K</span>
          <span className="hidden lg:inline text-accent-500 font-black text-2xl tracking-tighter">nitly</span>
        </Link>

        <div className="space-y-4 w-full">
          {navLinks.map((link) => {
            const active = isActive(link.to)
            return (
              <Link
                key={link.to}
                to={link.to}
                params={'params' in link ? link.params : undefined}
                className={`w-full flex items-center justify-center lg:justify-start space-x-4 p-3 rounded-2xl transition-all ${
                  active ? 'bg-accent-50 text-accent-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                }`}
              >
                <div className="relative">
                  <link.icon size={24} strokeWidth={active ? 2.5 : 2} />
                  {link.badge && unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-500 rounded-full border-2 border-white" />
                  )}
                  {'chatBadge' in link && link.chatBadge && chatOnline > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="hidden lg:flex items-center gap-2">
                  <span className={`font-semibold ${active ? 'text-accent-600' : 'text-gray-700'}`}>
                    {link.label}
                  </span>
                  {'chatBadge' in link && link.chatBadge && chatOnline > 0 && (
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">{chatOnline}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-10 w-full">
          <button
            onClick={openCreatePost}
            className="w-full flex items-center justify-center lg:justify-start space-x-4 p-3 bg-accent-500 text-white rounded-2xl transition-all shadow-sm hover:bg-accent-600"
          >
            <Plus size={24} />
            <span className="hidden lg:inline font-bold">New Moment</span>
          </button>
        </div>

        <div className="mt-auto space-y-2 w-full">
          <Link
            to="/settings"
            className="w-full flex items-center justify-center lg:justify-start space-x-4 p-3 rounded-2xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all"
          >
            <Settings size={24} />
            <span className="hidden lg:inline font-semibold text-gray-700">Settings</span>
          </Link>

        </div>
      </aside>
    </>
  )
}
