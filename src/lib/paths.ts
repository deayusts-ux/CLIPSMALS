import path from "node:path";
import fs from "node:fs";

export const ROOT = process.cwd();
export const BIN_DIR = path.join(ROOT, "bin");
export const DATA_DIR = path.join(ROOT, "data");
export const PROJECTS_DIR = path.join(DATA_DIR, "projects");
export const MEDIA_DIR = path.join(DATA_DIR, "media");
export const FONTS_DIR = path.join(ROOT, "public", "fonts");

export const YTDLP = path.join(BIN_DIR, "yt-dlp.exe");
export const DENO = path.join(BIN_DIR, "deno.exe");
export const FFMPEG = path.join(BIN_DIR, "ffmpeg.exe");

export function ensureDirs() {
  for (const dir of [DATA_DIR, PROJECTS_DIR, MEDIA_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function projectDir(projectId: string): string {
  return path.join(MEDIA_DIR, projectId);
}

export function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}