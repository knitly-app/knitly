import { Play } from 'lucide-preact'
import { useNavigate } from '@tanstack/react-router'
import type { Post, MediaItem } from '../api/endpoints'
import { useLightbox } from '../stores/lightbox'

interface FlatMediaItem {
  media: MediaItem
  post: Post
  indexInPost: number
}

interface MediaGridProps {
  posts: Post[]
}

export function MediaGrid({ posts }: MediaGridProps) {
  const navigate = useNavigate()

  const flatMedia: FlatMediaItem[] = posts.flatMap((post) =>
    (post.media ?? []).map((media, indexInPost) => ({
      media,
      post,
      indexInPost,
    }))
  )

  if (flatMedia.length === 0) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
      {flatMedia.map((item, i) => (
        <button
          type="button"
          key={`${item.post.id}-${item.indexInPost}`}
          onClick={() => {
            if (item.media.type === 'video') {
              void navigate({ to: '/post/$id', params: { id: item.post.id } })
              return
            }
            const imageMedia = (item.post.media ?? []).filter((m) => m.type !== 'video')
            const imageIndex = imageMedia.findIndex((m) => m.url === item.media.url)
            useLightbox.getState().open(
              imageMedia.map((m) => ({ url: m.url, alt: "Post media" })),
              imageIndex >= 0 ? imageIndex : 0
            )
          }}
          className={`relative aspect-square bg-gray-100 overflow-hidden rounded-lg ${item.media.type === 'video' ? 'cursor-pointer' : 'cursor-zoom-in'}`}
        >
          <img
            src={item.media.type === 'video' ? (item.media.thumbnailUrl || item.media.url) : item.media.url}
            alt={`Media ${i + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          {item.media.type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/40 rounded-full p-3">
                <Play size={24} className="text-white fill-white" />
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
