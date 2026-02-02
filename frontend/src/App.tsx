import { useState, useEffect } from 'preact/hooks'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-preact'
import { Navigation } from './components/Navigation'
import { CreatePostModal } from './components/CreatePostModal'
import { Spinner } from './components/Spinner'
import { useAuth } from './hooks/useAuth'
import { users } from './api/endpoints'

const publicRoutes = ['/login', '/signup', '/invite']

function Sidebar() {
  const { user } = useAuth()
  const { data: following } = useQuery({
    queryKey: ['users', user?.id, 'following'],
    queryFn: () => users.following(user?.id ?? 'me'),
    enabled: !!user,
  })

  const count = following?.length ?? 0

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-5xl p-8 shadow-sm border border-gray-50">
        <h3 className="font-bold text-gray-900 mb-6 flex items-center">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2" />
          Your Network
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center">
            <Users size={24} className="text-accent-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{count}</p>
            <p className="text-xs text-gray-500 font-medium">
              {count === 1 ? 'person' : 'people'} in your network
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 flex flex-wrap gap-4 text-[10px] font-black text-gray-300 uppercase tracking-widest">
        <a href="#" className="hover:text-accent-400 transition-colors">Privacy</a>
        <a href="#" className="hover:text-accent-400 transition-colors">Terms</a>
        <a href="#" className="hover:text-accent-400 transition-colors">Help</a>
        <span>2025 Knitly</span>
      </div>
    </div>
  )
}

export function App() {
  const [showCreatePost, setShowCreatePost] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuth()

  const isPublicRoute = publicRoutes.some((r) => location.pathname.startsWith(r))
  const showNavigation = !isPublicRoute

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      void navigate({ to: '/login' })
    }
  }, [isLoading, isAuthenticated, isPublicRoute, navigate])

  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {showNavigation && <Navigation onCreatePost={() => setShowCreatePost(true)} />}

      <main
        className={`flex-1 flex flex-col overflow-y-auto no-scrollbar ${
          showNavigation ? 'md:ml-20 lg:ml-64 pb-20 md:pb-0' : ''
        }`}
      >
        <div
          className={`flex-1 w-full mx-auto flex flex-col lg:flex-row gap-10 ${
            showNavigation ? 'max-w-5xl md:px-6 lg:px-12 pt-4 md:pt-0' : ''
          }`}
        >
          <div className="flex-1">
            <Outlet />
          </div>

          {showNavigation && (
            <aside className="hidden lg:block w-80 py-10 sticky top-0 h-screen space-y-8">
              <Sidebar />
            </aside>
          )}
        </div>
      </main>

      {showCreatePost && (
        <CreatePostModal onClose={() => setShowCreatePost(false)} />
      )}
    </div>
  )
}
