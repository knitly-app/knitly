import { useState } from 'preact/hooks'
import { Link, useLocation } from '@tanstack/react-router'
import { Bell, Grid, Home, MessageCircle, Plus, Settings, Shield, User, Users, X, Zap } from 'lucide-preact'
import * as LucideIcons from 'lucide-preact'
import { useAuth } from '../hooks/useAuth'
import { useUnreadCount } from '../hooks/useNotifications'
import { useChatStatus } from '../hooks/useChat'
import { useUIStore } from '../stores/ui'
import { useAppSettings } from '../hooks/useAppSettings'

import type { LucideIcon } from 'lucide-preact'

interface CustomNavItem {
  to: string
  label: string
  icon: LucideIcon
}

interface CustomExtModule {
  customNavItems?: CustomNavItem[]
}

const customModules = import.meta.glob<CustomExtModule>('../../../custom/frontend/index.ts', { eager: true })
const customNavModule = Object.values(customModules)[0]
const loadedCustomNavItems: CustomNavItem[] = customNavModule?.customNavItems ?? []

export function Navigation() {
  const location = useLocation()
  const unreadCount = useUnreadCount()
  const chatOnline = useChatStatus()
  const openCreatePost = useUIStore((s) => s.openCreatePost)
  const { user } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const appName = useAppSettings((s) => s.appName)
  const logoIcon = useAppSettings((s) => s.logoIcon)
  const LogoIcon = (LucideIcons as unknown as Record<string, typeof Zap>)[logoIcon] || Zap

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

  const moreSheetItems = [
    { to: '/profile/$id', params: { id: 'me' }, label: 'Profile', icon: User },
    { to: '/members', label: 'Members', icon: Users },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
    ...loadedCustomNavItems,
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path.replace('/$id', ''))
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
            onClick={() => openCreatePost()}
            aria-label="New Moment"
            className="w-12 h-12 bg-accent-500 rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-90 hover:bg-accent-600"
          >
            <Plus size={28} className="text-white" aria-hidden="true" />
          </button>
        </div>

        <Link to="/notifications" className={`p-2 transition-colors relative ${isActive('/notifications') ? 'text-accent-500' : 'text-gray-400'}`}>
          <Bell size={24} strokeWidth={isActive('/notifications') ? 2.5 : 2} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-500 rounded-full border-2 border-white" />
          )}
        </Link>

        <button
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          className={`p-2 transition-colors ${moreOpen ? 'text-accent-500' : 'text-gray-400'}`}
        >
          <Grid size={24} strokeWidth={2} aria-hidden="true" />
        </button>
      </nav>

      {/* Mobile More sheet */}
      <div
        className={`md:hidden fixed inset-0 z-[60] transition-all duration-300 ${moreOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!moreOpen}
        onClick={() => setMoreOpen(false)}
      >
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${moreOpen ? 'opacity-100' : 'opacity-0'}`} />
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl transition-transform duration-300 ease-out ${moreOpen ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="px-6 pt-3 pb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">More</span>
            <button
              onClick={() => setMoreOpen(false)}
              aria-label="Close"
              className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 px-4 pb-10 pt-1">
            {moreSheetItems.map((item) => {
              const active = isActive(item.to)
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to as never}
                  params={'params' in item ? (item.params as never) : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-colors cursor-pointer ${
                    active ? 'bg-accent-50 text-accent-600' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                  <span className="text-xs font-medium leading-tight text-center">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 lg:w-64 flex-col items-center lg:items-start p-6 lg:p-8 border-r border-gray-200 bg-white z-50">
        <Link to="/" className="mb-10 flex items-center gap-3">
          <div className="w-9 h-9 bg-accent-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <LogoIcon size={18} className="text-white" aria-hidden="true" />
          </div>
          <span className="hidden lg:inline font-black text-xl tracking-tight text-gray-900">{appName}</span>
        </Link>

        {/* Core nav */}
        <div className="space-y-1 w-full">
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
                  {'badge' in link && link.badge && unreadCount > 0 && (
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

        {/* Tools section */}
        {loadedCustomNavItems.length > 0 && (
          <>
            <div className="w-full my-4 flex items-center gap-3">
              <div className="flex-1 border-t border-gray-100" />
              <span className="hidden lg:block text-[10px] font-semibold uppercase tracking-widest text-gray-300">
                Tools
              </span>
              <div className="flex-1 border-t border-gray-100" />
            </div>
            <div className="space-y-1 w-full">
              {loadedCustomNavItems.map((item) => {
                const active = isActive(item.to)
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to as never}
                    className={`w-full flex items-center justify-center lg:justify-start space-x-4 p-3 rounded-2xl transition-all ${
                      active ? 'bg-accent-50 text-accent-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}
                  >
                    <Icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                    <span className={`hidden lg:inline font-medium text-sm ${active ? 'text-accent-600' : 'text-gray-600'}`}>
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </>
        )}

        <div className="mt-6 w-full">
          <button
            onClick={() => openCreatePost()}
            className="w-full flex items-center justify-center lg:justify-start space-x-4 p-3 bg-accent-500 text-white rounded-2xl transition-all shadow-sm hover:bg-accent-600"
          >
            <Plus size={24} aria-hidden="true" />
            <span className="hidden lg:inline font-bold">New Moment</span>
          </button>
        </div>

        <div className="mt-auto w-full">
          <Link
            to="/settings"
            className="w-full flex items-center justify-center lg:justify-start space-x-4 p-3 rounded-2xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all"
          >
            <Settings size={22} aria-hidden="true" />
            <span className="hidden lg:inline font-medium text-sm text-gray-600">Settings</span>
          </Link>
        </div>
      </aside>
    </>
  )
}
