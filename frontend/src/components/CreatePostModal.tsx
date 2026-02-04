import { useState, useRef, useEffect } from 'preact/hooks'
import { X, ImagePlus, Video } from 'lucide-preact'
import { useCreatePost } from '../hooks/usePosts'
import { useCircles } from '../hooks/useCircles'
import { media as mediaApi, type MediaItem } from '../api/endpoints'
import { useToast } from './Toast'
import { CirclePills } from './CirclePills'

interface CreatePostModalProps {
  onClose: () => void
}

type MediaMode = 'none' | 'photos' | 'video'

export function CreatePostModal({ onClose }: CreatePostModalProps) {
  const [content, setContent] = useState('')
  const [mediaMode, setMediaMode] = useState<MediaMode>('none')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const createPost = useCreatePost()
  const { data: circles = [] } = useCircles()
  const toast = useToast()

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previews])

  const handlePhotoSelect = (files: FileList | null) => {
    if (!files) return
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 6)
    if (imageFiles.length === 0) return

    previews.forEach((url) => URL.revokeObjectURL(url))
    setSelectedFiles(imageFiles)
    setPreviews(imageFiles.map((file) => URL.createObjectURL(file)))
    setMediaMode('photos')
  }

  const handleVideoSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const videoFile = Array.from(files).find(f => f.type.startsWith('video/'))
    if (!videoFile) return

    if (videoFile.size > 50 * 1024 * 1024) {
      toast.error('Video too large (max 50MB)')
      return
    }

    previews.forEach((url) => URL.revokeObjectURL(url))
    setSelectedFiles([videoFile])
    setPreviews([URL.createObjectURL(videoFile)])
    setMediaMode('video')
  }

  const clearMedia = () => {
    previews.forEach((url) => URL.revokeObjectURL(url))
    setSelectedFiles([])
    setPreviews([])
    setMediaMode('none')
  }

  const handleSubmit = async () => {
    if (!content.trim() && selectedFiles.length === 0) return

    try {
      setIsUploading(true)
      let uploadedMedia: MediaItem[] = []

      if (selectedFiles.length > 0) {
        uploadedMedia = await Promise.all(
          selectedFiles.map(async (file) => {
            const presign = await mediaApi.presign({
              contentType: file.type || (mediaMode === 'video' ? 'video/mp4' : 'image/jpeg'),
              size: file.size,
            })

            await fetch(presign.uploadUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': file.type },
            })

            return mediaApi.complete({ key: presign.key })
          })
        )
      }

      await createPost.mutateAsync({
        content: content.trim(),
        media: uploadedMedia,
        circleIds: selectedCircleId ? [selectedCircleId] : undefined,
      })
      toast.success('Moment shared')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to share moment'
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  const canSubmit = (content.trim() || selectedFiles.length > 0) && !createPost.isPending && !isUploading

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
          <h2 className="text-lg font-bold text-gray-900">New Moment</h2>
          <button
            onClick={() => { void handleSubmit() }}
            disabled={!canSubmit}
            className="px-5 py-2 bg-accent-500 text-white rounded-full text-sm font-bold disabled:opacity-40 hover:bg-accent-600 transition-colors"
          >
            {isUploading || createPost.isPending ? 'Sharing...' : 'Share'}
          </button>
        </div>

        <div className="p-4">
          <div className="mb-3">
            <CirclePills
              circles={circles}
              selectedId={selectedCircleId}
              onSelect={setSelectedCircleId}
              showAdd={circles.length < 4}
              onAdd={() => window.open('/circles', '_blank')}
            />
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)}
            placeholder="What's happening?"
            className="w-full text-lg text-gray-800 placeholder-gray-400 resize-none focus:outline-none min-h-[120px]"
          />

          {mediaMode === 'photos' && previews.length > 0 && (
            <div className="relative mb-4">
              <button
                onClick={clearMedia}
                className="absolute -top-2 -right-2 z-10 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <X size={16} />
              </button>
              <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden">
                {previews.map((url) => (
                  <div key={url} className="relative aspect-square bg-gray-100">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {mediaMode === 'video' && previews.length > 0 && (
            <div className="relative mb-4">
              <button
                onClick={clearMedia}
                className="absolute top-2 right-2 z-10 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <X size={16} />
              </button>
              <video
                src={previews[0]}
                className="w-full rounded-xl max-h-64 bg-black"
                controls
                playsInline
              />
            </div>
          )}

          {mediaMode === 'none' && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <p className="text-sm text-gray-500 mb-3">Add to your moment</p>
              <div className="flex gap-2">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 hover:border-accent-300 hover:bg-accent-50 transition-colors text-gray-600 hover:text-accent-600"
                >
                  <ImagePlus size={20} />
                  <span className="text-sm font-medium">Photos</span>
                </button>
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 hover:border-accent-300 hover:bg-accent-50 transition-colors text-gray-600 hover:text-accent-600"
                >
                  <Video size={20} />
                  <span className="text-sm font-medium">Video</span>
                </button>
              </div>
            </div>
          )}

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handlePhotoSelect((e.target as HTMLInputElement).files)}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleVideoSelect((e.target as HTMLInputElement).files)}
          />
        </div>
      </div>
    </div>
  )
}
