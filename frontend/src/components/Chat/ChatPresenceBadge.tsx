import { Users } from 'lucide-preact'

interface ChatPresenceBadgeProps {
  count: number
  size?: 'sm' | 'md'
}

export function ChatPresenceBadge({ count, size = 'md' }: ChatPresenceBadgeProps) {
  if (count === 0) return null

  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5 gap-1'
    : 'text-sm px-2 py-1 gap-1.5'

  const iconSize = size === 'sm' ? 12 : 14

  return (
    <div className={`flex items-center bg-green-50 text-green-600 rounded-full font-medium ${sizeClasses}`}>
      <Users size={iconSize} />
      <span>{count} online</span>
    </div>
  )
}
