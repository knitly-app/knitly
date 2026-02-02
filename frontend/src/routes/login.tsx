import { useState } from 'preact/hooks'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'

export function LoginRoute() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoggingIn, loginError } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    try {
      await login({ email, password })
      void navigate({ to: '/' })
    } catch {
      // error handled by hook
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-accent-500 tracking-tighter mb-2">Knitly</h1>
          <p className="text-gray-500">Welcome back to Knitly</p>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
          className="bg-white rounded-4xl p-8 shadow-sm border border-gray-100"
        >
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium">
              Invalid email or password
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full mt-8 py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all disabled:opacity-50"
          >
            {isLoggingIn ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="mt-6 text-center text-gray-400 text-sm">
            Knitly is invite-only. Ask a member for an invite link.
          </p>
        </form>
      </div>
    </div>
  )
}
