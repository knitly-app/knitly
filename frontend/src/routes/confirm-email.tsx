import { useQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { auth } from '../api/endpoints'
import { AuthLayout, AuthCard } from '../components/AuthLayout'

export function ConfirmEmailRoute() {
  const { token } = useSearch({ from: '/confirm-email' })

  const { isLoading, isSuccess, isError } = useQuery({
    queryKey: ['confirm-email', token],
    queryFn: () => auth.confirmEmail(token!),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  })

  if (!token) {
    return (
      <AuthLayout>
        <AuthCard centered>
          <p className="text-gray-600 mb-6">No confirmation token provided.</p>
          <Link to="/settings" className="text-accent-500 font-semibold hover:underline">
            Back to settings
          </Link>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (isLoading) {
    return (
      <AuthLayout>
        <AuthCard centered>
          <p className="text-gray-500">Confirming your email...</p>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (isSuccess) {
    return (
      <AuthLayout>
        <AuthCard centered>
          <p className="text-gray-600 mb-6">Email updated successfully!</p>
          <Link
            to="/settings"
            className="inline-block w-full py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all text-center"
          >
            Back to Settings
          </Link>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (isError) {
    return (
      <AuthLayout>
        <AuthCard centered>
          <p className="text-gray-600 mb-6">Invalid or expired confirmation link.</p>
          <Link to="/settings" className="text-accent-500 font-semibold hover:underline">
            Back to settings
          </Link>
        </AuthCard>
      </AuthLayout>
    )
  }

  return null
}
