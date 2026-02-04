# Video Upload Design

## Overview

Add support for single video uploads in posts. Short-form clips (max 30 seconds) for sharing family moments — not vlogging.

**Constraints:**
- Single video OR photos per post — not both (mutually exclusive)
- 30 second max duration
- 720p max output resolution
- Mixed device support (iPhone HEVC/MOV, Android MP4/WebM)
- Server-side ffmpeg transcoding
- Output: H.264 MP4 (universal browser playback) + thumbnail
- No autoplay — user taps to play
- Simple post-then-wait UX (no background processing queue for MVP)

---

## Frontend Changes

### CreatePostModal Redesign

Current: Large drop zone for images with drag-and-drop.

New: Text-first with "Add to your moment" action buttons.

```
┌─────────────────────────────────────────┐
│  ✕         New Moment           [Share] │
├─────────────────────────────────────────┤
│  [Circle selector pills]                │
│                                         │
│  What's happening?                      │
│  ________________________________       │
│  |                              |       │
│  |  (textarea)                  |       │
│  |______________________________|       │
│                                         │
│  [Preview area - images OR video]       │
│                                         │
│  ─────────────────────────────────────  │
│  Add to your moment                     │
│  [🖼 Photos]  [🎬 Video]                │
└─────────────────────────────────────────┘
```

**Behavior:**
- Click Photos → file picker (images, multiple, max 6)
- Click Video → file picker (video, single)
- Once media selected, show preview and hide the other button (enforces mutual exclusivity)
- Video preview: show video element with controls disabled, or thumbnail + play icon overlay
- Can remove media via X button to switch types
- Drag-and-drop still works on the preview area (optional, lower priority)

### PostCard Video Rendering

- Detect `type: 'video'` in media array
- Render `<video>` element with:
  - `poster={thumbnailUrl}` — shows thumbnail before play
  - `controls` — native browser controls
  - `playsinline` — prevents fullscreen hijack on iOS
  - `preload="metadata"` — load dimensions without downloading full video
  - No `autoplay`, no `muted` autoplay tricks

### MediaItem Type Update

```typescript
export interface MediaItem {
  url: string
  width?: number | null
  height?: number | null
  type: 'image' | 'video'
  thumbnailUrl?: string  // video only
  duration?: number      // video only, seconds
  sortOrder?: number
}
```

---

## Backend Changes

### Dependencies

- `ffmpeg` — system binary (not npm package)
- `ffprobe` — comes with ffmpeg, used for validation

Check on startup:
```javascript
import { execSync } from 'child_process'

function assertFfmpegAvailable() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' })
    execSync('ffprobe -version', { stdio: 'ignore' })
  } catch {
    throw new Error('ffmpeg/ffprobe not found. Install ffmpeg.')
  }
}
```

### media.js Additions

**New constants:**
```javascript
const VIDEO_MAGIC_BYTES = {
  mp4: { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },  // "ftyp" at offset 4
  mov: { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },  // also "ftyp"
  webm: { bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0 }, // EBML header
}

const VIDEO_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/quicktime',  // MOV
  'video/webm',
  'video/x-m4v',
])

const MAX_VIDEO_DURATION = 30  // seconds
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024  // 50MB
const VIDEO_OUTPUT_HEIGHT = 720
```

**New functions:**

```javascript
// Validate video magic bytes
function detectVideoFormat(buffer) { ... }

// Get video metadata via ffprobe
async function getVideoMetadata(filePath) {
  // Returns: { duration, width, height, codec }
  // Throws if ffprobe can't parse
}

// Validate video constraints
async function validateVideo(filePath) {
  const meta = await getVideoMetadata(filePath)
  if (meta.duration > MAX_VIDEO_DURATION) {
    return { valid: false, error: 'duration_exceeded', duration: meta.duration }
  }
  return { valid: true, ...meta }
}

// Transcode video to 720p H.264
async function processVideo(inputPath, outputPath) {
  // ffmpeg command with timeout
  // Returns: { width, height, duration }
}

// Extract thumbnail at 1 second
async function extractThumbnail(inputPath, outputPath) {
  // ffmpeg -ss 1 -vframes 1
}

// Key generators
function makeVideoKey(userId) {
  return `video/${userId}/${Date.now()}-${crypto.randomUUID()}.mp4`
}

function makeThumbnailKey(userId) {
  return `thumb/${userId}/${Date.now()}-${crypto.randomUUID()}.jpg`
}
```

### media.js Route Changes

**`POST /presign`** — extend to accept video:
```javascript
const allowedTypes = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
])

const maxSize = VIDEO_CONTENT_TYPES.has(contentType)
  ? MAX_VIDEO_FILE_SIZE
  : MAX_LOCAL_SIZE
```

**`POST /complete`** — route based on file type:
```javascript
const isVideo = key.startsWith('raw/') && VIDEO_CONTENT_TYPES.has(detectedType)

if (isVideo) {
  // Video pipeline
  const validation = await validateVideo(tempPath)
  if (!validation.valid) { /* reject */ }

  const videoKey = makeVideoKey(userId)
  const thumbKey = makeThumbnailKey(userId)

  await processVideo(tempPath, processedVideoPath)
  await extractThumbnail(processedVideoPath, thumbnailPath)

  await uploadProcessed(videoKey, videoBuffer, 'video/mp4')
  await uploadProcessed(thumbKey, thumbBuffer, 'image/jpeg')
  await deleteObject(key)

  return {
    url: getPublicUrl(videoKey),
    thumbnailUrl: getPublicUrl(thumbKey),
    width: validation.width,
    height: validation.height,
    duration: validation.duration,
    type: 'video',
  }
} else {
  // Existing image pipeline
}
```

---

## Database Changes

**post_media table** — already has `type` column, add:
```sql
ALTER TABLE post_media ADD COLUMN thumbnail_url TEXT;
ALTER TABLE post_media ADD COLUMN duration REAL;
```

Or in schema:
```sql
CREATE TABLE IF NOT EXISTS post_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,           -- NEW: video thumbnail
  width INTEGER,
  height INTEGER,
  duration REAL,                -- NEW: video duration in seconds
  type TEXT NOT NULL DEFAULT 'image',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Security & Hardening

| Risk | Mitigation |
|------|------------|
| Polyglot/malicious files | Magic byte validation + ffprobe must successfully parse |
| ffmpeg exploits | Keep ffmpeg updated, run with resource limits |
| Resource exhaustion | Timeout (60s) + file size cap (50MB) |
| Zip bombs | File size limit enforced before processing |
| Metadata leakage (GPS, device) | Strip all metadata: `-map_metadata -1` |
| Path traversal | We generate keys, never use user filenames |
| Orphaned raw files | Cleanup job or immediate deletion |

**Hardening checklist:**
- [ ] ffprobe validation before ffmpeg (rejects corrupt/fake files)
- [ ] Max file size: 50MB raw upload
- [ ] ffmpeg timeout: 60 seconds max (kill if hung)
- [ ] Strip metadata from output video
- [ ] Delete raw file immediately after processing (success or fail)
- [ ] Log suspicious uploads

**ffmpeg resource limits:**
```javascript
import { spawn } from 'child_process'

const ffmpeg = spawn('ffmpeg', args, {
  timeout: 60000,  // 60 second timeout
  // Consider: ulimit wrapper for memory limits
})
```

---

## Failure Handling

| Stage | Failure | HTTP | Message |
|-------|---------|------|---------|
| Presign | Invalid content type | 400 | "Unsupported video format" |
| Upload | File too large | 400 | "File too large (max 50MB)" |
| Complete | ffprobe can't parse | 400 | "Video file appears corrupted" |
| Complete | Duration > 30s | 400 | "Video too long (max 30 seconds)" |
| Complete | ffmpeg error/timeout | 500 | "Video processing failed, please try again" |
| Complete | Thumbnail fails | — | Use placeholder, don't fail upload |
| Complete | Storage upload fails | 500 | "Failed to save video, please try again" |

**Cleanup on any failure:**
```javascript
async function processVideoUpload(rawKey, userId) {
  const tempDir = mkdtempSync(join(tmpdir(), 'knitly-video-'))
  const rawPath = join(tempDir, 'raw')
  const processedPath = join(tempDir, 'processed.mp4')
  const thumbPath = join(tempDir, 'thumb.jpg')

  try {
    // ... processing
  } finally {
    // Always cleanup
    await deleteObject(rawKey).catch(() => {})
    rmSync(tempDir, { recursive: true, force: true })
  }
}
```

**Frontend error handling:**
- Display toast with server error message
- Re-enable form for retry
- Preserve caption text on failure

---

## Optimization

**MVP settings (good enough):**
```bash
ffmpeg -i input \
  -vf "scale=-2:'min(720,ih)'" \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  -map_metadata -1 \
  -t 30 \
  output.mp4
```

- `-preset fast` — good speed/quality balance
- `-crf 23` — visually good, reasonable file size
- `-movflags +faststart` — enables streaming playback (moov atom at start)
- `-t 30` — hard cap duration as safety net

**Thumbnail extraction:**
```bash
ffmpeg -i input.mp4 -ss 1 -vframes 1 -vf "scale=-2:480" -q:v 3 thumb.jpg
```

**Estimated processing times:**
| Input | ffprobe | Transcode | Thumbnail | Total |
|-------|---------|-----------|-----------|-------|
| 10s 1080p | ~100ms | ~2s | ~200ms | ~2.5s |
| 30s 1080p | ~100ms | ~6s | ~200ms | ~6.5s |
| 30s 4K | ~100ms | ~10s | ~200ms | ~10.5s |

**Future optimizations (not MVP):**
- Hardware acceleration (NVENC/VAAPI)
- Background job queue for concurrent uploads
- Adaptive bitrate based on input quality

---

## API Contract

### POST /api/media/presign

**Request:**
```json
{
  "contentType": "video/mp4",
  "size": 15000000
}
```

**Response (unchanged):**
```json
{
  "uploadUrl": "...",
  "key": "raw/123/1234567890-uuid.mp4",
  "expiresIn": 300
}
```

### POST /api/media/complete

**Request (unchanged):**
```json
{
  "key": "raw/123/1234567890-uuid.mp4"
}
```

**Response (video):**
```json
{
  "url": "https://.../video/123/...-processed.mp4",
  "thumbnailUrl": "https://.../thumb/123/...-thumb.jpg",
  "width": 1280,
  "height": 720,
  "duration": 24.5,
  "type": "video"
}
```

**Response (image, unchanged):**
```json
{
  "url": "https://.../media/123/....webp",
  "width": 1920,
  "height": 1080,
  "type": "image"
}
```

---

## Implementation Order

1. **Database migration** — add `thumbnail_url`, `duration` columns
2. **Backend: ffmpeg utilities** — validation, processing, thumbnail functions
3. **Backend: route updates** — presign accepts video, complete routes to video pipeline
4. **Frontend: CreatePostModal redesign** — new layout with photo/video buttons
5. **Frontend: video preview** — show video in create modal
6. **Frontend: PostCard video player** — render videos in feed
7. **Testing** — various formats, duration limits, error cases

---

## Open Questions

None currently — scope is complete.

---

## Out of Scope

- Mixed media (photos + video in same post)
- Autoplay
- Video editing/trimming in-app
- Multiple videos per post
- oEmbed/link previews (shelved)
- Background processing queue
- Hardware transcoding acceleration
