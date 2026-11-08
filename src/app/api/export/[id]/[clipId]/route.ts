import { NextRequest, NextResponse } from "next/server";
import { loadProject } from "@/lib/store";
import { sanitizeId } from "@/lib/paths";
import { buildSrt } from "@/lib/captions";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const { id, clipId } = await params;
  const project = loadProject(sanitizeId(id));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const clip = project.clips.find((c) => c.id === sanitizeId(clipId));
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  const srt = buildSrt(clip.cues);
  const safeName = clip.title.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 60).trim() || clip.id;
  return new NextResponse(srt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.srt"`,
    },
  });
}