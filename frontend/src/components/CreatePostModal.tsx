import { useState, useRef, useEffect } from 'preact/hooks'
import { X, ImagePlus } from 'lucide-preact'
import { useCreatePost } from '../hooks/usePosts'
import { useCircles } from '../hooks/useCircles'
import { media as mediaApi, type MediaItem } from '../api/endpoints'
import { useToast } from './Toast'
import { CirclePills } from './CirclePills'

interface CreatePostModalProps {
  onClose: () => void
}

export function CreatePostModal({ onClose }: CreatePostModalProps) {
  const [content, setContent] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 6)
    if (fileArray.length === 0) return

    previews.forEach((url) => URL.revokeObjectURL(url))
    const combined = [...selectedFiles, ...fileArray].slice(0, 6)
    setSelectedFiles(combined)
    setPreviews(combined.map((file) => URL.createObjectURL(file)))
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer?.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index])
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
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
              contentType: file.type || 'image/jpeg',
              size: file.size,
            })

            await fetch(presign.uploadUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': file.type || 'image/jpeg' },
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
    } catch {
      toast.error('Failed to share moment')
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
            onClick={() => {
              void handleSubmit()
            }}
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

          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {previews.map((url, idx) => (
                <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-accent-400 bg-accent-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles((e.target as HTMLInputElement).files || [])}
            />
            <ImagePlus size={32} className={`mx-auto mb-2 ${isDragging ? 'text-accent-500' : 'text-gray-400'}`} />
            <p className={`text-sm font-medium ${isDragging ? 'text-accent-600' : 'text-gray-500'}`}>
              {isDragging ? 'Drop photos here' : 'Add photos'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Drag & drop or click to select</p>
          </div>
        </div>
      </div>
    </div>
  )
}
