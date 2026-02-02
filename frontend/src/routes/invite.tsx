import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useNavigate } from '@tanstack/react-router'
import { invites } from '../api/endpoints'
import { useAuth } from '../hooks/useAuth'

export function InviteRoute() {
  const params = useParams({ from: '/invite/$token' })
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['invite', params.token],
    queryFn: () => invites.validate(params.token),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-accent-200 border-t-accent-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-gray-900 mb-4">Invalid Invite</h1>
          <p className="text-gray-500 mb-8">This invite link is invalid or has expired.</p>
          <Link
            to="/login"
            className="inline-block px-8 py-3 bg-accent-500 text-white rounded-full font-bold hover:bg-accent-600 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  const handleAccept = () => {
    if (isAuthenticated) {
      void navigate({ to: '/' })
    } else {
      void navigate({ to: '/signup', search: { invite: params.token } })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-5xl p-10 shadow-sm border border-gray-100">
          <div className="w-20 h-20 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl font-black text-accent-500">C</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Invited!</h1>

          <p className="text-gray-500 mb-8">
            {data.inviter ? (
              <>
                <span className="font-semibold text-gray-700">{data.inviter.displayName}</span>
                {' '}invited you to join Knitly.
              </>
            ) : (
              "You're invited to join Knitly."
            )}
          </p>

          <button
            onClick={handleAccept}
            className="w-full py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all"
          >
            {isAuthenticated ? 'Accept Invite' : 'Join Knitly'}
          </button>

          <p className="mt-6 text-sm text-gray-400">
            Knitly is an intimate social network limited to 100 members per cluster.
          </p>
        </div>
      </div>
    </div>
  )
}
