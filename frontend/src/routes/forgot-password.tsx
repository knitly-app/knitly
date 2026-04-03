import { useState } from 'preact/hooks'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { auth } from '../api/endpoints'
import { AuthLayout, AuthCard } from '../components/AuthLayout'

export function ForgotPasswordRoute() {
  const [email, setEmail] = useState('')

  const forgotMutation = useMutation({
    mutationFn: () => auth.forgotPassword(email),
  })

  const canSubmit = email.length > 0 && !forgotMutation.isPending

  if (forgotMutation.isSuccess) {
    return (
      <AuthLayout>
        <AuthCard centered>
          <p className="text-gray-600 mb-6">
            If an account exists with that email, we've sent a reset link.
          </p>
          <Link to="/login" className="text-accent-500 font-semibold hover:underline">
            Back to login
          </Link>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout subtitle="Reset your password">
      <AuthCard>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) forgotMutation.mutate()
          }}
        >
          {forgotMutation.isError && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium">
              Too many requests. Please try again later.
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
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full mt-8 py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all disabled:opacity-50"
          >
            {forgotMutation.isPending ? 'Sending...' : 'Send Reset Link'}
          </button>

          <p className="mt-6 text-center">
            <Link to="/login" className="text-accent-500 font-semibold hover:underline text-sm">
              Back to login
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  )
}
