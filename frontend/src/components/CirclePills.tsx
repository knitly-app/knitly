import { Plus } from 'lucide-preact'

interface Circle {
  id: string
  name: string
  color: string
}

interface CirclePillsProps {
  circles: Circle[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  showAdd?: boolean
  onAdd?: () => void
}

const CIRCLE_COLORS: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
}

export function CirclePills({ circles, selectedId, onSelect, showAdd, onAdd }: CirclePillsProps) {
  const isAllSelected = selectedId === null

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
      style={{ maskImage: 'linear-gradient(to right, black calc(100% - 3rem), transparent 100%)' }}
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
          isAllSelected
            ? 'bg-accent-500 text-white'
            : 'border border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-white" />
        All
      </button>

      {circles.map((circle) => {
        const isSelected = selectedId === circle.id
        const dotColor = CIRCLE_COLORS[circle.color] || 'bg-gray-400'

        return (
          <button
            key={circle.id}
            type="button"
            onClick={() => onSelect(circle.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              isSelected
                ? 'bg-gray-800 text-white'
                : 'border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
            {circle.name}
          </button>
        )
      })}

      {showAdd && circles.length < 4 && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
        >
          <Plus size={14} />
          Add
        </button>
      )}
    </div>
  )
}
