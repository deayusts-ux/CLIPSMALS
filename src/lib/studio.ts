import type { TranscriptCue } from "./types";

export const STUDIO_RED = "#E8262D";
export const STUDIO_CYCLE = 3.2;
export const STUDIO_PUNCH = 0.08;
export const STUDIO_BANNER_END = 4.5;

const STUDIO_KEYWORDS = new Set([
  "rahasia", "secret", "jangan", "never", "mulai", "mulailah", "start", "cepat",
  "tercepat", "fast", "gratis", "free", "uang", "money", "skill", "fokus", "focus",
  "berkarya", "kerja", "bisnis", "hasil", "sukses", "success", "gagal", "fail",
  "bukan", "not", "sekarang", "now", "hari", "day", "cara", "how", "teknik",
  "rsa", "iq", "knowledge", "ilmu", "belajar", "learn", "tunggu", "wait", "stop",
  "berhenti", "paling", "best", "terbaik", "juta", "million", "miliar", "billion",
  "kamu", "you", "anda", "fakta", "truth", "kesalahan", "mistake",
]);

export function isStudioKeyword(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  return STUDIO_KEYWORDS.has(clean) || /\d/.test(clean);
}

export function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && cur.length + 1 + w.length > maxChars) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function studioBanner(title: string): string[] {
  const wrapped = wrapLines(title.toUpperCase(), 24);
  return wrapped.length <= 2
    ? wrapped
    : [wrapped[0], wrapped.slice(1).join(" ").slice(0, 28).trimEnd() + "…"];
}

export function studioTagline(cues: TranscriptCue[]): string {
  const text = cues[1]?.text || cues[0]?.text || "";
  return text.length > 48 ? text.slice(0, 47).trimEnd() + "…" : text;
}

export function studioVisibleChunks(
  cues: TranscriptCue[],
  title: string
): { start: number; end: number; text: string }[] {
  const titleLower = title.toLowerCase();
  return studioCaptionChunks(cues, 6, 40).filter(
    (c) => !(c.start < STUDIO_BANNER_END && titleLower.startsWith(c.text.toLowerCase()))
  );
}

export interface StudioCard {
  start: number;
  end: number;
  cueIndex: number;
  theme: "light" | "dark";
  lines: string[];
}

export function studioCards(cues: TranscriptCue[]): StudioCard[] {
  const cards: StudioCard[] = [];
  cues.forEach((c, i) => {
    const text = c.text.trim();
    if (i < 4 || i % 3 !== 1 || c.end - c.start < 1) return;
    if (/^\(.*\)$/.test(text) || text.length < 14) return;
    cards.push({
      start: c.start,
      end: Math.min(c.start + 1.7, c.end),
      cueIndex: i,
      theme: cards.length % 2 === 0 ? "light" : "dark",
      lines: wrapLines(c.text, 26).slice(0, 3),
    });
  });
  return cards;
}

export function studioCaptionLines(text: string): string[] {
  const lines = wrapLines(text, 22).slice(0, 2);
  while (
    lines.length === 2 &&
    lines[0].length - lines[1].length > 10 &&
    lines[0].includes(" ")
  ) {
    const idx = lines[0].lastIndexOf(" ");
    const word = lines[0].slice(idx + 1);
    lines[0] = lines[0].slice(0, idx);
    lines[1] = `${word} ${lines[1]}`;
  }
  return lines;
}

export function studioZoom(time: number): number {
  const t = Math.max(0, time) % STUDIO_CYCLE;
  return 1 + STUDIO_PUNCH * Math.min(1, t / 0.15);
}

const DEMO_LINES: [string, number, number][] = [
  ["The fastest way to learn a new skill", 0, 2.2],
  ["is not talent", 2.2, 3.4],
  ["it is a system called RSA", 3.4, 5.2],
  ["Rapid Skill Acquisition", 5.2, 6.6],
  ["stop waiting until you are ready", 6.6, 8.6],
  ["start creating before you feel expert", 8.6, 10.8],
  ["because the world changes fast", 10.8, 12.6],
  ["and sharing your knowledge wins", 12.6, 14.4],
];

export const STUDIO_DEMO: TranscriptCue[] = DEMO_LINES.map(([text, start, end]) => {
  const tokens = text.split(" ");
  const step = (end - start) / tokens.length;
  return {
    start,
    end,
    text,
    words: tokens.map((t, i) => ({
      text: t,
      start: start + i * step,
      end: start + (i + 1) * step,
    })),
  };
});

export function studioCaptionChunks(
  cues: TranscriptCue[],
  maxWords: number,
  maxChars: number
): { start: number; end: number; text: string }[] {
  const all = cues.flatMap((c) => c.words);
  const chunks: { start: number; end: number; text: string }[] = [];
  let cur: typeof all = [];
  const flush = () => {
    if (!cur.length) return;
    chunks.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.text).join(" "),
    });
    cur = [];
  };
  for (const w of all) {
    const chars = cur.reduce((a, x) => a + x.text.length + 1, 0);
    if (cur.length >= maxWords || chars + w.text.length > maxChars) flush();
    cur.push(w);
  }
  flush();
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    chunks[i].end = next ? Math.min(chunks[i].end + 0.08, next.start) : chunks[i].end + 0.15;
    if (chunks[i].end <= chunks[i].start) chunks[i].end = chunks[i].start + 0.15;
  }
  return chunks;
}