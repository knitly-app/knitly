import { describe, it, expect } from "bun:test";
import {
  assertFfmpegAvailable,
  VIDEO_CONTENT_TYPES,
  MAX_VIDEO_DURATION,
  MAX_VIDEO_FILE_SIZE,
  VIDEO_OUTPUT_HEIGHT,
  getVideoMetadata,
  validateVideo,
  processVideo,
  extractThumbnail,
  makeVideoKey,
  makeThumbnailKey,
} from "./video.js";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const FIXTURES_DIR = join(import.meta.dir, "../../tests/fixtures");
const TEST_VIDEO = join(FIXTURES_DIR, "test-video.mp4");
const TEST_VIDEO_LONG = join(FIXTURES_DIR, "test-video-long.mp4");

describe("video constants", () => {
  it("exports VIDEO_CONTENT_TYPES with correct types", () => {
    expect(VIDEO_CONTENT_TYPES.has("video/mp4")).toBe(true);
    expect(VIDEO_CONTENT_TYPES.has("video/quicktime")).toBe(true);
    expect(VIDEO_CONTENT_TYPES.has("video/webm")).toBe(true);
    expect(VIDEO_CONTENT_TYPES.has("video/x-m4v")).toBe(true);
    expect(VIDEO_CONTENT_TYPES.has("image/jpeg")).toBe(false);
    expect(VIDEO_CONTENT_TYPES.has("video/avi")).toBe(false);
  });

  it("exports MAX_VIDEO_DURATION as 30", () => {
    expect(MAX_VIDEO_DURATION).toBe(30);
  });

  it("exports MAX_VIDEO_FILE_SIZE as 50MB", () => {
    expect(MAX_VIDEO_FILE_SIZE).toBe(50 * 1024 * 1024);
  });

  it("exports VIDEO_OUTPUT_HEIGHT as 720", () => {
    expect(VIDEO_OUTPUT_HEIGHT).toBe(720);
  });
});

describe("assertFfmpegAvailable", () => {
  it("does not throw if ffmpeg is available", () => {
    expect(() => assertFfmpegAvailable()).not.toThrow();
  });
});

describe("getVideoMetadata", () => {
  it("extracts metadata from valid video", async () => {
    const meta = await getVideoMetadata(TEST_VIDEO);
    expect(meta.duration).toBeCloseTo(2, 0);
    expect(meta.width).toBe(320);
    expect(meta.height).toBe(240);
    expect(meta.codec).toBe("h264");
  });

  it("rejects invalid files", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const fakePath = join(tempDir, "fake.mp4");
    writeFileSync(fakePath, "not a video");

    await expect(getVideoMetadata(fakePath)).rejects.toThrow();

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects non-existent files", async () => {
    await expect(getVideoMetadata("/nonexistent/video.mp4")).rejects.toThrow();
  });
});

describe("validateVideo", () => {
  it("validates short video successfully", async () => {
    const result = await validateVideo(TEST_VIDEO);
    expect(result.valid).toBe(true);
    expect(result.duration).toBeCloseTo(2, 0);
    expect(result.width).toBe(320);
    expect(result.height).toBe(240);
    expect(result.codec).toBe("h264");
  });

  it("rejects video over 30 seconds", async () => {
    const result = await validateVideo(TEST_VIDEO_LONG);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("duration_exceeded");
    expect(result.duration).toBeGreaterThan(30);
    expect(result.maxDuration).toBe(30);
  });

  it("rejects files that ffprobe cannot parse", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const fakePath = join(tempDir, "fake.mp4");
    writeFileSync(fakePath, "not a video");

    const result = await validateVideo(fakePath);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_video");

    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("processVideo", () => {
  it("transcodes video to H.264 MP4", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const outputPath = join(tempDir, "output.mp4");

    await processVideo(TEST_VIDEO, outputPath);

    expect(existsSync(outputPath)).toBe(true);
    const meta = await getVideoMetadata(outputPath);
    expect(meta.codec).toBe("h264");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("preserves aspect ratio when scaling", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const outputPath = join(tempDir, "output.mp4");

    await processVideo(TEST_VIDEO, outputPath);

    const meta = await getVideoMetadata(outputPath);
    const aspectRatio = meta.width / meta.height;
    expect(aspectRatio).toBeCloseTo(320 / 240, 1);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects invalid input file", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const fakePath = join(tempDir, "fake.mp4");
    const outputPath = join(tempDir, "output.mp4");
    writeFileSync(fakePath, "not a video");

    await expect(processVideo(fakePath, outputPath)).rejects.toThrow();

    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("extractThumbnail", () => {
  it("extracts JPEG thumbnail from video", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const thumbPath = join(tempDir, "thumb.jpg");

    await extractThumbnail(TEST_VIDEO, thumbPath);

    expect(existsSync(thumbPath)).toBe(true);
    const buffer = readFileSync(thumbPath);
    expect(buffer[0]).toBe(0xFF);
    expect(buffer[1]).toBe(0xD8);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates thumbnail with reasonable size", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const thumbPath = join(tempDir, "thumb.jpg");

    await extractThumbnail(TEST_VIDEO, thumbPath);

    const stats = statSync(thumbPath);
    expect(stats.size).toBeGreaterThan(0);
    expect(stats.size).toBeLessThan(500 * 1024);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects non-video input", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const fakePath = join(tempDir, "fake.mp4");
    const thumbPath = join(tempDir, "thumb.jpg");
    writeFileSync(fakePath, "not a video");

    await expect(extractThumbnail(fakePath, thumbPath)).rejects.toThrow();

    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("makeVideoKey", () => {
  it("returns path starting with video/", () => {
    const key = makeVideoKey(123);
    expect(key.startsWith("video/")).toBe(true);
  });

  it("includes userId in path", () => {
    const key = makeVideoKey(456);
    expect(key).toContain("/456/");
  });

  it("ends with .mp4", () => {
    const key = makeVideoKey(789);
    expect(key.endsWith(".mp4")).toBe(true);
  });

  it("generates unique keys", () => {
    const key1 = makeVideoKey(1);
    const key2 = makeVideoKey(1);
    expect(key1).not.toBe(key2);
  });
});

describe("makeThumbnailKey", () => {
  it("returns path starting with thumb/", () => {
    const key = makeThumbnailKey(123);
    expect(key.startsWith("thumb/")).toBe(true);
  });

  it("includes userId in path", () => {
    const key = makeThumbnailKey(456);
    expect(key).toContain("/456/");
  });

  it("ends with .jpg", () => {
    const key = makeThumbnailKey(789);
    expect(key.endsWith(".jpg")).toBe(true);
  });

  it("generates unique keys", () => {
    const key1 = makeThumbnailKey(1);
    const key2 = makeThumbnailKey(1);
    expect(key1).not.toBe(key2);
  });
});
