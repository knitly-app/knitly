import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { circles } from '../api/endpoints'
import { useToast } from '../components/Toast'
import { queryKeys } from '../api/queryKeys'

export const MAX_CIRCLES = 4

export function useCircles() {
  const query = useQuery({
    queryKey: queryKeys.circles.all(),
    queryFn: circles.list,
  })

  const canCreateCircle = (query.data?.length ?? 0) < MAX_CIRCLES

  return {
    ...query,
    canCreateCircle,
  }
}

export function useCircle(id: string) {
  return useQuery({
    queryKey: queryKeys.circles.detail(id),
    queryFn: () => circles.get(id),
    enabled: !!id,
  })
}

export function useCreateCircle() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async (data: Parameters<typeof circles.create>[0]) => {
      const currentCircles = queryClient.getQueryData<unknown[]>(queryKeys.circles.all()) ?? []
      if (currentCircles.length >= MAX_CIRCLES) {
        throw new Error(`Maximum of ${MAX_CIRCLES} circles allowed`)
      }
      return circles.create(data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.circles.all() })
      toast.success('Circle created')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create circle')
    },
  })
}

export function useUpdateCircle() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) =>
      circles.update(id, data),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.circles.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.circles.detail(id) })
      toast.success('Circle updated')
    },
    onError: () => {
      toast.error('Failed to update circle')
    },
  })
}

export function useDeleteCircle() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: circles.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.circles.all() })
      toast.success('Circle deleted')
    },
    onError: () => {
      toast.error('Failed to delete circle')
    },
  })
}

export function useAddCircleMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ circleId, userIds }: { circleId: string; userIds: number[] }) =>
      circles.addMembers(circleId, userIds),
    onSuccess: (_, { circleId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.circles.detail(circleId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.circles.all() })
    },
  })
}

export function useRemoveCircleMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ circleId, userId }: { circleId: string; userId: string }) =>
      circles.removeMember(circleId, userId),
    onSuccess: (_, { circleId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.circles.detail(circleId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.circles.all() })
    },
  })
}
