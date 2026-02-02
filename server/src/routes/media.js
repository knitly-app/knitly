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
} from "../lib/media.js";
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

  await saveLocalUpload(key, Buffer.from(body));
  clearPendingUpload(key);

  return c.json({ success: true });
});

mediaRouter.post("/presign", ensureSession, async (c) => {
  try {
    assertSpacesConfig();
    const body = await c.req.json();
    const { contentType, size } = PresignSchema.parse(body);

    const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    if (!allowedTypes.has(contentType)) {
      return c.json({ error: "Unsupported image type" }, 400);
    }

    const maxSize = useLocalStorage ? MAX_LOCAL_SIZE : spacesConfig.maxBytes;
    if (size > maxSize) {
      return c.json({ error: "File too large" }, 400);
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
  try {
    assertSpacesConfig();
    const body = await c.req.json();
    const { key } = CompleteSchema.parse(body);
    const currentUser = c.get("user");

    if (!key.startsWith(`raw/${currentUser.id}/`)) {
      return c.json({ error: "Invalid media key" }, 403);
    }

    const originalBuffer = await downloadObject(key);
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
  }
});
