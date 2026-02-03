import { useState } from 'preact/hooks'
import { useCreateCircle } from '../hooks/useCircles'

interface CircleOnboardingProps {
  onComplete: () => void
  onSkip: () => void
}

const COLORS = [
  { name: 'red', bg: 'bg-red-500', ring: 'ring-red-300' },
  { name: 'blue', bg: 'bg-blue-500', ring: 'ring-blue-300' },
  { name: 'green', bg: 'bg-green-500', ring: 'ring-green-300' },
  { name: 'purple', bg: 'bg-purple-500', ring: 'ring-purple-300' },
  { name: 'orange', bg: 'bg-orange-500', ring: 'ring-orange-300' },
  { name: 'pink', bg: 'bg-pink-500', ring: 'ring-pink-300' },
]

const DEFAULT_CIRCLES = [
  { name: 'Family', color: 'blue' },
  { name: 'Friends', color: 'green' },
  { name: '', color: 'purple' },
  { name: '', color: 'orange' },
]

export function CircleOnboarding({ onComplete, onSkip }: CircleOnboardingProps) {
  const [circles, setCircles] = useState(DEFAULT_CIRCLES)
  const [isCreating, setIsCreating] = useState(false)
  const createCircle = useCreateCircle()

  const updateCircle = (index: number, field: 'name' | 'color', value: string) => {
    setCircles((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    )
  }

  const handleContinue = async () => {
    const toCreate = circles.filter((c) => c.name.trim())
    if (toCreate.length === 0) {
      onSkip()
      return
    }

    setIsCreating(true)
    try {
      await Promise.all(
        toCreate.map((c) => createCircle.mutateAsync({ name: c.name.trim(), color: c.color }))
      )
      onComplete()
    } catch {
      setIsCreating(false)
    }
  }

  const filledCount = circles.filter((c) => c.name.trim()).length

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
        <div className="p-6 pb-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Who do you want to share with?
          </h2>
          <p className="text-gray-500 mt-2">
            Create up to 4 circles for different groups
          </p>
        </div>

        <div className="px-6 space-y-3">
          {circles.map((circle, index) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="text"
                value={circle.name}
                onInput={(e) =>
                  updateCircle(index, 'name', (e.target as HTMLInputElement).value)
                }
                placeholder={`Circle ${index + 1}`}
                className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100 text-gray-800 placeholder-gray-400"
              />
              <div className="flex gap-1.5">
                {COLORS.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => updateCircle(index, 'color', color.name)}
                    className={`w-6 h-6 rounded-full ${color.bg} transition-all ${
                      circle.color === color.name
                        ? `ring-2 ${color.ring} ring-offset-1`
                        : 'hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 pt-8 space-y-3">
          <button
            onClick={() => void handleContinue()}
            disabled={isCreating}
            className="w-full py-3.5 bg-accent-500 text-white rounded-2xl font-bold hover:bg-accent-600 transition-colors disabled:opacity-50"
          >
            {isCreating
              ? 'Creating...'
              : filledCount > 0
                ? `Continue with ${filledCount} circle${filledCount > 1 ? 's' : ''}`
                : 'Continue'}
          </button>
          <button
            onClick={onSkip}
            disabled={isCreating}
            className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
