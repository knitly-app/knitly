import { useState, useRef } from 'preact/hooks'
import { useNavigate, Link } from '@tanstack/react-router'
import { ArrowLeft, LogOut, Camera } from 'lucide-preact'
import { useAuth } from '../hooks/useAuth'
import { users, media as mediaApi } from '../api/endpoints'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { getAvatarUrl } from '../utils/avatar'

export function SettingsRoute() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [draft, setDraft] = useState<{
    displayName?: string
    username?: string
    bio?: string
    avatar?: string
    location?: string
    website?: string
  }>({})
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const formValues = {
    displayName: draft.displayName ?? user?.displayName ?? '',
    username: draft.username ?? user?.username ?? '',
    bio: draft.bio ?? user?.bio ?? '',
    avatar: draft.avatar ?? user?.avatar ?? '',
    location: draft.location ?? user?.location ?? '',
    website: draft.website ?? user?.website ?? '',
  }

  const profilePayload = {
    displayName: formValues.displayName,
    username: formValues.username,
    bio: formValues.bio,
    avatar: formValues.avatar,
    location: formValues.location,
    website: formValues.website,
  }

  const updateProfile = useMutation({
    mutationFn: (payload: typeof profilePayload) => users.update('me', payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['auth', 'me'], updated)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['feed'] })
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
      setDraft({})
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

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    try {
      setIsUploadingAvatar(true)

      const presign = await mediaApi.presign({
        contentType: file.type || 'image/jpeg',
        size: file.size,
      })

      await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'image/jpeg' },
      })

      const mediaItem = await mediaApi.complete({ key: presign.key })
      setDraft((prev) => ({ ...prev, avatar: mediaItem.url }))
      toast.success('Avatar uploaded')
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-4 md:py-8 px-4 md:px-0">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => {
            void navigate({ to: '..', replace: false })
          }}
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back</span>
        </button>
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
            value={formValues.displayName}
            onInput={(e) =>
              setDraft((prev) => ({
                ...prev,
                displayName: (e.target as HTMLInputElement).value,
              }))
            }
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
              value={formValues.username}
              onInput={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  username: (e.target as HTMLInputElement).value,
                }))
              }
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
              placeholder="username"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Bio
            </label>
            <textarea
              value={formValues.bio}
              onInput={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  bio: (e.target as HTMLTextAreaElement).value,
                }))
              }
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
              rows={3}
              placeholder="A short bio"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Avatar
            </label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden cursor-pointer group"
              >
                <img
                  src={formValues.avatar || (user ? getAvatarUrl(user) : '')}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
                <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isUploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {isUploadingAvatar ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera size={24} className="text-white" />
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) void handleAvatarUpload(file)
                  }}
                />
              </div>
              <p className="text-sm text-gray-400">Click to upload a new avatar</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Location
            </label>
            <input
              type="text"
              value={formValues.location}
              onInput={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  location: (e.target as HTMLInputElement).value,
                }))
              }
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
              placeholder="City, State"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Website
            </label>
            <input
              type="url"
              value={formValues.website}
              onInput={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  website: (e.target as HTMLInputElement).value,
                }))
              }
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
              placeholder="https://yoursite.com"
            />
          </div>
          <button
            onClick={() => updateProfile.mutate(profilePayload)}
            disabled={updateProfile.isPending}
            className="w-full py-3 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="mt-8">
          <Link
            to="/admin"
            className="w-full flex items-center justify-center space-x-2 p-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-colors"
          >
            <span>Admin Panel</span>
          </Link>
        </div>
      )}

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
