import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  YTDLP,
  DENO,
  FFMPEG,
  ensureDirs,
  projectDir,
} from "./paths";
import type { TranscriptCue, TranscriptWord, VideoInfo } from "./types";

export class EngineError extends Error {
  constructor(message: string, public code: string = "ENGINE_ERROR") {
    super(message);
  }
}

function run(
  bin: string,
  args: string[],
  opts: { onProgress?: (line: string) => void; timeoutMs?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let tail = "";
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
          reject(new EngineError("Process timed out", "TIMEOUT"));
        }, opts.timeoutMs)
      : null;
    child.stdout.on("data", (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      if (stdout.length > 40_000_000) stdout = stdout.slice(-20_000_000);
    });
    child.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      stderr += s;
      if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000);
      tail = (tail + s).slice(-8000);
      if (opts.onProgress) {
        for (const line of s.split(/[\r\n]+/)) {
          if (line.trim()) opts.onProgress(line.trim());
        }
      }
    });
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(new EngineError(`Failed to start ${path.basename(bin)}: ${err.message}`, "SPAWN_ERROR"));
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else {
        const lastLines = (stderr || tail).split(/[\r\n]+/).filter(Boolean).slice(-4).join(" ");
        const err = new EngineError(lastLines || `${path.basename(bin)} exited with code ${code}`, "PROCESS_ERROR");
        (err as Error & { fullStderr?: string }).fullStderr = stderr;
        reject(err);
      }
    });
  });
}

const RATE_LIMIT_RE = /429|Too Many Requests/i;

async function runYtdlp(
  args: string[],
  opts: { onProgress?: (line: string) => void; timeoutMs?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run(YTDLP, args, opts);
    } catch (err) {
      const e = err as Error & { fullStderr?: string };
      if (attempt >= 2 || !RATE_LIMIT_RE.test(`${e.message} ${e.fullStderr || ""}`)) throw err;
      await new Promise((r) => setTimeout(r, 20_000 * (attempt + 1)));
    }
  }
}

function ytdlpBaseArgs(): string[] {
  const args = ["--no-warnings", "--no-playlist", "--retries", "3", "--socket-timeout", "30"];
  if (fs.existsSync(DENO)) args.push("--js-runtimes", `deno:${DENO}`);
  return args;
}

export function checkBinaries(): { ytdlp: boolean; ffmpeg: boolean; deno: boolean } {
  return {
    ytdlp: fs.existsSync(YTDLP),
    ffmpeg: fs.existsSync(FFMPEG),
    deno: fs.existsSync(DENO),
  };
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

interface YtFormat {
  format_id: string;
  ext: string;
  vcodec: string;
  acodec: string;
  height?: number;
  language?: string;
  format_note?: string;
}

interface YtJson {
  id: string;
  title: string;
  channel?: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  language?: string;
  subtitles?: Record<string, YtFormat[]>;
  automatic_captions?: Record<string, YtFormat[]>;
}

export async function fetchVideoMeta(url: string): Promise<{
  info: VideoInfo;
  captionLangs: { lang: string; kind: "manual" | "auto" }[];
}> {
  const { stdout } = await runYtdlp([...ytdlpBaseArgs(), "--skip-download", "--dump-json", url], {
    timeoutMs: 120_000,
  });
  let j: YtJson;
  try {
    j = JSON.parse(stdout.trim().split("\n").pop() || "{}");
  } catch {
    throw new EngineError("Could not parse video metadata", "PARSE_ERROR");
  }
  if (!j.id || !j.duration) {
    throw new EngineError("Video metadata incomplete — it may be private or age-restricted", "META_ERROR");
  }
  if (j.duration > 3 * 3600 + 60) {
    throw new EngineError("Video is longer than 3 hours — please use a shorter video", "TOO_LONG");
  }
  const info: VideoInfo = {
    id: j.id,
    url: `https://www.youtube.com/watch?v=${j.id}`,
    title: j.title,
    channel: j.channel || j.uploader || "Unknown channel",
    duration: j.duration,
    thumbnail: `https://i.ytimg.com/vi/${j.id}/hqdefault.jpg`,
    language: j.language || "en",
  };

  const captionLangs: { lang: string; kind: "manual" | "auto" }[] = [];
  const manual = j.subtitles || {};
  const auto = j.automatic_captions || {};
  const origLang = (info.language || "en").split("-")[0];
  const priority = [origLang, "en", "id"];
  const seen = new Set<string>();
  for (const lang of priority) {
    for (const [dict, kind] of [
      [manual, "manual"],
      [auto, "auto"],
    ] as const) {
      const key = Object.keys(dict).find(
        (k) => k === lang || k.startsWith(`${lang}-`)
      );
      if (key && !seen.has(key) && dict[key]?.some((f) => f.ext === "json3")) {
        seen.add(key);
        captionLangs.push({ lang: key, kind });
      }
    }
  }
  if (captionLangs.length === 0) {
    for (const [dict, kind] of [
      [manual, "manual"],
      [auto, "auto"],
    ] as const) {
      const key = Object.keys(dict).find(
        (k) => !k.includes("-") && dict[k]?.some((f) => f.ext === "json3")
      );
      if (key) {
        captionLangs.push({ lang: key, kind });
        break;
      }
    }
  }
  return { info, captionLangs };
}

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string; tOffsetMs?: number }[];
  wWinId?: number;
}

export async function downloadTranscript(
  url: string,
  projectId: string,
  langs: { lang: string; kind: "manual" | "auto" }[]
): Promise<{ cues: TranscriptCue[]; source: "manual" | "auto" | "none"; language: string }> {
  ensureDirs();
  const dir = projectDir(projectId);
  fs.mkdirSync(dir, { recursive: true });
  if (langs.length === 0) return { cues: [], source: "none", language: "" };

  const preferred = langs[0];
  const outTpl = path.join(dir, "subs.%(ext)s");
  const args = [
    ...ytdlpBaseArgs(),
    "--skip-download",
    preferred.kind === "manual" ? "--write-subs" : "--write-auto-subs",
    "--sub-langs",
    preferred.lang,
    "--sub-format",
    "json3",
    "-o",
    outTpl,
    url,
  ];
  try {
    await runYtdlp(args, { timeoutMs: 120_000 });
  } catch (err) {
    if (langs.length > 1) {
      return downloadTranscript(url, projectId, langs.slice(1));
    }
    throw err;
  }
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("subs.") && f.endsWith(".json3"));
  if (files.length === 0) {
    if (langs.length > 1) return downloadTranscript(url, projectId, langs.slice(1));
    return { cues: [], source: "none", language: preferred.lang };
  }
  const raw = fs.readFileSync(path.join(dir, files[0]), "utf8");
  const cues = parseJson3(raw);
  return { cues, source: preferred.kind, language: preferred.lang };
}

export function parseJson3(raw: string): TranscriptCue[] {
  let data: { events?: Json3Event[] };
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const cues: TranscriptCue[] = [];
  for (const ev of data.events || []) {
    if (ev.tStartMs == null || !ev.segs) continue;
    const text = ev.segs
      .map((s) => s.utf8 || "")
      .join("")
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text === "\n") continue;
    const start = ev.tStartMs / 1000;
    const end = (ev.tStartMs + (ev.dDurationMs || 2000)) / 1000;
    const words: TranscriptWord[] = [];
    const tokens = text.split(" ").filter(Boolean);
    const hasOffsets = ev.segs.some((s) => s.tOffsetMs != null && (s.utf8 || "").trim());
    if (hasOffsets) {
      let cur = "";
      let curStart = start;
      for (const seg of ev.segs) {
        const segTime = start + (seg.tOffsetMs || 0) / 1000;
        const piece = (seg.utf8 || "").replace(/\s*\n\s*/g, " ");
        if (!piece.trim()) {
          if (cur.trim()) {
            words.push({ text: cur.trim(), start: curStart, end: segTime });
            cur = "";
          }
          curStart = segTime;
          continue;
        }
        if (!cur) curStart = segTime;
        cur += piece;
        if (piece.endsWith(" ")) {
          words.push({ text: cur.trim(), start: curStart, end: segTime + 0.12 });
          cur = "";
        }
      }
      if (cur.trim()) words.push({ text: cur.trim(), start: curStart, end });
    }
    if (words.length === 0) {
      const totalChars = tokens.reduce((a, t) => a + t.length + 1, 0);
      let cursor = start;
      for (const tok of tokens) {
        const dur = Math.max(0.12, ((tok.length + 1) / totalChars) * (end - start));
        words.push({ text: tok, start: cursor, end: Math.min(end, cursor + dur) });
        cursor += dur;
      }
    }
    for (let i = 0; i < words.length - 1; i++) {
      words[i].end = Math.min(words[i].end, words[i + 1].start);
      if (words[i].end <= words[i].start) words[i].end = words[i].start + 0.1;
    }
    cues.push({ start, end, text, words });
  }
  for (let i = 0; i < cues.length - 1; i++) {
    const next = cues[i + 1];
    if (cues[i].end > next.start) {
      cues[i].end = Math.max(cues[i].start + 0.1, next.start);
      cues[i].words = cues[i].words.map((w) => ({
        ...w,
        end: Math.max(w.start + 0.05, Math.min(w.end, cues[i].end)),
      }));
    }
  }
  return cues;
}

export async function downloadSourceVideo(
  url: string,
  projectId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  ensureDirs();
  const dir = projectDir(projectId);
  fs.mkdirSync(dir, { recursive: true });
  const outTpl = path.join(dir, "source.%(ext)s");
  const args = [
    ...ytdlpBaseArgs(),
    "-f",
    "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b[ext=mp4]/b",
    "--merge-output-format",
    "mp4",
    "--ffmpeg-location",
    FFMPEG,
    "--newline",
    "-o",
    outTpl,
    url,
  ];
  await runYtdlp(args, {
    timeoutMs: 15 * 60_000,
    onProgress: (line) => {
      const m = line.match(/\[download\]\s+([\d.]+)%/);
      if (m && onProgress) onProgress(parseFloat(m[1]));
    },
  });
  const file = path.join(dir, "source.mp4");
  if (!fs.existsSync(file)) {
    const candidates = fs.readdirSync(dir).filter((f) => f.startsWith("source."));
    if (candidates.length === 0) throw new EngineError("Video download produced no file", "DOWNLOAD_ERROR");
    return path.join(dir, candidates[0]);
  }
  return file;
}

export async function renderClip(opts: {
  sourceFile: string;
  outFile: string;
  start: number;
  end: number;
  videoFilter: string;
  assFile?: string;
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const duration = Math.max(0.5, opts.end - opts.start);
  const vf = opts.assFile
    ? `${opts.videoFilter},subtitles=filename='${opts.assFile.replace(/\\/g, "/").replace(/:/g, "\\:")}'`
    : opts.videoFilter;
  const args = [
    "-y",
    "-ss",
    opts.start.toFixed(3),
    "-i",
    opts.sourceFile,
    "-t",
    duration.toFixed(3),
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-progress",
    "pipe:1",
    "-nostats",
    opts.outFile,
  ];
  await run(FFMPEG, args, {
    timeoutMs: 10 * 60_000,
    onProgress: (line) => {
      const m = line.match(/out_time_ms=(\d+)/);
      if (m && opts.onProgress) {
        const pct = Math.min(99, (parseInt(m[1]) / 1_000_000 / duration) * 100);
        opts.onProgress(pct);
      }
    },
  });
  if (!fs.existsSync(opts.outFile) || fs.statSync(opts.outFile).size < 1000) {
    throw new EngineError("Render produced no output", "RENDER_ERROR");
  }
}

export function cropFilter(ratio: "9:16" | "1:1" | "16:9", srcW: number, srcH: number): string {
  if (ratio === "16:9") {
    return `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1`;
  }
  if (ratio === "1:1") {
    const side = Math.min(srcW, srcH);
    const x = Math.floor((srcW - side) / 2);
    const y = Math.floor((srcH - side) / 2);
    return `crop=${side}:${side}:${x}:${y},scale=720:720,setsar=1`;
  }
  const targetW = Math.min(srcW, Math.round((srcH * 9) / 16));
  const evenW = Math.max(2, targetW - (targetW % 2));
  const x = Math.max(0, Math.floor((srcW - evenW) / 2));
  return `crop=w=${evenW}:h=ih:x=${x}:y=0,scale=720:1280,setsar=1`;
}

export async function probeDimensions(file: string): Promise<{ width: number; height: number }> {
  const { stderr } = await run(FFMPEG, ["-hide_banner", "-i", file], { timeoutMs: 30_000 }).catch(
    (e) => ({ stdout: "", stderr: (e as Error & { fullStderr?: string }).fullStderr || e.message })
  );
  const m = stderr.match(/Stream.*Video:[^\n]*? (\d{2,5})x(\d{2,5})/g);
  if (m && m.length > 0) {
    const last = m[m.length - 1].match(/(\d{2,5})x(\d{2,5})/);
    if (last) return { width: parseInt(last[1]), height: parseInt(last[2]) };
  }
  return { width: 1280, height: 720 };
}