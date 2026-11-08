import { NextRequest, NextResponse } from "next/server";
import { loadProject, saveProject, deleteProject } from "@/lib/store";
import { sanitizeId } from "@/lib/paths";
import type { TranscriptCue } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = loadProject(sanitizeId(id));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = loadProject(sanitizeId(id));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  let body: { clipId?: string; cues?: TranscriptCue[]; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const clip = project.clips.find((c) => c.id === body.clipId);
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  if (Array.isArray(body.cues)) {
    const dur = clip.end - clip.start;
    const cleaned: TranscriptCue[] = [];
    for (const cue of body.cues.slice(0, 500)) {
      if (typeof cue?.text !== "string") continue;
      const text = cue.text.slice(0, 300).trim();
      if (!text) continue;
      const start = Math.max(0, Math.min(Number(cue.start) || 0, dur));
      const end = Math.max(start + 0.1, Math.min(Number(cue.end) || start + 1, dur + 0.5));
      const words = text.split(/\s+/).map((tok, i, arr) => {
        const orig = cue.words?.[i];
        const wStart = orig ? Math.max(start, Math.min(orig.start, end)) : start + ((end - start) * i) / arr.length;
        const wEnd = orig ? Math.max(wStart + 0.05, Math.min(orig.end, end)) : start + ((end - start) * (i + 1)) / arr.length;
        return { text: tok, start: wStart, end: wEnd };
      });
      cleaned.push({ start, end, text, words });
    }
    cleaned.sort((a, b) => a.start - b.start);
    clip.cues = cleaned;
    clip.renderedUrl = undefined;
    clip.renderedTemplate = undefined;
    clip.renderedRatio = undefined;
  }
  if (typeof body.title === "string" && body.title.trim()) {
    clip.title = body.title.trim().slice(0, 120);
  }
  saveProject(project);
  return NextResponse.json({ ok: true, clip });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = deleteProject(sanitizeId(id));
  if (!ok) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}