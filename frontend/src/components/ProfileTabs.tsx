interface ProfileTabsProps {
  activeTab: 'posts' | 'media'
  onTabChange: (tab: 'posts' | 'media') => void
  postCount: number
  mediaCount: number
}

export function ProfileTabs({ activeTab, onTabChange, postCount, mediaCount }: ProfileTabsProps) {
  return (
    <div className="flex mb-6">
      <button
        type="button"
        onClick={() => onTabChange('posts')}
        className={`flex-1 text-center pb-3 text-sm font-semibold border-b-2 transition-colors ${
          activeTab === 'posts'
            ? 'text-accent-500 border-accent-500'
            : 'text-gray-400 border-transparent'
        }`}
      >
        {postCount} Posts
      </button>
      <button
        type="button"
        onClick={() => onTabChange('media')}
        className={`flex-1 text-center pb-3 text-sm font-semibold border-b-2 transition-colors ${
          activeTab === 'media'
            ? 'text-accent-500 border-accent-500'
            : 'text-gray-400 border-transparent'
        }`}
      >
        {mediaCount} Media
      </button>
    </div>
  )
}
