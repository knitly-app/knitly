import { useState } from 'preact/hooks'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { auth } from '../api/endpoints'
import { useAppSettings } from '../hooks/useAppSettings'
import type { ComponentChildren } from 'preact'

const VALIDATION_MESSAGES: Record<string, string> = {
  expired: 'This reset link has expired.',
  disabled: 'This account has been disabled.',
  invalid: 'This reset link is invalid or has already been used.',
}

function Layout({ subtitle, children }: { subtitle?: string; children: ComponentChildren }) {
  const appName = useAppSettings((s) => s.appName)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-accent-500 tracking-tighter mb-2">{appName}</h1>
          {subtitle && <p className="text-gray-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

function Card({ children, centered }: { children: ComponentChildren; centered?: boolean }) {
  return (
    <div className={`bg-white rounded-4xl p-8 shadow-sm border border-gray-100 ${centered ? 'text-center' : ''}`}>
      {children}
    </div>
  )
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
      <Layout>
        <Card centered>
          <p className="text-gray-600 mb-6">No reset token provided.</p>
          <Link to="/login" className="text-accent-500 font-semibold hover:underline">
            Back to login
          </Link>
        </Card>
      </Layout>
    )
  }

  if (validating) {
    return (
      <Layout>
        <Card centered>
          <p className="text-gray-500">Validating reset link...</p>
        </Card>
      </Layout>
    )
  }

  if (!validation?.valid) {
    return (
      <Layout>
        <Card centered>
          <p className="text-gray-600 mb-6">
            {VALIDATION_MESSAGES[validation?.reason ?? 'invalid']}
          </p>
          <Link to="/login" className="text-accent-500 font-semibold hover:underline">
            Back to login
          </Link>
        </Card>
      </Layout>
    )
  }

  if (resetMutation.isSuccess) {
    return (
      <Layout>
        <Card centered>
          <p className="text-gray-600 mb-6">Your password has been reset successfully.</p>
          <Link
            to="/login"
            className="inline-block w-full py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all text-center"
          >
            Sign In
          </Link>
        </Card>
      </Layout>
    )
  }

  return (
    <Layout subtitle={`Set a new password${validation.displayName ? ` for ${validation.displayName}` : ''}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) resetMutation.mutate()
        }}
        className="bg-white rounded-4xl p-8 shadow-sm border border-gray-100"
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
    </Layout>
  )
}
