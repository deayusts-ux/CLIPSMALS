import { NextResponse } from "next/server";
import { checkBinaries } from "@/lib/engine";

export const runtime = "nodejs";

export async function GET() {
  const bins = checkBinaries();
  return NextResponse.json({
    ready: bins.ytdlp && bins.ffmpeg,
    binaries: bins,
  });
}