interface ChatSystemMessageProps {
  type: 'join' | 'leave'
  username: string
}

export function ChatSystemMessage({ type, username }: ChatSystemMessageProps) {
  return (
    <div className="flex justify-center py-2">
      <span className="text-xs text-gray-400 italic">
        {type === 'join' ? `${username} entered` : `${username} left`}
      </span>
    </div>
  )
}
