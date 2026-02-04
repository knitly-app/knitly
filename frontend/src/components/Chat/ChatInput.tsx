import { useState } from 'preact/hooks'
import { Send } from 'lucide-preact'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
}

const MAX_LENGTH = 500

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const remaining = MAX_LENGTH - value.length
  const isOverLimit = remaining < 0

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4 border-t border-gray-100 bg-white">
      <div className="flex-1 relative">
        <textarea
          value={value}
          onInput={(e) => setValue((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          disabled={disabled}
          className="w-full px-4 py-3 bg-gray-50 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-accent-200 disabled:opacity-50 text-sm"
          style={{ minHeight: '44px', maxHeight: '120px' }}
        />
        {value.length > 0 && (
          <span className={`absolute bottom-2 right-3 text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
            {remaining}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || !value.trim() || isOverLimit}
        className="p-3 bg-accent-500 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-600 transition-colors"
      >
        <Send size={20} />
      </button>
    </form>
  )
}
