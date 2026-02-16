import type { ChatMessage as ChatMessageType } from '../../api/endpoints'
import { BotBadge } from '../BotBadge'

interface ChatMessageProps {
  message: ChatMessageType
  isOwn: boolean
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  return date.toLocaleDateString()
}

export function ChatMessage({ message, isOwn }: ChatMessageProps) {
  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {message.avatar ? (
        <img
          src={message.avatar}
          alt={message.displayName}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <span className="text-gray-500 text-sm font-medium">
            {message.displayName[0]?.toUpperCase() || '?'}
          </span>
        </div>
      )}

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
        <div className={`flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-sm font-medium text-gray-900">{message.displayName}</span>
          {message.role === 'bot' && <BotBadge />}
          <span className="text-xs text-gray-400">@{message.username}</span>
        </div>

        <div
          className={`mt-1 px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-accent-500 text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-900 rounded-tl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        <span className="text-xs text-gray-400 mt-1">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  )
}
