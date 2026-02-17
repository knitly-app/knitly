import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '../api/endpoints'

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
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
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: notifications.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: notifications.clearAll,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useUnreadCount() {
  const { data: notifs } = useNotifications()
  return notifs?.filter((n) => !n.read).length ?? 0
}
