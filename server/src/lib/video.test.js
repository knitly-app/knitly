import { describe, it, expect } from "bun:test";
import { assertFfmpegAvailable, VIDEO_CONTENT_TYPES, MAX_VIDEO_DURATION, getVideoMetadata, validateVideo } from "./video.js";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

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

describe("getVideoMetadata", () => {
  it("should reject invalid files", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "video-test-"));
    const fakePath = join(tempDir, "fake.mp4");
    writeFileSync(fakePath, "not a video");

    await expect(getVideoMetadata(fakePath)).rejects.toThrow();

    rmSync(tempDir, { recursive: true, force: true });
  });
});

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
