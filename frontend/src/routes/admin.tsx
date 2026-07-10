import { Link, useSearch } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-preact'
import { useAuth } from '../hooks/useAuth'
import { CustomizeTab } from '../components/CustomizeTab'
import { AdminOverview } from '../components/admin/AdminOverview'
import { AdminBots } from '../components/admin/AdminBots'
import { AdminModeration } from '../components/admin/AdminModeration'
import { AdminAudit } from '../components/admin/AdminAudit'

export function AdminRoute() {
  const { user: currentUser } = useAuth()
  const search = useSearch({ from: '/admin' })
  const isAdmin = currentUser?.role === 'admin'
  const requestedTab = search.tab === 'bots'
    ? 'bots'
    : search.tab === 'moderation'
      ? 'moderation'
      : search.tab === 'audit'
        ? 'audit'
        : search.tab === 'customize'
          ? 'customize'
          : 'overview'
  const availableTabs = isAdmin
    ? ['overview', 'bots', 'moderation', 'audit', 'customize']
    : ['moderation', 'audit']
  const currentTab = availableTabs.includes(requestedTab) ? requestedTab : availableTabs[0]
  const tabs = isAdmin
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'bots', label: 'Bots' },
        { id: 'moderation', label: 'Moderation' },
        { id: 'audit', label: 'Audit Log' },
        { id: 'customize', label: 'Customize' },
      ]
    : [
        { id: 'moderation', label: 'Moderation' },
        { id: 'audit', label: 'Audit Log' },
      ]

  return (
    <div className="w-full max-w-4xl mx-auto py-4 md:py-8 px-4 md:px-0">
      <div className="mb-8 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back</span>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="w-16" />
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to="/admin"
            search={{ tab: tab.id }}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              currentTab === tab.id
                ? 'bg-accent-500 text-white'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {currentTab === 'overview' && <AdminOverview currentUser={currentUser} />}

      {currentTab === 'bots' && <AdminBots />}

      {currentTab === 'moderation' && <AdminModeration />}

      {currentTab === 'audit' && <AdminAudit />}

      {currentTab === 'customize' && (
        <CustomizeTab />
      )}
    </div>
  )
}
