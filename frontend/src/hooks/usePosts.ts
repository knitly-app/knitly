import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { posts, type Post, type Comment, type User } from '../api/endpoints'

export function useFeed() {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => posts.feed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ['posts', id],
    queryFn: () => posts.get(id),
    enabled: !!id,
  })
}

export function useUserPosts(userId: string) {
  return useQuery({
    queryKey: ['users', userId, 'posts'],
    queryFn: () => posts.userPosts(userId),
    enabled: !!userId,
  })
}

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: posts.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useLikePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      liked ? posts.unlike(id) : posts.like(id),
    onMutate: async ({ id, liked }) => {
      await queryClient.cancelQueries({ queryKey: ['posts', id] })
      const previous = queryClient.getQueryData<Post>(['posts', id])
      if (previous) {
        queryClient.setQueryData<Post>(['posts', id], {
          ...previous,
          liked: !liked,
          likes: liked ? previous.likes - 1 : previous.likes + 1,
        })
      }
      return { previous }
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['posts', id], context.previous)
      }
    },
    onSettled: (_data, _err, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['posts', id] })
      void queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function usePostComments(postId: string) {
  return useQuery({
    queryKey: ['posts', postId, 'comments'],
    queryFn: () => posts.comments(postId),
    enabled: !!postId,
  })
}

export function useAddComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      posts.addComment(postId, content),
    onMutate: async ({ postId, content }) => {
      await queryClient.cancelQueries({ queryKey: ['posts', postId, 'comments'] })
      await queryClient.cancelQueries({ queryKey: ['posts', postId] })

      const previousComments = queryClient.getQueryData<Comment[]>(['posts', postId, 'comments'])
      const previousPost = queryClient.getQueryData<Post>(['posts', postId])
      const user = queryClient.getQueryData<User>(['auth', 'me'])

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
        queryClient.setQueryData<Comment[]>(['posts', postId, 'comments'], (old) =>
          old ? [...old, optimisticComment] : [optimisticComment]
        )
      }

      if (previousPost) {
        queryClient.setQueryData<Post>(['posts', postId], {
          ...previousPost,
          comments: previousPost.comments + 1,
        })
      }

      return { previousComments, previousPost }
    },
    onError: (_err, { postId }, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['posts', postId, 'comments'], context.previousComments)
      }
      if (context?.previousPost) {
        queryClient.setQueryData(['posts', postId], context.previousPost)
      }
    },
    onSettled: (_data, _err, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: ['posts', postId, 'comments'] })
      void queryClient.invalidateQueries({ queryKey: ['posts', postId] })
    },
  })
}

export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (postId: string) => posts.delete(postId),
    onSuccess: (_data, postId) => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.removeQueries({ queryKey: ['posts', postId] })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ postId, commentId }: { postId: string; commentId: string }) =>
      posts.deleteComment(postId, commentId),
    onSuccess: (_data, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: ['posts', postId, 'comments'] })
      void queryClient.invalidateQueries({ queryKey: ['posts', postId] })
    },
  })
}
