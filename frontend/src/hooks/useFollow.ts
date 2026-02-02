import { useMutation, useQueryClient } from '@tanstack/react-query'
import { users } from '../api/endpoints'

export function useFollow(userId: string | undefined) {
  const queryClient = useQueryClient()

  const followMutation = useMutation({
    mutationFn: () => users.follow(userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', userId] })
    },
  })

  const unfollowMutation = useMutation({
    mutationFn: () => users.unfollow(userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', userId] })
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
