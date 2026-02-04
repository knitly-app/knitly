import { useEffect, useRef } from 'preact/hooks'
import { useAuth } from '../../hooks/useAuth'
import { useChatMessages, useChatPresenceHeartbeat } from '../../hooks/useChat'
import { ChatMessage } from './ChatMessage'
import { ChatSystemMessage } from './ChatSystemMessage'
import { ChatInput } from './ChatInput'
import { ChatPresenceBadge } from './ChatPresenceBadge'
import { Spinner } from '../Spinner'

export function ChatRoom() {
  const { user } = useAuth()
  const { messages, systemMessages, isLoading, send, isSending, onlineCount } = useChatMessages()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  useChatPresenceHeartbeat()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom()
    }
  }, [messages, systemMessages])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50
  }

  const allItems = [
    ...messages.map((m) => ({ type: 'message' as const, data: m, sortKey: new Date(m.createdAt).getTime() })),
    ...systemMessages.map((s) => ({ type: 'system' as const, data: s, sortKey: s.timestamp })),
  ].sort((a, b) => a.sortKey - b.sortKey)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div>
          <h1 className="text-lg font-bold text-gray-900">The Lobby</h1>
          <p className="text-xs text-gray-400">Chat with your people</p>
        </div>
        <ChatPresenceBadge count={onlineCount} />
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {allItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            No messages yet. Say hello!
          </div>
        ) : (
          allItems.map((item) => {
            if (item.type === 'system') {
              return (
                <ChatSystemMessage
                  key={item.data.id}
                  type={item.data.type}
                  username={item.data.username}
                />
              )
            }
            return (
              <ChatMessage
                key={item.data.id}
                message={item.data}
                isOwn={item.data.userId === user?.id}
              />
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={(content) => send(content)} disabled={isSending} />
    </div>
  )
}
