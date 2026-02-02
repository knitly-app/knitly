import { render } from 'preact'
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
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmModal'
import { auth, posts, users, type User } from './api/endpoints'
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

type RouterContext = {
  queryClient: QueryClient
}

const authQueryOptions = {
  queryKey: ['auth', 'me'],
  queryFn: auth.me,
  retry: false,
  staleTime: 1000 * 60 * 5,
}

const publicRoutePrefixes = ['/login', '/signup', '/invite']

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
    const isPublicRoute = publicRoutePrefixes.some((route) =>
      location.pathname.startsWith(route)
    )

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
  adminRoute,
])

const router = createRouter({ routeTree, context: { queryClient } })

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
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </ErrorBoundary>,
  document.getElementById('app')!
)
