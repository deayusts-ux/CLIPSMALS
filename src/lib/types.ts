export type CaptionTemplate = "hormozi" | "beast" | "minimal" | "cyber" | "studio" | "cinematic" | "explainer" | "editorial";
export type HookSensitivity = "aggressive" | "balanced" | "context";
export type AspectRatio = "9:16" | "1:1" | "16:9";
export type DurationPreset = "short" | "medium" | "long";

export interface GenerateSettings {
  template: CaptionTemplate;
  duration: DurationPreset;
  hook: HookSensitivity;
  ratio: AspectRatio;
}

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptCue {
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
}

export interface VideoInfo {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  language: string;
}

export interface ClipSegment {
  id: string;
  start: number;
  end: number;
  title: string;
  hookText: string;
  score: number;
  reasons: string[];
  cues: TranscriptCue[];
  renderedUrl?: string;
  renderedTemplate?: CaptionTemplate;
  renderedRatio?: AspectRatio;
}

export interface Project {
  id: string;
  video: VideoInfo;
  settings: GenerateSettings;
  clips: ClipSegment[];
  createdAt: number;
  transcriptSource: "manual" | "auto" | "none";
}

export type JobStage =
  | "queued"
  | "fetching"
  | "transcribing"
  | "scoring"
  | "downloading"
  | "rendering"
  | "done"
  | "error";

export interface JobState {
  id: string;
  stage: JobStage;
  progress: number;
  message: string;
  projectId?: string;
  error?: string;
  startedAt: number;
}

export const DURATION_RANGES: Record<DurationPreset, [number, number]> = {
  short: [12, 30],
  medium: [30, 60],
  long: [60, 90],
};

export const TEMPLATE_META: Record<
  CaptionTemplate,
  { name: string; tag: string; letter: string; description: string }
> = {
  hormozi: {
    name: "Hormozi Bold",
    tag: "Viral Pick",
    letter: "H",
    description:
      "Words bounce with neon-yellow highlight + punchy animated emojis",
  },
  beast: {
    name: "Beast Punch",
    tag: "High RPM",
    letter: "B",
    description:
      "Rapid-fire 1-2 words per frame with explosive pop & red bursts",
  },
  minimal: {
    name: "Minimal Clean",
    tag: "Podcast / Edu",
    letter: "M",
    description:
      "Clean sans-serif subtitle bar with smooth fade-in, no distraction",
  },
  cyber: {
    name: "Cyber Glow",
    tag: "Futuristic",
    letter: "C",
    description:
      "Electric cyan and violet outer glow with glitch karaoke reveal",
  },
    studio: {
    name: "Studio Red",
    tag: "Edu / Story",
    letter: "S",
    description:
      "Red hook banner + italic tagline, left captions, punch-in zooms, vignette & keyword cutaway cards",
  },
  cinematic: {
    name: "Cinematic Stack",
    tag: "Storyteller",
    letter: "C",
    description:
      "2-tier stacked bold text with soft cinematic drop shadow, no harsh outlines",
  },
  explainer: {
    name: "Red Badge Explainer",
    tag: "Deep Dive",
    letter: "R",
    description:
      "Signature red topic pill badge header with clean educational captions & moody vignette",
  },
  editorial: {
    name: "Editorial Podcast",
    tag: "Interview",
    letter: "E",
    description:
      "Quiet luxury Georgia serif subtitle, clean negative-space placement for talkshows",
  },
};

export function formatTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}