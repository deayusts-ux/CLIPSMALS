import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { loadProject, saveProject } from "@/lib/store";
import { projectDir, sanitizeId } from "@/lib/paths";
import { cropFilter, probeDimensions, renderClip, EngineError } from "@/lib/engine";
import { buildAss } from "@/lib/captions";
import type { AspectRatio, CaptionTemplate } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const { id, clipId } = await params;
  const project = loadProject(sanitizeId(id));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const clip = project.clips.find((c) => c.id === sanitizeId(clipId));
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  let body: { template?: CaptionTemplate; ratio?: AspectRatio; burnCaptions?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const template: CaptionTemplate = ["hormozi", "beast", "minimal", "cyber", "studio", "cinematic", "explainer", "editorial"].includes(body.template || "")
    ? (body.template as CaptionTemplate)
    : project.settings.template;
  const ratio: AspectRatio = ["9:16", "1:1", "16:9"].includes(body.ratio || "")
    ? (body.ratio as AspectRatio)
    : project.settings.ratio;
  const burnCaptions = body.burnCaptions !== false;

  const dir = projectDir(project.id);
  const source = path.join(dir, "source.mp4");
  if (!fs.existsSync(source)) {
    return NextResponse.json(
      { error: "Source video file missing on disk. Generate the project again." },
      { status: 409 }
    );
  }

  try {
    const { width, height } = await probeDimensions(source);
    let vf = cropFilter(ratio, width, height);
    if (template === "studio" || template === "explainer") {
      // Vignette only: no erratic zoompan, frame stays completely stable
      vf += `,vignette=PI/5`;
    }
    const tag = `${clip.id}-${template}-${ratio.replace(":", "x")}${burnCaptions ? "-sub" : ""}`;
    const outFile = path.join(dir, `${tag}.mp4`);
    let assFile: string | undefined;
    if (burnCaptions && clip.cues.length > 0) {
      assFile = path.join(dir, `${tag}.ass`);
      fs.writeFileSync(
        assFile,
        buildAss(clip.cues, template, ratio, clip.end - clip.start, clip.title),
        "utf8"
      );
    }
    await renderClip({
      sourceFile: source,
      outFile,
      start: clip.start,
      end: clip.end,
      videoFilter: vf,
      assFile,
    });
    clip.renderedUrl = `/api/media/${project.id}/${tag}.mp4`;
    clip.renderedTemplate = template;
    clip.renderedRatio = ratio;
    saveProject(project);
    return NextResponse.json({ ok: true, url: clip.renderedUrl, clip });
  } catch (err) {
    const message = err instanceof EngineError ? err.message : err instanceof Error ? err.message : "Render failed";
    console.error("[render] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
