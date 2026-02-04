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
