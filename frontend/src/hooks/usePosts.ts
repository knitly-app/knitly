import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { posts, type Post, type Comment, type User, type ReactionType, type CreatePostData } from '../api/endpoints'
import { useToast } from '../components/Toast'
import { queryKeys } from '../api/queryKeys'

export function useFeed(circleId?: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed.byCircle(circleId),
    queryFn: ({ pageParam }) => posts.feed(pageParam, circleId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
  })
}

export function usePost(id: string) {
  return useQuery({
    queryKey: queryKeys.posts.detail(id),
    queryFn: () => posts.get(id),
    enabled: !!id,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  })
}

export function useUserPosts(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.posts(userId),
    queryFn: () => posts.userPosts(userId),
    enabled: !!userId,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  })
}

export function useUserMedia(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.media(userId),
    queryFn: () => posts.userPosts(userId, true),
    enabled: !!userId,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  })
}

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreatePostData) => posts.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() })
    },
  })
}

export function useReaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, type, currentReaction }: { id: string; type: ReactionType; currentReaction: ReactionType | null }) =>
      currentReaction === type ? posts.unreact(id) : posts.react(id, type),
    onMutate: async ({ id, type, currentReaction }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.detail(id) })
      const previous = queryClient.getQueryData<Post>(queryKeys.posts.detail(id))
      if (previous) {
        const newReactions = { ...previous.reactions }
        // Remove old reaction count
        if (currentReaction && newReactions[currentReaction]) {
          newReactions[currentReaction] = (newReactions[currentReaction] || 1) - 1
          if (newReactions[currentReaction] === 0) delete newReactions[currentReaction]
        }
        // Add new reaction count (unless toggling off)
        const isToggleOff = currentReaction === type
        if (!isToggleOff) {
          newReactions[type] = (newReactions[type] || 0) + 1
        }
        queryClient.setQueryData<Post>(queryKeys.posts.detail(id), {
          ...previous,
          reactions: newReactions,
          userReaction: isToggleOff ? null : type,
        })
      }
      return { previous }
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.posts.detail(id), context.previous)
      }
    },
    onSettled: (_data, _err, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() })
    },
  })
}

export function usePostComments(postId: string) {
  return useQuery({
    queryKey: queryKeys.posts.comments(postId),
    queryFn: () => posts.comments(postId),
    enabled: !!postId,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
  })
}

export function useAddComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      posts.addComment(postId, content),
    onMutate: async ({ postId, content }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.comments(postId) })
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.detail(postId) })

      const previousComments = queryClient.getQueryData<Comment[]>(queryKeys.posts.comments(postId))
      const previousPost = queryClient.getQueryData<Post>(queryKeys.posts.detail(postId))
      const user = queryClient.getQueryData<User>(queryKeys.auth.me())

      if (user) {
        const optimisticComment: Comment = {
          id: `temp-${Date.now()}`,
          postId,
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          content,
          createdAt: new Date().toISOString(),
        }
        queryClient.setQueryData<Comment[]>(queryKeys.posts.comments(postId), (old) =>
          old ? [...old, optimisticComment] : [optimisticComment]
        )
      }

      if (previousPost) {
        queryClient.setQueryData<Post>(queryKeys.posts.detail(postId), {
          ...previousPost,
          comments: previousPost.comments + 1,
        })
      }

      return { previousComments, previousPost }
    },
    onError: (_err, { postId }, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(queryKeys.posts.comments(postId), context.previousComments)
      }
      if (context?.previousPost) {
        queryClient.setQueryData(queryKeys.posts.detail(postId), context.previousPost)
      }
    },
    onSettled: (_data, _err, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(postId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(postId) })
    },
  })
}

export function useDeletePost(options?: { onSuccess?: (postId: string) => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (postId: string) => posts.delete(postId),
    onSuccess: (_data, postId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all() })
      queryClient.removeQueries({ queryKey: queryKeys.posts.detail(postId) })
      toast.success('Post deleted')
      options?.onSuccess?.(postId)
    },
    onError: () => {
      toast.error('Failed to delete post')
    },
  })
}

export function useEditPost() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => posts.update(id, content),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.posts.detail(updated.id), updated)
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })
      toast.success('Post updated')
    },
    onError: () => {
      toast.error('Failed to update post')
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ postId, commentId }: { postId: string; commentId: string }) =>
      posts.deleteComment(postId, commentId),
    onSuccess: (_data, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(postId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(postId) })
    },
  })
}

export function useVotePoll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ postId, optionId }: { postId: string; optionId: string }) =>
      posts.vote(postId, optionId),
    onSuccess: (data, { postId }) => {
      queryClient.setQueryData<Post>(queryKeys.posts.detail(postId), (old) =>
        old ? { ...old, poll: data.poll } : old
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() })
    },
  })
}
