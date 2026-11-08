import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  checkBinaries,
  downloadSourceVideo,
  downloadTranscript,
  extractVideoId,
  fetchVideoMeta,
  EngineError,
} from "@/lib/engine";
import { detectClips } from "@/lib/scoring";
import { createJob, updateJob } from "@/lib/jobs";
import { saveProject } from "@/lib/store";
import { sanitizeId } from "@/lib/paths";
import type { GenerateSettings, Project } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function validSettings(s: unknown): s is GenerateSettings {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    ["hormozi", "beast", "minimal", "cyber", "studio", "cinematic", "explainer", "editorial"].includes(o.template as string) &&
    ["short", "medium", "long"].includes(o.duration as string) &&
    ["aggressive", "balanced", "context"].includes(o.hook as string) &&
    ["9:16", "1:1", "16:9"].includes(o.ratio as string)
  );
}

async function runPipeline(
  jobId: string,
  url: string,
  settings: GenerateSettings
): Promise<void> {
  try {
    updateJob(jobId, "fetching", 5, "Fetching video metadata from YouTube…");
    const { info, captionLangs } = await fetchVideoMeta(url);
    const projectId = sanitizeId(`${info.id}-${Date.now().toString(36)}`);

    updateJob(jobId, "transcribing", 18, `Extracting transcript (${info.title.slice(0, 60)}…)`);
    const { cues, source, language } = await downloadTranscript(url, projectId, captionLangs);
    if (cues.length === 0) {
      throw new EngineError(
        "This video has no captions/subtitles available, so clips cannot be analyzed. Try a video with captions (most podcasts & talks have them).",
        "NO_TRANSCRIPT"
      );
    }

    updateJob(jobId, "scoring", 38, `Analyzing ${cues.length} subtitle cues for viral hooks…`);
    const clips = detectClips(cues, settings.duration, settings.hook, info.duration);
    if (clips.length === 0) {
      throw new EngineError(
        "No strong segments found with these settings. Try a longer target duration or Balanced hook sensitivity.",
        "NO_CLIPS"
      );
    }

    updateJob(jobId, "downloading", 48, "Downloading source video (up to 720p)…");
    await downloadSourceVideo(url, projectId, (pct) => {
      updateJob(jobId, "downloading", 48 + pct * 0.4, `Downloading source video… ${Math.round(pct)}%`);
    });

    const project: Project = {
      id: projectId,
      video: { ...info, language: language || info.language },
      settings,
      clips,
      createdAt: Date.now(),
      transcriptSource: source,
    };
    saveProject(project);
    updateJob(jobId, "done", 100, `Found ${clips.length} viral-ready clips`, { projectId });
  } catch (err) {
    const message =
      err instanceof EngineError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
    const friendly = /429|Too Many Requests/i.test(message)
      ? "YouTube is rate-limiting requests right now. Wait a minute and try again."
      : /Sign in|age-restricted|private/i.test(message)
        ? "This video is private or age-restricted and cannot be accessed."
        : message;
    updateJob(jobId, "error", 0, friendly, { error: friendly });
  }
}

export async function POST(req: NextRequest) {
  const bins = checkBinaries();
  if (!bins.ytdlp || !bins.ffmpeg) {
    return NextResponse.json(
      { error: "Engine binaries missing. Run the setup script to install yt-dlp and ffmpeg into bin/." },
      { status: 503 }
    );
  }
  let body: { url?: string; settings?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const url = (body.url || "").trim();
  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { error: "Invalid YouTube URL. Paste a link like https://youtube.com/watch?v=…" },
      { status: 400 }
    );
  }
  if (!validSettings(body.settings)) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }
  const jobId = randomUUID();
  createJob(jobId);
  void runPipeline(jobId, `https://www.youtube.com/watch?v=${videoId}`, body.settings);
  return NextResponse.json({ jobId });
}