interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />
}

const textWidths = {
  sm: 'w-16',
  md: 'w-32',
  lg: 'w-48',
  full: 'w-full',
} as const

interface SkeletonTextProps extends SkeletonProps {
  width?: keyof typeof textWidths
}

export function SkeletonText({ width = 'md', className }: SkeletonTextProps) {
  return <Skeleton className={`h-4 ${textWidths[width]} ${className ?? ''}`} />
}

const avatarSizes = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
} as const

interface SkeletonAvatarProps extends SkeletonProps {
  size?: keyof typeof avatarSizes
}

export function SkeletonAvatar({ size = 'md', className }: SkeletonAvatarProps) {
  return <Skeleton className={`rounded-full ${avatarSizes[size]} ${className ?? ''}`} />
}

const aspectRatios = {
  square: 'aspect-square',
  video: 'aspect-video',
  wide: 'aspect-[2/1]',
} as const

interface SkeletonImageProps extends SkeletonProps {
  aspectRatio?: keyof typeof aspectRatios
}

export function SkeletonImage({ aspectRatio = 'video', className }: SkeletonImageProps) {
  return <Skeleton className={`w-full rounded-2xl ${aspectRatios[aspectRatio]} ${className ?? ''}`} />
}

interface PostCardSkeletonProps {
  showMedia?: boolean
}

export function PostCardSkeleton({ showMedia }: PostCardSkeletonProps) {
  return (
    <div className="bg-white rounded-4xl p-6 shadow-sm border border-gray-50">
      <div className="flex items-start space-x-4 mb-4">
        <SkeletonAvatar size="md" />
        <div className="flex-1">
          <SkeletonText width="md" className="mb-2" />
          <SkeletonText width="sm" />
        </div>
      </div>
      <div className="mb-4">
        <SkeletonText width="full" className="mb-2" />
        <SkeletonText width="lg" className="mb-2" />
        <SkeletonText width="md" />
      </div>
      {showMedia && <SkeletonImage aspectRatio="video" className="mb-4" />}
      <div className="pt-2 border-t border-gray-50 flex justify-between">
        <SkeletonText width="sm" />
        <SkeletonText width="sm" />
        <SkeletonText width="sm" />
      </div>
    </div>
  )
}

export function ProfileCardSkeleton() {
  return (
    <div className="bg-white rounded-4xl p-6 shadow-sm border border-gray-50">
      <div className="flex items-center space-x-4">
        <SkeletonAvatar size="lg" />
        <div className="flex-1">
          <SkeletonText width="md" className="mb-2" />
          <SkeletonText width="sm" />
        </div>
      </div>
    </div>
  )
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="bg-white rounded-5xl overflow-hidden shadow-sm border border-gray-50">
      <div className="h-32 bg-gray-200 animate-pulse" />
      <div className="px-8 pb-8">
        <div className="flex items-end justify-between -mt-12 mb-6">
          <SkeletonAvatar className="w-24 h-24 border-4 border-white shadow-lg" />
          <div className="w-32 h-10 rounded-full bg-gray-200 animate-pulse" />
        </div>
        <div className="mb-4">
          <SkeletonText width="lg" className="mb-2" />
          <SkeletonText width="md" />
        </div>
        <div>
          <SkeletonText width="full" className="mb-2" />
          <SkeletonText width="lg" />
        </div>
        <div className="flex gap-6 mt-6 pt-6 border-t border-gray-100">
          <SkeletonText width="sm" />
          <SkeletonText width="sm" />
        </div>
      </div>
    </div>
  )
}

export function NotificationSkeleton() {
  return (
    <div className="flex items-center p-4 rounded-3xl bg-white">
      <SkeletonAvatar size="lg" className="mr-5" />
      <div className="flex-1">
        <SkeletonText width="lg" className="mb-2" />
        <SkeletonText width="sm" />
      </div>
    </div>
  )
}

export function CommentSkeleton() {
  return (
    <div className="flex space-x-3">
      <SkeletonAvatar className="w-10 h-10" />
      <div className="flex-1 bg-gray-50 rounded-2xl p-4">
        <SkeletonText width="sm" className="mb-2" />
        <SkeletonText width="full" className="mb-1" />
        <SkeletonText width="lg" />
      </div>
    </div>
  )
}

interface AdminTableSkeletonProps {
  count?: number
}

export function AdminTableSkeleton({ count = 5 }: AdminTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-4">
            <SkeletonAvatar className="w-11 h-11" />
            <div>
              <SkeletonText width="md" className="mb-2" />
              <SkeletonText width="sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-6 rounded-full bg-gray-200 animate-pulse" />
            <div className="w-20 h-8 rounded-full bg-gray-200 animate-pulse" />
          </div>
        </div>
      ))}
    </>
  )
}
