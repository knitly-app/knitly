import type { ComponentChildren } from 'preact'
import { useAppSettings } from '../hooks/useAppSettings'

export function AuthLayout({ subtitle, children }: { subtitle?: string; children: ComponentChildren }) {
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

export function AuthCard({ children, centered }: { children: ComponentChildren; centered?: boolean }) {
  return (
    <div className={`bg-white rounded-4xl p-8 shadow-sm border border-gray-100 ${centered ? 'text-center' : ''}`}>
      {children}
    </div>
  )
}
