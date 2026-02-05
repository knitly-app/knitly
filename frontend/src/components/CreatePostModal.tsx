import { BarChart3, ImagePlus, Minus, Plus, Video, X } from 'lucide-preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { media as mediaApi, type MediaItem } from '../api/endpoints'
import { useCircles } from '../hooks/useCircles'
import { useCreatePost } from '../hooks/usePosts'
import { CirclePills } from './CirclePills'
import { MentionAutocomplete, type MentionAutocompleteHandle } from './MentionAutocomplete'
import { useToast } from './Toast'

interface CreatePostModalProps {
  onClose: () => void
}

type MediaMode = 'none' | 'photos' | 'video' | 'poll'

export function CreatePostModal({ onClose }: CreatePostModalProps) {
  const [content, setContent] = useState('')
  const [mediaMode, setMediaMode] = useState<MediaMode>('none')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionRef = useRef<MentionAutocompleteHandle>(null)
  const [mentionState, setMentionState] = useState<{
    visible: boolean
    query: string
    position: { top: number; left: number }
    startIndex: number
  }>({ visible: false, query: '', position: { top: 0, left: 0 }, startIndex: 0 })
  const createPost = useCreatePost()
  const { data: circles = [] } = useCircles()
  const toast = useToast()
  const prevUrlsRef = useRef<string[]>([])

  const previews = useMemo(() => selectedFiles.map(f => URL.createObjectURL(f)), [selectedFiles])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const prevUrls = prevUrlsRef.current
    prevUrlsRef.current = previews
    return () => {
      prevUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previews])

  const detectMention = (text: string, cursorPos: number) => {
    const beforeCursor = text.slice(0, cursorPos)
    const match = beforeCursor.match(/@(\w*)$/)
    if (match) {
      const textarea = textareaRef.current
      if (textarea) {
        const rect = textarea.getBoundingClientRect()
        setMentionState({
          visible: true,
          query: match[1],
          position: { top: rect.bottom + 4, left: rect.left },
          startIndex: cursorPos - match[0].length,
        })
      }
    } else {
      if (mentionState.visible) {
        setMentionState((s) => ({ ...s, visible: false }))
      }
    }
  }

  const handleContentChange = (e: Event) => {
    const textarea = e.target as HTMLTextAreaElement
    setContent(textarea.value)
    detectMention(textarea.value, textarea.selectionStart ?? 0)
  }

  const handleMentionSelect = (username: string) => {
    const before = content.slice(0, mentionState.startIndex)
    const after = content.slice(
      mentionState.startIndex + mentionState.query.length + 1
    )
    const newContent = `${before}@${username} ${after}`
    setContent(newContent)
    setMentionState((s) => ({ ...s, visible: false }))
    setTimeout(() => {
      const newPos = before.length + username.length + 2
      textareaRef.current?.setSelectionRange(newPos, newPos)
      textareaRef.current?.focus()
    }, 0)
  }

  const handleTextareaKeyDown = (e: KeyboardEvent) => {
    if (mentionState.visible && mentionRef.current?.handleKeyDown(e)) {
      return
    }
  }

  const handlePhotoSelect = (files: FileList | null) => {
    if (!files) return
    const maxPhotos = mediaMode === 'poll' ? 1 : 6
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, maxPhotos)
    if (imageFiles.length === 0) return

    setSelectedFiles(imageFiles)
    if (mediaMode !== 'poll') setMediaMode('photos')
  }

  const handleVideoSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const videoFile = Array.from(files).find(f => f.type.startsWith('video/'))
    if (!videoFile) return

    if (videoFile.size > 50 * 1024 * 1024) {
      toast.error('Video too large (max 50MB)')
      return
    }

    setSelectedFiles([videoFile])
    setMediaMode('video')
  }

  const clearMedia = () => {
    setSelectedFiles([])
    if (mediaMode !== 'poll') setMediaMode('none')
  }

  const clearPoll = () => {
    setPollQuestion('')
    setPollOptions(['', ''])
    clearMedia()
    setMediaMode('none')
  }

  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, ''])
    }
  }

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index))
    }
  }

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions]
    newOptions[index] = value
    setPollOptions(newOptions)
  }

  const handleSubmit = async () => {
    const hasPoll = mediaMode === 'poll' && pollQuestion.trim()
    const validPollOptions = pollOptions.filter(o => o.trim())
    if (!content.trim() && selectedFiles.length === 0 && !hasPoll) return
    if (hasPoll && validPollOptions.length < 2) {
      toast.error('Poll needs at least 2 options')
      return
    }

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
        poll: hasPoll ? { question: pollQuestion.trim(), options: validPollOptions } : undefined,
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

  const hasPoll = mediaMode === 'poll' && pollQuestion.trim()
  const validPollOptions = pollOptions.filter(o => o.trim())
  const canSubmit = (content.trim() || selectedFiles.length > 0 || (hasPoll && validPollOptions.length >= 2)) && !createPost.isPending && !isUploading

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

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onInput={handleContentChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder="What's happening?"
              className="w-full text-lg text-gray-800 placeholder-gray-400 resize-none focus:outline-none min-h-[120px]"
            />
            <MentionAutocomplete
              ref={mentionRef}
              query={mentionState.query}
              visible={mentionState.visible}
              position={mentionState.position}
              onSelect={handleMentionSelect}
              onClose={() => setMentionState((s) => ({ ...s, visible: false }))}
            />
          </div>

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

          {mediaMode === 'poll' && (
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Poll</span>
                <button
                  onClick={clearPoll}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <input
                type="text"
                value={pollQuestion}
                onInput={(e) => setPollQuestion((e.target as HTMLInputElement).value)}
                placeholder="Ask a question..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-300"
              />
              <div className="space-y-2">
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onInput={(e) => updatePollOption(index, (e.target as HTMLInputElement).value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-300"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() => removePollOption(index)}
                        className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {pollOptions.length < 6 && (
                <button
                  onClick={addPollOption}
                  className="flex items-center gap-2 text-sm text-accent-500 hover:text-accent-600 transition-colors"
                >
                  <Plus size={16} />
                  <span>Add option</span>
                </button>
              )}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <ImagePlus size={16} />
                  <span>Add image (optional)</span>
                </button>
                {previews.length > 0 && (
                  <div className="relative mt-2">
                    <button
                      onClick={clearMedia}
                      className="absolute -top-2 -right-2 z-10 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                    >
                      <X size={14} />
                    </button>
                    <img src={previews[0]} alt="" className="w-24 h-24 object-cover rounded-xl" />
                  </div>
                )}
              </div>
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
                <button
                  onClick={() => setMediaMode('poll')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 hover:border-accent-300 hover:bg-accent-50 transition-colors text-gray-600 hover:text-accent-600"
                >
                  <BarChart3 size={20} />
                  <span className="text-sm font-medium">Poll</span>
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
