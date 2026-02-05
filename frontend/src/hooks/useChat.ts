import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'preact/hooks'
import { chat, type ChatMessage } from '../api/endpoints'

export function useChatMessages() {
  const queryClient = useQueryClient()
  const [systemMessages, setSystemMessages] = useState<{ id: string; type: 'join' | 'leave'; username: string; timestamp: number }[]>([])
  const lastIdRef = useRef('0')
  const previousUsersRef = useRef<Set<string>>(new Set())

  const accumulatedQuery = useQuery({
    queryKey: ['chat', 'messages', 'accumulated'],
    queryFn: () => [] as ChatMessage[],
    staleTime: Infinity,
  })

  const { isLoading, isError, refetch } = useQuery({
    queryKey: ['chat', 'messages'],
    queryFn: async () => {
      const result = await chat.messages(lastIdRef.current)
      if (result.messages.length > 0) {
        lastIdRef.current = result.messages[result.messages.length - 1].id
        queryClient.setQueryData<ChatMessage[]>(['chat', 'messages', 'accumulated'], (prev = []) => {
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
    queryKey: ['chat', 'presence'],
    queryFn: chat.presence,
    refetchInterval: 30000,
  })

  useEffect(() => {
    if (presenceQuery.data) {
      const currentUsers = new Set(presenceQuery.data.users)
      const now = Date.now()

      for (const username of presenceQuery.data.joins) {
        if (!previousUsersRef.current.has(username)) {
          setSystemMessages((prev) => [...prev, { id: `join-${now}-${username}`, type: 'join', username, timestamp: now }])
        }
      }

      for (const username of presenceQuery.data.leaves) {
        setSystemMessages((prev) => [...prev, { id: `leave-${now}-${username}`, type: 'leave', username, timestamp: now }])
      }

      previousUsersRef.current = currentUsers
    }
  }, [presenceQuery.data])

  useEffect(() => {
    const cleanup = setInterval(() => {
      const cutoff = Date.now() - 30000
      setSystemMessages((prev) => prev.filter((m) => m.timestamp > cutoff))
    }, 10000)
    return () => clearInterval(cleanup)
  }, [])

  const sendMutation = useMutation({
    mutationFn: chat.send,
    onSuccess: (newMessage) => {
      queryClient.setQueryData<ChatMessage[]>(['chat', 'messages', 'accumulated'], (prev = []) => {
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
    queryKey: ['chat', 'status'],
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
