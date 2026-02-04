import { AlertTriangle, RefreshCw, Home } from 'lucide-preact'
import { useRouter } from '@tanstack/react-router'

interface RouteErrorFallbackProps {
  error?: Error
  reset?: () => void
}

export function RouteErrorFallback({ error, reset }: RouteErrorFallbackProps) {
  const router = useRouter()

  const handleRetry = () => {
    if (reset) {
      reset()
    } else {
      void router.invalidate()
    }
  }

  const handleGoHome = () => {
    void router.navigate({ to: '/' })
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-white rounded-4xl p-8 w-full max-w-md shadow-sm border border-gray-100 text-center">
        <div className="inline-flex p-4 rounded-2xl bg-amber-100 mb-6">
          <AlertTriangle size={32} className="text-amber-500" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Failed to load this page
        </h2>

        <p className="text-gray-500 mb-6">
          We couldn't load the content. Check your connection and try again.
        </p>

        {import.meta.env.DEV && error && (
          <pre className="text-left text-xs bg-gray-100 rounded-2xl p-4 mb-6 overflow-auto max-h-32 text-red-600">
            {error.message}
          </pre>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleGoHome}
            className="flex-1 py-3 px-4 rounded-2xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <Home size={18} />
            Home
          </button>
          <button
            onClick={handleRetry}
            className="flex-1 py-3 px-4 rounded-2xl font-bold text-white bg-accent-500 hover:bg-accent-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} />
            Retry
          </button>
        </div>
      </div>
    </div>
  )
}

interface FeedErrorFallbackProps {
  onRetry: () => void
}

export function FeedErrorFallback({ onRetry }: FeedErrorFallbackProps) {
  return (
    <div className="bg-white rounded-4xl p-8 w-full max-w-2xl mx-auto shadow-sm border border-gray-100 text-center">
      <div className="inline-flex p-4 rounded-2xl bg-amber-100 mb-6">
        <AlertTriangle size={28} className="text-amber-500" />
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-2">
        Couldn't load posts
      </h3>

      <p className="text-gray-500 mb-6 text-sm">
        Something went wrong loading your feed. Try again?
      </p>

      <button
        onClick={onRetry}
        className="py-3 px-6 rounded-2xl font-bold text-white bg-accent-500 hover:bg-accent-600 transition-colors inline-flex items-center gap-2"
      >
        <RefreshCw size={18} />
        Retry
      </button>
    </div>
  )
}
