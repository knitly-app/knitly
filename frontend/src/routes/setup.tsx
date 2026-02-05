import { useState } from 'preact/hooks'
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import * as LucideIcons from 'lucide-preact'
import { Check, Zap } from 'lucide-preact'
import { setup } from '../api/endpoints'
import type { User } from '../api/endpoints'
import { LOGO_ICON_NAMES } from '../constants/settings'
import type { LogoIconName } from '../constants/settings'

const LOGO_ICONS: Record<string, typeof Zap> = LOGO_ICON_NAMES.reduce((acc, name) => {
  acc[name] = (LucideIcons as unknown as Record<string, typeof Zap>)[name]
  return acc
}, {} as Record<string, typeof Zap>)

export const SETUP_STEPS = ['welcome', 'account', 'customize', 'complete'] as const
export type SetupStep = (typeof SETUP_STEPS)[number]

export const initialStep: SetupStep = 'welcome'

interface AccountFormData {
  email: string
  password: string
  username: string
  displayName: string
}

interface AccountFormErrors {
  email?: string
  password?: string
  username?: string
  displayName?: string
}

export function validateEmail(email: string): string | null {
  if (!email || !email.trim()) return 'Email is required'
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return 'Please enter a valid email address'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null
}

export function validateRequired(value: string): string | null {
  if (!value || !value.trim()) return 'This field is required'
  return null
}

export function validateAccountForm(data: AccountFormData): AccountFormErrors {
  return {
    email: validateEmail(data.email) ?? undefined,
    password: validatePassword(data.password) ?? undefined,
    username: validateRequired(data.username) ?? undefined,
    displayName: validateRequired(data.displayName) ?? undefined,
  }
}

export async function submitSetupComplete(data: {
  email: string
  password: string
  username: string
  displayName: string
  appName?: string
  logoIcon?: string
}): Promise<{ user: User; success: boolean }> {
  const response = await fetch('/api/setup/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
    throw new Error(errorData.error || 'Setup failed')
  }
  return response.json() as Promise<{ user: User; success: boolean }>
}

export function useSetupComplete() {
  return useMutation({
    mutationFn: submitSetupComplete,
  })
}

export function useSetupStatus() {
  return useMutation({
    mutationFn: () => setup.status(),
  })
}

export function SetupLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-accent-200 border-t-accent-500 rounded-full animate-spin" />
    </div>
  )
}

export function navigateToFeed() {
  window.location.href = '/'
}

export function onSetupComplete() {
  navigateToFeed()
}

export function handleSetupFinish() {
  navigateToFeed()
}

interface IconPickerProps {
  selected: LogoIconName
  onSelect: (icon: LogoIconName) => void
}

export function IconPicker({ selected, onSelect }: IconPickerProps) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-64 overflow-y-auto p-1">
      {LOGO_ICON_NAMES.map((iconName) => {
        const Icon = LOGO_ICONS[iconName] || Zap
        return (
          <button
            key={iconName}
            type="button"
            onClick={() => onSelect(iconName)}
            title={iconName}
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center transition-all
              ${selected === iconName
                ? 'bg-accent-500 text-white ring-2 ring-accent-300 ring-offset-2'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
          >
            <Icon size={20} />
          </button>
        )
      })}
    </div>
  )
}

export function renderIconPicker(selected: LogoIconName, onSelect: (icon: LogoIconName) => void) {
  return <IconPicker selected={selected} onSelect={onSelect} />
}

export function SetupWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState<SetupStep>('welcome')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [appName, setAppName] = useState('Knitly')
  const [logoIcon, setLogoIcon] = useState<LogoIconName>('Zap')
  const [errors, setErrors] = useState<AccountFormErrors>({})

  const setupComplete = useSetupComplete()

  const handleAccountSubmit = (e: Event) => {
    e.preventDefault()
    const formErrors = validateAccountForm({ email, password, username, displayName })
    const hasErrors = Object.values(formErrors).some(Boolean)
    setErrors(formErrors)
    if (!hasErrors) {
      setStep('customize')
    }
  }

  const handleCustomizeSubmit = async (e: Event) => {
    e.preventDefault()
    try {
      await setupComplete.mutateAsync({
        email,
        password,
        username,
        displayName,
        appName: appName.trim() || undefined,
        logoIcon,
      })
      setStep('complete')
    } catch {
      // error handled by mutation
    }
  }

  const handleSkipCustomize = async () => {
    try {
      await setupComplete.mutateAsync({
        email,
        password,
        username,
        displayName,
      })
      setStep('complete')
    } catch {
      // error handled by mutation
    }
  }

  const handleFinish = () => {
    void navigate({ to: '/' })
  }

  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-10">
            <div className="w-20 h-20 mx-auto mb-6 bg-accent-500 rounded-3xl flex items-center justify-center">
              <Zap size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-4">
              Welcome to Knitly
            </h1>
            <p className="text-gray-500 text-lg">
              Let's get your private social network set up in just a few steps.
            </p>
          </div>

          <button
            onClick={() => setStep('account')}
            className="w-full py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all"
          >
            Get Started
          </button>
        </div>
      </div>
    )
  }

  if (step === 'account') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Admin Account</h2>
            <p className="text-gray-500">This will be the first user with admin privileges.</p>
          </div>

          <form
            onSubmit={(e) => {
              handleAccountSubmit(e)
            }}
            className="bg-white rounded-4xl p-8 shadow-sm border border-gray-100"
          >
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onInput={(e) => setDisplayName((e.target as HTMLInputElement).value)}
                  className={`w-full px-4 py-3 rounded-2xl border ${errors.displayName ? 'border-red-300' : 'border-gray-200'} focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all`}
                  placeholder="Your Name"
                />
                {errors.displayName && (
                  <p className="mt-1 text-sm text-red-500">{errors.displayName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
                  className={`w-full px-4 py-3 rounded-2xl border ${errors.username ? 'border-red-300' : 'border-gray-200'} focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all`}
                  placeholder="username"
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-red-500">{errors.username}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                  className={`w-full px-4 py-3 rounded-2xl border ${errors.email ? 'border-red-300' : 'border-gray-200'} focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all`}
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                  className={`w-full px-4 py-3 rounded-2xl border ${errors.password ? 'border-red-300' : 'border-gray-200'} focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all`}
                  placeholder="At least 8 characters"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-8 py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'customize') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Customize Your App</h2>
            <p className="text-gray-500">Make it yours! You can change these later.</p>
          </div>

          <form
            onSubmit={(e) => {
              void handleCustomizeSubmit(e)
            }}
            className="bg-white rounded-4xl p-8 shadow-sm border border-gray-100"
          >
            {setupComplete.error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium">
                {setupComplete.error.message || 'Failed to complete setup'}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">App Name</label>
                <input
                  type="text"
                  value={appName}
                  onInput={(e) => setAppName((e.target as HTMLInputElement).value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
                  placeholder="Knitly"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Logo Icon</label>
                <IconPicker selected={logoIcon} onSelect={setLogoIcon} />
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <button
                type="submit"
                disabled={setupComplete.isPending}
                className="w-full py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all disabled:opacity-50"
              >
                {setupComplete.isPending ? 'Setting up...' : 'Complete Setup'}
              </button>

              <button
                type="button"
                onClick={() => void handleSkipCustomize()}
                disabled={setupComplete.isPending}
                className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                Skip for now
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-10">
            <div className="w-20 h-20 mx-auto mb-6 bg-green-500 rounded-full flex items-center justify-center">
              <Check size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">You're all set!</h1>
            <p className="text-gray-500 text-lg">
              Your private social network is ready. Start inviting people!
            </p>
          </div>

          <button
            onClick={handleFinish}
            className="w-full py-4 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all"
          >
            Go to Feed
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default SetupWizard
