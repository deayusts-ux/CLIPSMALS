import { NextResponse } from "next/server";
import { listProjects } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const projects = listProjects().map((p) => ({
    id: p.id,
    video: p.video,
    settings: p.settings,
    clipCount: p.clips.length,
    topScore: p.clips.length ? Math.max(...p.clips.map((c) => c.score)) : 0,
    createdAt: p.createdAt,
  }));
  return NextResponse.json({ projects });
}