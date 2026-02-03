import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-preact'
import { CircleManager } from '../components/CircleManager'

export function CirclesRoute() {
  const navigate = useNavigate()

  return (
    <div className="w-full max-w-2xl mx-auto py-4 md:py-8 px-4 md:px-0">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => {
            void navigate({ to: '/settings' })
          }}
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back</span>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Circles</h1>
        <div className="w-16" />
      </div>

      <p className="text-gray-500 mb-6">
        Circles let you share Moments with specific groups of people. Create circles for family,
        close friends, neighbors, or any group you want to share with privately.
      </p>

      <CircleManager />
    </div>
  )
}
