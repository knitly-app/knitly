import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'preact/hooks'
import { chat, type ChatMessage, type ChatPresenceResponse } from '../api/endpoints'
import { queryKeys } from '../api/queryKeys'

const SYSTEM_MESSAGE_TTL_MS = 30000

type SystemMessage = { id: string; type: 'join' | 'leave'; username: string; timestamp: number }

export function useChatMessages() {
  const queryClient = useQueryClient()
  const lastIdRef = useRef('0')

  const accumulatedQuery = useQuery({
    queryKey: queryKeys.chat.messagesAccumulated(),
    queryFn: () => [] as ChatMessage[],
    staleTime: Infinity,
  })

  const systemMessagesQuery = useQuery({
    queryKey: queryKeys.chat.systemMessages(),
    queryFn: () => [] as SystemMessage[],
    staleTime: Infinity,
  })

  const { isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.chat.messages(),
    queryFn: async () => {
      const result = await chat.messages(lastIdRef.current)
      if (result.messages.length > 0) {
        lastIdRef.current = result.messages[result.messages.length - 1].id
        queryClient.setQueryData<ChatMessage[]>(queryKeys.chat.messagesAccumulated(), (prev = []) => {
          const existingIds = new Set(prev.map((m) => m.id))
          const newMessages = result.messages.filter((m) => !existingIds.has(m.id))
          return newMessages.length > 0 ? [...prev, ...newMessages] : prev
        })
      }
      return result
    },
    refetchInterval: () => (document.hasFocus() ? 3000 : 30000),
    refetchIntervalInBackground: true,
  })

  const messages = accumulatedQuery.data ?? []

  const presenceQuery = useQuery({
    queryKey: queryKeys.chat.presence(),
    queryFn: async () => {
      const previousUsers = new Set(
        queryClient.getQueryData<ChatPresenceResponse>(queryKeys.chat.presence())?.users ?? []
      )
      const result = await chat.presence()
      const now = Date.now()
      const cutoff = now - SYSTEM_MESSAGE_TTL_MS

      const newEntries: SystemMessage[] = [
        ...result.joins
          .filter((username) => !previousUsers.has(username))
          .map((username) => ({ id: `join-${now}-${username}`, type: 'join' as const, username, timestamp: now })),
        ...result.leaves.map((username) => ({ id: `leave-${now}-${username}`, type: 'leave' as const, username, timestamp: now })),
      ]

      queryClient.setQueryData<SystemMessage[]>(queryKeys.chat.systemMessages(), (prev = []) =>
        [...prev, ...newEntries].filter((m) => m.timestamp > cutoff)
      )

      return result
    },
    refetchInterval: 30000,
  })

  const systemMessages = systemMessagesQuery.data ?? []

  const sendMutation = useMutation({
    mutationFn: chat.send,
    onSuccess: (newMessage) => {
      queryClient.setQueryData<ChatMessage[]>(queryKeys.chat.messagesAccumulated(), (prev = []) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev
        lastIdRef.current = newMessage.id
        return [...prev, newMessage]
      })
    },
  })

  return {
    messages,
    systemMessages,
    isLoading,
    isError,
    refetch,
    send: sendMutation.mutate,
    isSending: sendMutation.isPending,
    sendError: sendMutation.error,
    onlineCount: presenceQuery.data?.online ?? 0,
    onlineUsers: presenceQuery.data?.users ?? [],
  }
}

export function useChatStatus() {
  const { data } = useQuery({
    queryKey: queryKeys.chat.status(),
    queryFn: chat.status,
    refetchInterval: 30000,
  })
  return data?.online ?? 0
}

export function useChatPresenceHeartbeat() {
  useEffect(() => {
    void chat.presence()

    const interval = setInterval(() => {
      void chat.presence()
    }, 30000)

    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/chat/leave')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      void chat.leave()
    }
  }, [])
}
