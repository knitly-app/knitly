interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-6 h-6 border-3',
  md: 'w-8 h-8 border-4',
  lg: 'w-10 h-10 border-4',
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  return (
    <div
      className={`${sizeClasses[size]} border-accent-200 border-t-accent-500 rounded-full animate-spin`}
    />
  )
}
