import { Hono } from "hono";
import { z } from "zod";
import { ensureSession } from "../middleware/auth.js";
import {
  assertSpacesConfig,
  spacesConfig,
  makeRawKey,
  makeProcessedKey,
  createPresignedUpload,
  downloadObject,
  uploadProcessed,
  deleteObject,
  processImage,
  getPublicUrl,
  useLocalStorage,
  getPendingUpload,
  clearPendingUpload,
  saveLocalUpload,
  validateUpload,
  validateImageDimensions,
} from "../lib/media.js";
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
import { logError } from "../lib/logging.js";

export const mediaRouter = new Hono();

const PresignSchema = z.object({
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

const CompleteSchema = z.object({
  key: z.string().min(1),
});

const MAX_LOCAL_SIZE = 10 * 1024 * 1024;

mediaRouter.put("/upload/:key", async (c) => {
  if (!useLocalStorage) {
    return c.json({ error: "Local uploads not enabled" }, 400);
  }

  const key = decodeURIComponent(c.req.param("key"));
  const pending = getPendingUpload(key);

  if (!pending) {
    return c.json({ error: "Invalid or expired upload key" }, 400);
  }

  const body = await c.req.arrayBuffer();

  if (body.byteLength > MAX_LOCAL_SIZE) {
    return c.json({ error: "File too large" }, 400);
  }

  const buffer = Buffer.from(body);
  const validation = validateUpload(buffer, pending.contentType, key);
  if (!validation.valid) {
    clearPendingUpload(key);
    return c.json({ error: "Invalid file format" }, 400);
  }

  await saveLocalUpload(key, buffer);
  clearPendingUpload(key);

  return c.json({ success: true });
});

mediaRouter.post("/presign", ensureSession, async (c) => {
  try {
    assertSpacesConfig();
    const body = await c.req.json();
    const { contentType, size } = PresignSchema.parse(body);

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

    const currentUser = c.get("user");
    const key = makeRawKey(currentUser.id, contentType);
    const { uploadUrl } = await createPresignedUpload(key, contentType);

    return c.json({
      uploadUrl,
      key,
      expiresIn: 300,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }
    logError("Media presign error.");
    return c.json({ error: "Failed to create upload URL" }, 500);
  }
});

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
