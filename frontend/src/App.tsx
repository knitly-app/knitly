import { Outlet, useLocation } from '@tanstack/react-router'
import { CreatePostModal } from './components/CreatePostModal'
import { Navigation } from './components/Navigation'
import { useUIStore } from './stores/ui'
import { PUBLIC_ROUTES } from './routes/constants'

export function App() {
  const { showCreatePost, closeCreatePost } = useUIStore()
  const location = useLocation()

  const isPublicRoute = PUBLIC_ROUTES.some((r) => location.pathname.startsWith(r))
  const showNavigation = !isPublicRoute

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {showNavigation && <Navigation />}

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
        </div>
      </main>

      {showCreatePost && <CreatePostModal onClose={closeCreatePost} />}
    </div>
  )
}
