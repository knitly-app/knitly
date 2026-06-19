import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '../api/endpoints'
import { queryKeys } from '../api/queryKeys'

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: notifications.list,
    refetchOnWindowFocus: true,
    staleTime: 60000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: notifications.markRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: notifications.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() })
    },
  })
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: notifications.clearAll,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() })
    },
  })
}

export function useUnreadCount() {
  const { data: notifs } = useNotifications()
  return notifs?.filter((n) => !n.read).length ?? 0
}
