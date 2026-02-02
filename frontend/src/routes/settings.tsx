import { useEffect, useState } from 'preact/hooks'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, LogOut } from 'lucide-preact'
import { useAuth } from '../hooks/useAuth'
import { users } from '../api/endpoints'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { getAvatarUrl } from '../utils/avatar'

export function SettingsRoute() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '')
      setUsername(user.username ?? '')
      setBio(user.bio ?? '')
      setAvatar(user.avatar ?? '')
    }
  }, [user])

  const updateProfile = useMutation({
    mutationFn: () => users.update('me', { displayName, username, bio, avatar }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['auth', 'me'], updated)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Profile saved')
    },
    onError: () => {
      toast.error('Failed to save profile')
    },
  })

  const handleLogout = () => {
    logout()
    void navigate({ to: '/login' })
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-4 md:py-8 px-4 md:px-0">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back</span>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <div className="w-16" />
      </div>

      {user && (
        <div className="bg-white rounded-4xl p-6 shadow-sm border border-gray-50 mb-6">
          <div className="flex items-center space-x-4">
            <img
              src={getAvatarUrl(user)}
              alt={user.displayName}
              className="w-16 h-16 rounded-full border-2 border-white shadow-sm"
            />
            <div>
              <h2 className="font-bold text-gray-900 text-lg">{user.displayName}</h2>
              <p className="text-gray-400">@{user.username}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-4xl p-6 shadow-sm border border-gray-50 mb-6">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Profile</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onInput={(e) => setDisplayName((e.target as HTMLInputElement).value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
              placeholder="username"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onInput={(e) => setBio((e.target as HTMLTextAreaElement).value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
              rows={3}
              placeholder="A short bio"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Avatar URL
            </label>
            <input
              type="url"
              value={avatar}
              onInput={(e) => setAvatar((e.target as HTMLInputElement).value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
              placeholder="https://..."
            />
          </div>
          <button
            onClick={() => updateProfile.mutate()}
            disabled={updateProfile.isPending}
            className="w-full py-3 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 p-4 bg-accent-50 text-accent-600 rounded-2xl font-bold hover:bg-accent-100 transition-colors"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>

      <p className="text-center text-xs text-gray-300 mt-8">
        Knitly v1.0.0
      </p>
    </div>
  )
}
