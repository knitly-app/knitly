import { render } from 'preact'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRouter,
  createRoute,
  createRootRoute,
  RouterProvider,
} from '@tanstack/react-router'
import './index.css'
import { App } from './App'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmModal'
import {
  FeedRoute,
  LoginRoute,
  SignupRoute,
  InviteRoute,
  ProfileRoute,
  PostRoute,
  SearchRoute,
  NotificationsRoute,
  MembersRoute,
  SettingsRoute,
  AdminRoute,
} from './routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

const rootRoute = createRootRoute({
  component: App,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: FeedRoute,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginRoute,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignupRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    invite: search.invite as string | undefined,
  }),
})

const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$token',
  component: InviteRoute,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile/$id',
  component: ProfileRoute,
})

const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/post/$id',
  component: PostRoute,
})

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: SearchRoute,
})

const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notifications',
  component: NotificationsRoute,
})

const membersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/members',
  component: MembersRoute,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsRoute,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminRoute,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  inviteRoute,
  profileRoute,
  postRoute,
  searchRoute,
  notificationsRoute,
  membersRoute,
  settingsRoute,
  adminRoute,
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

render(
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
      </ConfirmProvider>
    </ToastProvider>
  </QueryClientProvider>,
  document.getElementById('app')!
)
