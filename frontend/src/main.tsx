import { render, type ComponentType, type JSX } from 'preact'
import { lazy, Suspense } from 'preact/compat'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRouter,
  createRoute,
  createRootRouteWithContext,
  RouterProvider,
  redirect,
} from '@tanstack/react-router'
import './index.css'
import { App } from './App'
import { useAppSettings } from './hooks/useAppSettings'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RouteErrorFallback } from './components/RouteErrorFallback'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmModal'
import { Lightbox } from './components/Lightbox'
import { auth, posts, users, setup, type User } from './api/endpoints'
import { PUBLIC_ROUTES } from './routes/constants'

function RouteLoader() {
  return <div className="flex-1 flex items-center justify-center py-12" />
}

function withSuspense<P extends object>(LazyComponent: ComponentType<P>) {
  return function SuspenseWrapper(props: P): JSX.Element {
    return (
      <Suspense fallback={<RouteLoader />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

const FeedRoute = withSuspense(lazy(() => import('./routes/feed').then((m) => ({ default: m.FeedRoute }))))
const LoginRoute = withSuspense(lazy(() => import('./routes/login').then((m) => ({ default: m.LoginRoute }))))
const SignupRoute = withSuspense(lazy(() => import('./routes/signup').then((m) => ({ default: m.SignupRoute }))))
const InviteRoute = withSuspense(lazy(() => import('./routes/invite').then((m) => ({ default: m.InviteRoute }))))
const ProfileRoute = withSuspense(lazy(() => import('./routes/profile').then((m) => ({ default: m.ProfileRoute }))))
const PostRoute = withSuspense(lazy(() => import('./routes/post').then((m) => ({ default: m.PostRoute }))))
const SearchRoute = withSuspense(lazy(() => import('./routes/search').then((m) => ({ default: m.SearchRoute }))))
const NotificationsRoute = withSuspense(lazy(() => import('./routes/notifications').then((m) => ({ default: m.NotificationsRoute }))))
const MembersRoute = withSuspense(lazy(() => import('./routes/members').then((m) => ({ default: m.MembersRoute }))))
const SettingsRoute = withSuspense(lazy(() => import('./routes/settings').then((m) => ({ default: m.SettingsRoute }))))
const AdminRoute = withSuspense(lazy(() => import('./routes/admin').then((m) => ({ default: m.AdminRoute }))))
const CirclesRoute = withSuspense(lazy(() => import('./routes/circles').then((m) => ({ default: m.CirclesRoute }))))
const ChatRoute = withSuspense(lazy(() => import('./routes/chat').then((m) => ({ default: m.ChatRoute }))))
const SetupRoute = withSuspense(lazy(() => import('./routes/setup').then((m) => ({ default: m.SetupWizard }))))
const ResetPasswordRoute = withSuspense(lazy(() => import('./routes/reset-password').then((m) => ({ default: m.ResetPasswordRoute }))))
const ForgotPasswordRoute = withSuspense(lazy(() => import('./routes/forgot-password').then((m) => ({ default: m.ForgotPasswordRoute }))))
const ConfirmEmailRoute = withSuspense(lazy(() => import('./routes/confirm-email').then((m) => ({ default: m.ConfirmEmailRoute }))))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

type RouterContext = {
  queryClient: QueryClient
}

const authQueryOptions = {
  queryKey: ['auth', 'me'],
  queryFn: auth.me,
  retry: false,
  staleTime: 1000 * 60 * 5,
}

const publicRoutePrefixes = PUBLIC_ROUTES

async function getSetupNeeded(): Promise<boolean> {
  try {
    const status = await setup.status()
    return status.needsSetup
  } catch {
    return false
  }
}

async function getAuthUser(client: QueryClient) {
  const cached = client.getQueryData<User | null>(authQueryOptions.queryKey)
  if (cached) return cached
  if (cached === null) return null
  try {
    return await client.ensureQueryData(authQueryOptions)
  } catch {
    return null
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: App,
  beforeLoad: async ({ context, location }) => {
    const isSetupRoute = location.pathname.startsWith('/setup')
    const isPublicRoute = publicRoutePrefixes.some((route) =>
      location.pathname.startsWith(route)
    )

    const needsSetup = await getSetupNeeded()

    if (needsSetup) {
      if (!isSetupRoute) {
        return redirect({ to: '/setup', throw: true })
      }
      return undefined
    }

    if (isSetupRoute) {
      return redirect({ to: '/login', throw: true })
    }

    if (isPublicRoute) return undefined

    const user = await getAuthUser(context.queryClient)
    if (!user) {
      return redirect({ to: '/login', throw: true })
    }
    return undefined
  },
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
  beforeLoad: async ({ context }) => {
    const user = await getAuthUser(context.queryClient)
    if (user) {
      return redirect({ to: '/', throw: true })
    }
    return undefined
  },
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignupRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    invite: search.invite as string | undefined,
  }),
  beforeLoad: async ({ context }) => {
    const user = await getAuthUser(context.queryClient)
    if (user) {
      return redirect({ to: '/', throw: true })
    }
    return undefined
  },
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
  loader: async ({ context, params }) => {
    const userId =
      params.id === 'me' ? (await getAuthUser(context.queryClient))?.id : params.id

    if (!userId) return

    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ['users', userId],
        queryFn: () => users.get(userId),
      }),
      context.queryClient.ensureQueryData({
        queryKey: ['users', userId, 'posts'],
        queryFn: () => posts.userPosts(userId),
      }),
    ])
  },
})

const loadPost = async (context: RouterContext, postId: string) => {
  await Promise.all([
    context.queryClient.ensureQueryData({
      queryKey: ['posts', postId],
      queryFn: () => posts.get(postId),
    }),
    context.queryClient.prefetchQuery({
      queryKey: ['posts', postId, 'comments'],
      queryFn: () => posts.comments(postId),
    }),
  ])
}

const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/post/$id',
  component: PostRoute,
  loader: async ({ context, params }) => {
    await loadPost(context, params.id)
  },
})

const momentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/m/$id',
  component: PostRoute,
  loader: async ({ context, params }) => {
    await loadPost(context, params.id)
  },
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

const circlesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/circles',
  component: CirclesRoute,
})

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: ChatRoute,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  beforeLoad: async ({ context }) => {
    const user = await getAuthUser(context.queryClient)
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      return redirect({ to: '/', throw: true })
    }
    return undefined
  },
})

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: SetupRoute,
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: ResetPasswordRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string | undefined,
  }),
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPasswordRoute,
})

const confirmEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/confirm-email',
  component: ConfirmEmailRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string | undefined,
  }),
})

interface CustomRouteDefinition {
  path: string
  component: ComponentType
}

interface CustomExtModule {
  customRoutes?: CustomRouteDefinition[]
}

const customModules = import.meta.glob<CustomExtModule>('../../custom/frontend/index.ts', { eager: true })
const customModule = Object.values(customModules)[0]
const customChildRoutes = (customModule?.customRoutes ?? []).map((r) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: r.path,
    component: withSuspense(r.component),
  })
)

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  inviteRoute,
  profileRoute,
  postRoute,
  momentRoute,
  searchRoute,
  notificationsRoute,
  membersRoute,
  settingsRoute,
  circlesRoute,
  chatRoute,
  adminRoute,
  setupRoute,
  resetPasswordRoute,
  forgotPasswordRoute,
  confirmEmailRoute,
  ...customChildRoutes,
])

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultErrorComponent: ({ error }: { error: unknown }) => (
    <RouteErrorFallback error={error instanceof Error ? error : new Error(String(error))} />
  ),
})

void useAppSettings.getState().fetchSettings()

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
          <Lightbox />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </ErrorBoundary>,
  document.getElementById('app')!
)
