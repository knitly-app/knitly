import type { ComponentChildren, VNode } from "preact";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
} from "@tanstack/react-router";
import { render, renderHook, waitFor, type RenderResult } from "@testing-library/preact";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmModal";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface RenderOptions {
  queryClient?: QueryClient;
  path?: string;
  initialEntries?: string[];
  withProviders?: boolean;
}

export interface ProvidersRenderResult extends RenderResult {
  queryClient: QueryClient;
}

export async function renderWithProviders(
  ui: ComponentChildren,
  options: RenderOptions = {}
): Promise<ProvidersRenderResult> {
  const queryClient = options.queryClient ?? makeQueryClient();
  const path = options.path ?? "/";
  const initialEntries = options.initialEntries ?? [path];

  const rootRoute = createRootRoute();
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => <>{ui}</>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries }),
  });
  await router.load();

  const wrap = (children: ComponentChildren): VNode => {
    const inner =
      options.withProviders === false ? (
        <>{children}</>
      ) : (
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      );
    return <QueryClientProvider client={queryClient}>{inner}</QueryClientProvider>;
  };

  const result = render(wrap(<RouterProvider router={router} />));
  return Object.assign(result, { queryClient });
}

export function renderHookWithClient<TResult, TProps>(
  callback: (props: TProps) => TResult,
  queryClient: QueryClient = makeQueryClient()
) {
  return renderHook(callback, {
    wrapper: ({ children }: { children: ComponentChildren }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

export { waitFor, renderHook };
