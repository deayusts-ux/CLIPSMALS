import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR, sanitizeId } from "@/lib/paths";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".ass": "text/plain; charset=utf-8",
  ".srt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params;
  if (!parts || parts.length < 2) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }
  const projectId = sanitizeId(parts[0]);
  const fileName = parts.slice(1).join("/");
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    return NextResponse.json({ error: "Bad filename" }, { status: 400 });
  }
  const file = path.join(MEDIA_DIR, projectId, fileName);
  if (!file.startsWith(path.join(MEDIA_DIR, projectId) + path.sep)) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const stat = fs.statSync(file);
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const range = req.headers.get("range");

  if (range && ext === ".mp4") {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      const start = m[1] ? parseInt(m[1]) : 0;
      const end = m[2] ? parseInt(m[2]) : stat.size - 1;
      if (start >= stat.size || end >= stat.size) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
      }
      const stream = fs.createReadStream(file, { start, end });
      return new NextResponse(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
          "Content-Type": mime,
        },
      });
    }
  }

  const stream = fs.createReadStream(file);
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Content-Length": String(stat.size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  };
  if (req.nextUrl.searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="${fileName}"`;
  }
  return new NextResponse(stream as unknown as ReadableStream, { headers });
}