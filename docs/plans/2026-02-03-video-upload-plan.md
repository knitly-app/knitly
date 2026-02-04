# Video Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add support for single video uploads (30s max, 720p) in posts with a redesigned CreatePostModal.

**Architecture:** Extend the existing presigned upload flow to accept video content types. Server-side ffmpeg transcodes to H.264 MP4 and extracts a thumbnail. Frontend gets a redesigned CreatePostModal with mutually exclusive photo/video buttons. PostCard renders videos with native controls, no autoplay.

**Tech Stack:** ffmpeg (system binary), Bun backend, Preact frontend, SQLite

**Design doc:** `docs/plans/2026-02-03-video-upload-design.md`

---

## Task 1: Database Migration

**Files:**
- Modify: `server/src/lib/db.js:62-71` (post_media table schema)

**Step 1: Add new columns to post_media table**

In `server/src/lib/db.js`, update the `CREATE TABLE IF NOT EXISTS post_media` block:

```javascript
  CREATE TABLE IF NOT EXISTS post_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    width INTEGER,
    height INTEGER,
    duration REAL,
    type TEXT NOT NULL DEFAULT 'image',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
```

**Step 2: Run migration for existing database**

Create a one-time migration script or run manually:

```sql
ALTER TABLE post_media ADD COLUMN thumbnail_url TEXT;
ALTER TABLE post_media ADD COLUMN duration REAL;
```

**Step 3: Update getPostMediaMap to return new fields**

In `server/src/lib/db.js`, update the SELECT in `getPostMediaMap()`:

```javascript
  getPostMediaMap(postIds = []) {
    if (!postIds.length) return new Map();

    const placeholders = postIds.map(() => "?").join(", ");
    const rows = db.prepare(`
      SELECT id, post_id, url, thumbnail_url, width, height, duration, type, sort_order
      FROM post_media
      WHERE post_id IN (${placeholders})
      ORDER BY sort_order ASC, id ASC
    `).all(...postIds);

    const map = new Map();
    rows.forEach((row) => {
      if (!map.has(row.post_id)) map.set(row.post_id, []);
      map.get(row.post_id).push({
        id: row.id,
        url: row.url,
        thumbnailUrl: row.thumbnail_url,
        width: row.width,
        height: row.height,
        duration: row.duration,
        type: row.type,
        sortOrder: row.sort_order,
      });
    });
    return map;
  },
```

**Step 4: Update addPostMedia to accept new fields**

```javascript
  addPostMedia(postId, media = []) {
    if (!Array.isArray(media) || media.length === 0) return;

    const insert = db.prepare(`
      INSERT INTO post_media (post_id, url, thumbnail_url, width, height, duration, type, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((items) => {
      items.forEach((item, index) => {
        insert.run(
          postId,
          item.url,
          item.thumbnailUrl ?? null,
          item.width ?? null,
          item.height ?? null,
          item.duration ?? null,
          item.type || "image",
          item.sortOrder ?? index
        );
      });
    });

    tx(media);
  },
```

**Step 5: Commit**

```bash
git add server/src/lib/db.js
git commit -m "feat(db): add thumbnail_url and duration columns to post_media"
```

---

## Task 2: Video Processing Utilities

**Files:**
- Create: `server/src/lib/video.js`
- Create: `server/src/lib/video.test.js`

**Step 1: Write test for ffmpeg availability check**

Create `server/src/lib/video.test.js`:

```javascript
import { describe, it, expect } from "bun:test";
import { assertFfmpegAvailable, VIDEO_CONTENT_TYPES, MAX_VIDEO_DURATION } from "./video.js";

describe("video utilities", () => {
  it("should export VIDEO_CONTENT_TYPES", () => {
    expect(VIDEO_CONTENT_TYPES.has("video/mp4")).toBe(true);
    expect(VIDEO_CONTENT_TYPES.has("video/quicktime")).toBe(true);
    expect(VIDEO_CONTENT_TYPES.has("video/webm")).toBe(true);
    expect(VIDEO_CONTENT_TYPES.has("image/jpeg")).toBe(false);
  });

  it("should export MAX_VIDEO_DURATION as 30", () => {
    expect(MAX_VIDEO_DURATION).toBe(30);
  });

  it("should not throw if ffmpeg is available", () => {
    expect(() => assertFfmpegAvailable()).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && bun test src/lib/video.test.js
```

Expected: FAIL (module not found)

**Step 3: Create video.js with constants and ffmpeg check**

Create `server/src/lib/video.js`:

```javascript
import { execSync, spawn } from "child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import crypto from "crypto";

export const VIDEO_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

export const MAX_VIDEO_DURATION = 30;
export const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024;
export const VIDEO_OUTPUT_HEIGHT = 720;

export function assertFfmpegAvailable() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    execSync("ffprobe -version", { stdio: "ignore" });
  } catch {
    throw new Error("ffmpeg/ffprobe not found. Install ffmpeg.");
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd server && bun test src/lib/video.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/src/lib/video.js server/src/lib/video.test.js
git commit -m "feat(video): add video constants and ffmpeg availability check"
```

---

## Task 3: Video Metadata Extraction

**Files:**
- Modify: `server/src/lib/video.js`
- Modify: `server/src/lib/video.test.js`

**Step 1: Write test for getVideoMetadata**

Add to `server/src/lib/video.test.js`:

```javascript
import { getVideoMetadata } from "./video.js";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("getVideoMetadata", () => {
  it("should reject invalid files", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const fakePath = join(tempDir, "fake.mp4");
    writeFileSync(fakePath, "not a video");

    await expect(getVideoMetadata(fakePath)).rejects.toThrow();

    rmSync(tempDir, { recursive: true, force: true });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && bun test src/lib/video.test.js
```

Expected: FAIL (getVideoMetadata not defined)

**Step 3: Implement getVideoMetadata**

Add to `server/src/lib/video.js`:

```javascript
export async function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath,
    ];

    const proc = spawn("ffprobe", args, { timeout: 10000 });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data; });
    proc.stderr.on("data", (data) => { stderr += data; });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed: ${stderr || "unknown error"}`));
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find((s) => s.codec_type === "video");

        if (!videoStream) {
          return reject(new Error("No video stream found"));
        }

        const duration = parseFloat(data.format?.duration || videoStream.duration || "0");
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const codec = videoStream.codec_name || "unknown";

        resolve({ duration, width, height, codec });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
      }
    });

    proc.on("error", (err) => reject(err));
  });
}
```

**Step 4: Run test to verify it passes**

```bash
cd server && bun test src/lib/video.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/src/lib/video.js server/src/lib/video.test.js
git commit -m "feat(video): add getVideoMetadata using ffprobe"
```

---

## Task 4: Video Validation

**Files:**
- Modify: `server/src/lib/video.js`
- Modify: `server/src/lib/video.test.js`

**Step 1: Write test for validateVideo**

Add to `server/src/lib/video.test.js`:

```javascript
import { validateVideo, MAX_VIDEO_DURATION } from "./video.js";

describe("validateVideo", () => {
  it("should reject files that ffprobe cannot parse", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const fakePath = join(tempDir, "fake.mp4");
    writeFileSync(fakePath, "not a video");

    const result = await validateVideo(fakePath);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_video");

    rmSync(tempDir, { recursive: true, force: true });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && bun test src/lib/video.test.js
```

Expected: FAIL (validateVideo not defined)

**Step 3: Implement validateVideo**

Add to `server/src/lib/video.js`:

```javascript
export async function validateVideo(filePath) {
  try {
    const meta = await getVideoMetadata(filePath);

    if (meta.duration > MAX_VIDEO_DURATION) {
      return {
        valid: false,
        error: "duration_exceeded",
        duration: meta.duration,
        maxDuration: MAX_VIDEO_DURATION,
      };
    }

    return {
      valid: true,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      codec: meta.codec,
    };
  } catch (err) {
    console.warn("[VIDEO] Validation failed:", err.message);
    return { valid: false, error: "invalid_video" };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd server && bun test src/lib/video.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/src/lib/video.js server/src/lib/video.test.js
git commit -m "feat(video): add validateVideo function"
```

---

## Task 5: Video Transcoding

**Files:**
- Modify: `server/src/lib/video.js`

**Step 1: Implement processVideo function**

Add to `server/src/lib/video.js`:

```javascript
export async function processVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-i", inputPath,
      "-vf", `scale=-2:'min(${VIDEO_OUTPUT_HEIGHT},ih)'`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-map_metadata", "-1",
      "-t", String(MAX_VIDEO_DURATION),
      "-y",
      outputPath,
    ];

    const proc = spawn("ffmpeg", args, { timeout: 60000 });
    let stderr = "";

    proc.stderr.on("data", (data) => { stderr += data; });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg transcode failed: ${stderr.slice(-500)}`));
      }
      resolve();
    });

    proc.on("error", (err) => reject(err));
  });
}
```

**Step 2: Commit**

```bash
git add server/src/lib/video.js
git commit -m "feat(video): add processVideo transcoding function"
```

---

## Task 6: Thumbnail Extraction

**Files:**
- Modify: `server/src/lib/video.js`

**Step 1: Implement extractThumbnail function**

Add to `server/src/lib/video.js`:

```javascript
export async function extractThumbnail(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-i", inputPath,
      "-ss", "1",
      "-vframes", "1",
      "-vf", "scale=-2:480",
      "-q:v", "3",
      "-y",
      outputPath,
    ];

    const proc = spawn("ffmpeg", args, { timeout: 10000 });
    let stderr = "";

    proc.stderr.on("data", (data) => { stderr += data; });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg thumbnail failed: ${stderr.slice(-500)}`));
      }
      resolve();
    });

    proc.on("error", (err) => reject(err));
  });
}
```

**Step 2: Add key generators**

Add to `server/src/lib/video.js`:

```javascript
export function makeVideoKey(userId) {
  return `video/${userId}/${Date.now()}-${crypto.randomUUID()}.mp4`;
}

export function makeThumbnailKey(userId) {
  return `thumb/${userId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
}
```

**Step 3: Commit**

```bash
git add server/src/lib/video.js
git commit -m "feat(video): add thumbnail extraction and key generators"
```

---

## Task 7: Update Media Routes for Video

**Files:**
- Modify: `server/src/routes/media.js`

**Step 1: Import video utilities**

At the top of `server/src/routes/media.js`, add:

```javascript
import {
  VIDEO_CONTENT_TYPES,
  MAX_VIDEO_FILE_SIZE,
  validateVideo,
  processVideo,
  extractThumbnail,
  makeVideoKey,
  makeThumbnailKey,
} from "../lib/video.js";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
```

**Step 2: Update presign to accept video content types**

In the `/presign` route, update the `allowedTypes` set:

```javascript
const allowedImageTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const isVideo = VIDEO_CONTENT_TYPES.has(contentType);
const isImage = allowedImageTypes.has(contentType);

if (!isImage && !isVideo) {
  return c.json({ error: "Unsupported file type" }, 400);
}

const maxSize = isVideo ? MAX_VIDEO_FILE_SIZE : (useLocalStorage ? MAX_LOCAL_SIZE : spacesConfig.maxBytes);
if (size > maxSize) {
  const maxMB = Math.round(maxSize / 1024 / 1024);
  return c.json({ error: `File too large (max ${maxMB}MB)` }, 400);
}
```

**Step 3: Update complete route to handle video**

Replace the `/complete` route with:

```javascript
mediaRouter.post("/complete", ensureSession, async (c) => {
  const tempDir = mkdtempSync(join(tmpdir(), "knitly-media-"));

  try {
    assertSpacesConfig();
    const body = await c.req.json();
    const { key } = CompleteSchema.parse(body);
    const currentUser = c.get("user");

    if (!key.startsWith(`raw/${currentUser.id}/`)) {
      return c.json({ error: "Invalid media key" }, 403);
    }

    const originalBuffer = await downloadObject(key);
    const rawPath = join(tempDir, "raw");
    writeFileSync(rawPath, originalBuffer);

    const isVideo = key.match(/\.(mp4|mov|webm|m4v)$/i);

    if (isVideo) {
      const validation = await validateVideo(rawPath);

      if (!validation.valid) {
        await deleteObject(key);
        if (validation.error === "duration_exceeded") {
          return c.json({ error: `Video too long (max ${validation.maxDuration} seconds)` }, 400);
        }
        return c.json({ error: "Video file appears corrupted" }, 400);
      }

      const processedPath = join(tempDir, "processed.mp4");
      const thumbPath = join(tempDir, "thumb.jpg");

      await processVideo(rawPath, processedPath);

      try {
        await extractThumbnail(processedPath, thumbPath);
      } catch {
        await extractThumbnail(rawPath, thumbPath);
      }

      const videoKey = makeVideoKey(currentUser.id);
      const thumbKey = makeThumbnailKey(currentUser.id);

      const videoBuffer = readFileSync(processedPath);
      const thumbBuffer = readFileSync(thumbPath);

      await uploadProcessed(videoKey, videoBuffer, "video/mp4");
      await uploadProcessed(thumbKey, thumbBuffer, "image/jpeg");
      await deleteObject(key);

      return c.json({
        url: getPublicUrl(videoKey),
        thumbnailUrl: getPublicUrl(thumbKey),
        width: validation.width,
        height: Math.min(validation.height, 720),
        duration: validation.duration,
        type: "video",
      });
    }

    const imgValidation = validateUpload(originalBuffer, null, key);
    if (!imgValidation.valid) {
      await deleteObject(key);
      return c.json({ error: "Invalid file format" }, 400);
    }

    const dimensionCheck = await validateImageDimensions(originalBuffer);
    if (!dimensionCheck.valid) {
      await deleteObject(key);
      const msg = dimensionCheck.error === "dimensions_exceeded"
        ? "Image dimensions too large (max 8192x8192)"
        : "Invalid image file";
      return c.json({ error: msg }, 400);
    }

    const { buffer, width, height } = await processImage(originalBuffer);
    const processedKey = makeProcessedKey(currentUser.id);

    await uploadProcessed(processedKey, buffer);
    await deleteObject(key);

    return c.json({
      url: getPublicUrl(processedKey),
      width,
      height,
      type: "image",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }
    logError("Media complete error.");
    return c.json({ error: "Failed to process media" }, 500);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
```

**Step 4: Update uploadProcessed to accept content type**

In `server/src/lib/media.js`, modify `uploadProcessed`:

```javascript
export async function uploadProcessed(key, buffer, contentType = "image/webp") {
  if (useLocalStorage) {
    const filePath = path.join(localUploadDir, key.replace(/\//g, "_"));
    fs.writeFileSync(filePath, buffer);
    return;
  }

  const cacheControl = contentType.startsWith("video/")
    ? "public, max-age=31536000"
    : "public, max-age=31536000, immutable";

  const command = new PutObjectCommand({
    Bucket: spacesConfig.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: cacheControl,
  });
  await spaces.send(command);
}
```

**Step 5: Commit**

```bash
git add server/src/routes/media.js server/src/lib/media.js
git commit -m "feat(video): update media routes to handle video uploads"
```

---

## Task 8: Update Posts Route for Video Media

**Files:**
- Modify: `server/src/routes/posts.js`

**Step 1: Update media parsing in POST /posts**

In `server/src/routes/posts.js`, update the media parsing:

```javascript
const media = rawMedia
  .filter((item) => item && typeof item.url === "string")
  .slice(0, 6)
  .map((item, index) => ({
    url: item.url,
    thumbnailUrl: item.thumbnailUrl || null,
    width: Number.isFinite(item.width) ? item.width : null,
    height: Number.isFinite(item.height) ? item.height : null,
    duration: Number.isFinite(item.duration) ? item.duration : null,
    type: item.type === "video" ? "video" : "image",
    sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
  }));
```

**Step 2: Commit**

```bash
git add server/src/routes/posts.js
git commit -m "feat(posts): support video media type in post creation"
```

---

## Task 9: Update Frontend Types

**Files:**
- Modify: `frontend/src/api/endpoints.ts`

**Step 1: Update MediaItem interface**

```typescript
export interface MediaItem {
  url: string
  thumbnailUrl?: string
  width?: number | null
  height?: number | null
  duration?: number | null
  type: 'image' | 'video'
  sortOrder?: number
}
```

**Step 2: Commit**

```bash
git add frontend/src/api/endpoints.ts
git commit -m "feat(types): add video fields to MediaItem interface"
```

---

## Task 10: Redesign CreatePostModal

**Files:**
- Modify: `frontend/src/components/CreatePostModal.tsx`

**Step 1: Replace the entire CreatePostModal component**

```tsx
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
                {previews.map((url, idx) => (
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
```

**Step 2: Commit**

```bash
git add frontend/src/components/CreatePostModal.tsx
git commit -m "feat(ui): redesign CreatePostModal with photo/video buttons"
```

---

## Task 11: Update PostCard for Video Playback

**Files:**
- Modify: `frontend/src/components/PostCard.tsx`

**Step 1: Add video rendering logic**

Find the media rendering section (around line 262-304) and replace with:

```tsx
{mediaItems.length === 1 && mediaItems[0].type === 'video' && (
  <div className="rounded-3xl overflow-hidden mb-4 -mx-2 bg-black">
    <video
      src={mediaItems[0].url}
      poster={mediaItems[0].thumbnailUrl}
      className="w-full max-h-96"
      controls
      playsInline
      preload="metadata"
    />
  </div>
)}
{mediaItems.length === 1 && mediaItems[0].type !== 'video' && (
  <div className="rounded-3xl overflow-hidden mb-4 -mx-2">
    <button
      type="button"
      onClick={() => useLightbox.getState().open(
        mediaItems.map((m) => ({ url: m.url, alt: "Post media" })),
        0
      )}
      className="w-full cursor-zoom-in"
    >
      <img
        src={mediaItems[0].url}
        alt="Post media"
        className="w-full h-auto object-cover max-h-96"
        loading="lazy"
        decoding="async"
      />
    </button>
  </div>
)}
{mediaItems.length > 1 && (
  <div className="grid grid-cols-2 gap-2 rounded-3xl overflow-hidden mb-4 -mx-2">
    {mediaItems.map((item, idx) => (
      <button
        type="button"
        key={`${item.url}-${idx}`}
        onClick={() => useLightbox.getState().open(
          mediaItems.map((m) => ({ url: m.url, alt: "Post media" })),
          idx
        )}
        className="relative w-full aspect-square bg-gray-100 overflow-hidden cursor-zoom-in"
      >
        <img
          src={item.url}
          alt={`Post media ${idx + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </button>
    ))}
  </div>
)}
```

**Step 2: Update MediaItem type import if needed**

Make sure the import includes the type:

```tsx
import type { Post, ReactionType, ReactionCounts, MediaItem } from '../api/endpoints'
```

**Step 3: Commit**

```bash
git add frontend/src/components/PostCard.tsx
git commit -m "feat(ui): add video playback support to PostCard"
```

---

## Task 12: Manual Testing Checklist

**Step 1: Test image upload still works**

1. Create a new post with a single image
2. Create a new post with multiple images (2-6)
3. Verify images display correctly in feed

**Step 2: Test video upload**

1. Upload a short video (< 30s) from phone/desktop
2. Verify progress indicator shows during upload
3. Verify video appears in feed with thumbnail
4. Verify video plays when tapped
5. Verify native controls work (play/pause/seek/volume)

**Step 3: Test error cases**

1. Try uploading a video > 30 seconds — should reject with clear message
2. Try uploading a video > 50MB — should reject with clear message
3. Try uploading a corrupted file — should reject gracefully

**Step 4: Test mutual exclusivity**

1. Select photos, verify video button disappears
2. Clear photos, verify both buttons return
3. Select video, verify photos button disappears
4. Clear video, verify both buttons return

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete video upload support (30s max, 720p)"
```

---

## Task 13: Update TODO.md

**Files:**
- Modify: `TODO.md`

**Step 1: Mark video uploads complete**

Change:
```markdown
- [ ] **Video uploads** — 30s max, 720p, ffmpeg transcoding, CreatePostModal redesign
```

To:
```markdown
- [x] **Video uploads** — 30s max, 720p, ffmpeg transcoding, CreatePostModal redesign
```

**Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: mark video uploads complete"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | `server/src/lib/db.js` |
| 2 | Video utilities setup | `server/src/lib/video.js` |
| 3 | Video metadata extraction | `server/src/lib/video.js` |
| 4 | Video validation | `server/src/lib/video.js` |
| 5 | Video transcoding | `server/src/lib/video.js` |
| 6 | Thumbnail extraction | `server/src/lib/video.js` |
| 7 | Media routes update | `server/src/routes/media.js`, `server/src/lib/media.js` |
| 8 | Posts route update | `server/src/routes/posts.js` |
| 9 | Frontend types | `frontend/src/api/endpoints.ts` |
| 10 | CreatePostModal redesign | `frontend/src/components/CreatePostModal.tsx` |
| 11 | PostCard video playback | `frontend/src/components/PostCard.tsx` |
| 12 | Manual testing | — |
| 13 | Update TODO | `TODO.md` |

**Prerequisites:** ffmpeg must be installed on the server (`sudo apt install ffmpeg` or equivalent).
