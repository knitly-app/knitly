import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Users, FileText, Mail, TrendingUp } from 'lucide-preact'
import { admin } from '../api/endpoints'
import { Spinner } from '../components/Spinner'
import { getAvatarUrl } from '../utils/avatar'

export function AdminRoute() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: admin.stats,
  })

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: admin.users,
  })

  const statCards = [
    { icon: Users, label: 'Total Users', value: stats?.users ?? 0, color: 'bg-blue-500' },
    { icon: FileText, label: 'Total Posts', value: stats?.posts ?? 0, color: 'bg-green-500' },
    { icon: Mail, label: 'Invites Sent', value: stats?.invites ?? 0, color: 'bg-purple-500' },
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-4xl p-6 shadow-sm border border-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center`}>
                <stat.icon size={24} className="text-white" />
              </div>
              <TrendingUp size={20} className="text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {statsLoading ? '-' : stat.value.toLocaleString()}
            </p>
            <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-4xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Recent Users</h2>
        </div>

        {usersLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users?.slice(0, 10).map((user) => (
              <Link
                key={user.id}
                to="/profile/$id"
                params={{ id: user.id }}
                className="flex items-center p-4 hover:bg-gray-50 transition-colors"
              >
                <img
                  src={getAvatarUrl(user)}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full mr-4"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{user.displayName}</p>
                  <p className="text-sm text-gray-400 truncate">@{user.username}</p>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
