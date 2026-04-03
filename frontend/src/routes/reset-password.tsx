import { useState } from 'preact/hooks'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { auth } from '../api/endpoints'
import { AuthLayout, AuthCard } from '../components/AuthLayout'

const VALIDATION_MESSAGES: Record<string, string> = {
  expired: 'This reset link has expired.',
  disabled: 'This account has been disabled.',
  invalid: 'This reset link is invalid or has already been used.',
}

export function ResetPasswordRoute() {
  const { token } = useSearch({ from: '/reset-password' })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const { data: validation, isLoading: validating } = useQuery({
    queryKey: ['auth', 'reset-token', token],
    queryFn: () => auth.validateResetToken(token!),
    enabled: !!token,
    retry: false,
  })

  const resetMutation = useMutation({
    mutationFn: () => auth.resetPassword({ token: token!, password }),
  })

  const passwordTooShort = password.length > 0 && password.length < 8
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = password.length >= 8 && password === confirmPassword && !resetMutation.isPending

  if (!token) {
    return (
      <AuthLayout>
        <AuthCard centered>
          <p className="text-gray-600 mb-6">No reset token provided.</p>
          <Link to="/login" className="text-accent-500 font-semibold hover:underline">
            Back to login
          </Link>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (validating) {
    return (
      <AuthLayout>
        <AuthCard centered>
          <p className="text-gray-500">Validating reset link...</p>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (!validation?.valid) {
    return (
      <AuthLayout>
        <AuthCard centered>
          <p className="text-gray-600 mb-6">
            {VALIDATION_MESSAGES[validation?.reason ?? 'invalid']}
          </p>
          <Link to="/login" className="text-accent-500 font-semibold hover:underline">
            Back to login
          </Link>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (resetMutation.isSuccess) {
    return (
      <AuthLayout>
        <AuthCard centered>
          <p className="text-gray-600 mb-6">Your password has been reset successfully.</p>
          <Link
            to="/login"
            className="inline-block w-full py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all text-center"
          >
            Sign In
          </Link>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout subtitle={`Set a new password${validation.displayName ? ` for ${validation.displayName}` : ''}`}>
      <AuthCard>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) resetMutation.mutate()
          }}
        >
          {resetMutation.isError && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium">
              Failed to reset password. The link may have expired.
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">New Password</label>
              <input
                type="password"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
              {passwordTooShort && (
                <p className="mt-2 text-sm text-red-500">Password must be at least 8 characters</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
                placeholder="Re-enter your password"
                required
              />
              {passwordMismatch && (
                <p className="mt-2 text-sm text-red-500">Passwords do not match</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full mt-8 py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all disabled:opacity-50"
          >
            {resetMutation.isPending ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </AuthCard>
    </AuthLayout>
  )
}
