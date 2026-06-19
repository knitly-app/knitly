import { useMutation, useQueryClient } from '@tanstack/react-query'
import { users } from '../api/endpoints'
import { queryKeys } from '../api/queryKeys'

export function useFollow(userId: string | undefined) {
  const queryClient = useQueryClient()

  const followMutation = useMutation({
    mutationFn: () => users.follow(userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId!) })
    },
  })

  const unfollowMutation = useMutation({
    mutationFn: () => users.unfollow(userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId!) })
    },
  })

  return {
    follow: followMutation.mutate,
    unfollow: unfollowMutation.mutate,
    isPending: followMutation.isPending || unfollowMutation.isPending,
    toggle: (isFollowing: boolean) => {
      if (isFollowing) {
        unfollowMutation.mutate()
      } else {
        followMutation.mutate()
      }
    },
  }
}
