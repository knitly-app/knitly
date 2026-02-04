import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const {
  SPACES_ENDPOINT,
  SPACES_REGION,
  SPACES_BUCKET,
  SPACES_KEY,
  SPACES_SECRET,
  SPACES_PUBLIC_URL,
  MAX_UPLOAD_BYTES,
  MEDIA_MAX_DIMENSION,
  MEDIA_QUALITY,
  USE_LOCAL_STORAGE,
  LOCAL_UPLOAD_DIR,
  BASE_URL,
} = process.env;

const MAX_BYTES = parseInt(MAX_UPLOAD_BYTES || "10485760", 10);
const MAX_DIMENSION = parseInt(MEDIA_MAX_DIMENSION || "2048", 10);
const QUALITY = parseInt(MEDIA_QUALITY || "82", 10);
const INPUT_MAX_DIMENSION = 8192;

const MAGIC_BYTES = {
  jpeg: { bytes: [0xFF, 0xD8, 0xFF], offset: 0 },
  png: { bytes: [0x89, 0x50, 0x4E, 0x47], offset: 0 },
  gif: { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0 },
  webp: { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, secondary: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 } },
};

const CONTENT_TYPE_TO_FORMAT = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const EXT_TO_FORMAT = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  gif: "gif",
  webp: "webp",
};

function detectMagicFormat(buffer) {
  if (!buffer || buffer.length < 12) return null;

  for (const [format, sig] of Object.entries(MAGIC_BYTES)) {
    const primary = sig.bytes.every((b, i) => buffer[sig.offset + i] === b);
    if (!primary) continue;

    if (sig.secondary) {
      const secondary = sig.secondary.bytes.every((b, i) => buffer[sig.secondary.offset + i] === b);
      if (!secondary) continue;
    }
    return format;
  }
  return null;
}

function logSuspiciousUpload(details) {
  console.warn("[MEDIA SECURITY]", JSON.stringify({
    timestamp: new Date().toISOString(),
    ...details,
  }));
}

export function validateUpload(buffer, claimedContentType, filename) {
  const errors = [];

  const detectedFormat = detectMagicFormat(buffer);
  const claimedFormat = CONTENT_TYPE_TO_FORMAT[claimedContentType];

  if (!detectedFormat) {
    errors.push("unrecognized_format");
    logSuspiciousUpload({
      event: "unrecognized_magic_bytes",
      filename,
      claimedContentType,
      firstBytes: buffer.slice(0, 16).toString("hex"),
    });
  } else if (claimedFormat && detectedFormat !== claimedFormat) {
    errors.push("content_type_mismatch");
    logSuspiciousUpload({
      event: "content_type_mismatch",
      filename,
      claimedContentType,
      claimedFormat,
      detectedFormat,
    });
  }

  if (filename) {
    const ext = path.extname(filename).slice(1).toLowerCase();
    const extFormat = EXT_TO_FORMAT[ext];
    if (extFormat && detectedFormat && extFormat !== detectedFormat) {
      errors.push("extension_mismatch");
      logSuspiciousUpload({
        event: "extension_mismatch",
        filename,
        extension: ext,
        extFormat,
        detectedFormat,
      });
    }
  }

  return {
    valid: errors.length === 0,
    detectedFormat,
    errors,
  };
}

export async function validateImageDimensions(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    if (!width || !height) {
      logSuspiciousUpload({ event: "no_dimensions", width, height });
      return { valid: false, error: "invalid_image" };
    }

    if (width > INPUT_MAX_DIMENSION || height > INPUT_MAX_DIMENSION) {
      logSuspiciousUpload({
        event: "dimensions_exceeded",
        width,
        height,
        max: INPUT_MAX_DIMENSION,
      });
      return { valid: false, error: "dimensions_exceeded", width, height };
    }

    return { valid: true, width, height };
  } catch (err) {
    logSuspiciousUpload({ event: "metadata_extraction_failed", error: err.message });
    return { valid: false, error: "invalid_image" };
  }
}

export const useLocalStorage = USE_LOCAL_STORAGE === "true" || !SPACES_ENDPOINT;
export const localUploadDir = LOCAL_UPLOAD_DIR || path.join(process.cwd(), "../uploads");
export const baseUrl = BASE_URL || "http://localhost:3000";

if (useLocalStorage && !fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir, { recursive: true });
}

const pendingLocalUploads = new Map();

export function assertSpacesConfig() {
  if (useLocalStorage) return;
  if (!SPACES_ENDPOINT || !SPACES_REGION || !SPACES_BUCKET || !SPACES_KEY || !SPACES_SECRET) {
    throw new Error("Missing Spaces configuration. Set SPACES_ENDPOINT, SPACES_REGION, SPACES_BUCKET, SPACES_KEY, SPACES_SECRET.");
  }
}

export const spaces = new S3Client({
  region: SPACES_REGION || "us-east-1",
  endpoint: SPACES_ENDPOINT,
  credentials: {
    accessKeyId: SPACES_KEY || "",
    secretAccessKey: SPACES_SECRET || "",
  },
});

export const spacesConfig = {
  bucket: SPACES_BUCKET || "",
  publicUrl: (SPACES_PUBLIC_URL || (SPACES_BUCKET && SPACES_REGION
    ? `https://${SPACES_BUCKET}.${SPACES_REGION}.digitaloceanspaces.com`
    : ""
  )).replace(/\/+$/, ""),
  maxBytes: MAX_BYTES,
  maxDimension: MAX_DIMENSION,
  quality: QUALITY,
};

function extFromContentType(contentType) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/jpeg":
    case "image/jpg":
    default:
      return "jpg";
  }
}

export function makeRawKey(userId, contentType) {
  const ext = extFromContentType(contentType);
  return `raw/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

export function makeProcessedKey(userId) {
  return `media/${userId}/${Date.now()}-${crypto.randomUUID()}.webp`;
}

export async function createPresignedUpload(key, contentType) {
  if (useLocalStorage) {
    pendingLocalUploads.set(key, { contentType, createdAt: Date.now() });
    setTimeout(() => pendingLocalUploads.delete(key), 300 * 1000);
    return { uploadUrl: `${baseUrl}/api/media/upload/${encodeURIComponent(key)}` };
  }

  const command = new PutObjectCommand({
    Bucket: spacesConfig.bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(spaces, command, { expiresIn: 60 * 5 });
  return { uploadUrl };
}

export function getPendingUpload(key) {
  return pendingLocalUploads.get(key);
}

export function clearPendingUpload(key) {
  pendingLocalUploads.delete(key);
}

export async function saveLocalUpload(key, buffer) {
  const filePath = path.join(localUploadDir, key.replace(/\//g, "_"));
  fs.writeFileSync(filePath, buffer);
}

export async function downloadObject(key) {
  if (useLocalStorage) {
    const filePath = path.join(localUploadDir, key.replace(/\//g, "_"));
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }
    return fs.readFileSync(filePath);
  }

  const command = new GetObjectCommand({
    Bucket: spacesConfig.bucket,
    Key: key,
  });
  const result = await spaces.send(command);
  if (!result.Body) {
    throw new Error("Missing object body");
  }
  return await streamToBuffer(result.Body);
}

export async function uploadProcessed(key, buffer) {
  if (useLocalStorage) {
    const filePath = path.join(localUploadDir, key.replace(/\//g, "_"));
    fs.writeFileSync(filePath, buffer);
    return;
  }

  const command = new PutObjectCommand({
    Bucket: spacesConfig.bucket,
    Key: key,
    Body: buffer,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
  });
  await spaces.send(command);
}

export async function deleteObject(key) {
  if (useLocalStorage) {
    const filePath = path.join(localUploadDir, key.replace(/\//g, "_"));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: spacesConfig.bucket,
    Key: key,
  });
  await spaces.send(command);
}

export async function processImage(buffer) {
  const image = sharp(buffer).rotate();
  const resized = image.resize({
    width: spacesConfig.maxDimension,
    height: spacesConfig.maxDimension,
    fit: "inside",
    withoutEnlargement: true,
  });

  const metadata = await resized.metadata();
  const outputBuffer = await resized
    .clone()
    .webp({ quality: spacesConfig.quality })
    .toBuffer();

  return {
    buffer: outputBuffer,
    width: metadata.width || null,
    height: metadata.height || null,
  };
}

export function getPublicUrl(key) {
  if (useLocalStorage) {
    return `${baseUrl}/uploads/${key.replace(/\//g, "_")}`;
  }
  return `${spacesConfig.publicUrl}/${key}`;
}

async function streamToBuffer(stream) {
  if (stream instanceof Uint8Array) {
    return Buffer.from(stream);
  }

  if (typeof stream.getReader === "function") {
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  if (typeof stream.on === "function") {
    return await new Promise((resolve, reject) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }

  throw new Error("Unsupported stream type");
}
