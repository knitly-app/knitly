import { useState, useEffect } from 'preact/hooks'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'

export function SignupRoute() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const { signup, isSigningUp, signupError } = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ from: '/signup' })

  useEffect(() => {
    if (!search.invite) {
      void navigate({ to: '/login' })
    }
  }, [search.invite, navigate])

  if (!search.invite) {
    return null
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    try {
      await signup({
        email,
        password,
        username,
        displayName,
        inviteToken: search.invite,
      })
      void navigate({ to: '/' })
    } catch {
      // error handled by hook
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-accent-500 tracking-tighter mb-2">Knitly</h1>
          <p className="text-gray-500">Join your private social network</p>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
          className="bg-white rounded-4xl p-8 shadow-sm border border-gray-100"
        >
          {signupError && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium">
              Failed to create account. Please try again.
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onInput={(e) => setDisplayName((e.target as HTMLInputElement).value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
                placeholder="Your Name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
                placeholder="username"
                required
              />
            </div>

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
                placeholder="Choose a strong password"
                required
                minLength={8}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSigningUp}
            className="w-full mt-8 py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all disabled:opacity-50"
          >
            {isSigningUp ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="mt-6 text-center text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-500 font-bold hover:text-accent-600">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
