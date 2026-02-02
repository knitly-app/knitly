import { Component, type ComponentChildren } from 'preact'
import { AlertOctagon, RefreshCw } from 'lucide-preact'

interface Props {
  children: ComponentChildren
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-xl text-center">
            <div className="inline-flex p-4 rounded-2xl bg-red-100 mb-6">
              <AlertOctagon size={32} className="text-red-500" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>

            <p className="text-gray-500 mb-6">
              We hit an unexpected error. Try refreshing, or come back later if it persists.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs bg-gray-100 rounded-2xl p-4 mb-6 overflow-auto max-h-32 text-red-600">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-2xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-2xl font-bold text-white bg-accent-500 hover:bg-accent-600 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                Reload
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
