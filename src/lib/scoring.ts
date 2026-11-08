import type {
  ClipSegment,
  DurationPreset,
  HookSensitivity,
  TranscriptCue,
} from "./types";
import { DURATION_RANGES } from "./types";

const HOOK_PATTERNS: { re: RegExp; weight: number; reason: string }[] = [
  { re: /\?/, weight: 14, reason: "Question hook opens curiosity" },
  { re: /\b(secret|rahasia|nobody|no one|tidak ada|jarang|tersembunyi)\b/i, weight: 16, reason: "Curiosity-gap phrasing" },
  { re: /\b(how to|cara|tutorial|langkah|step)\b/i, weight: 12, reason: "Actionable how-to framing" },
  { re: /\b(mistake|kesalahan|salah|wrong|stop|jangan|never|don't)\b/i, weight: 13, reason: "Pattern-interrupt warning" },
  { re: /\b(million|billion|thousand|juta|miliar|ribu|\$|rp)\b/i, weight: 12, reason: "Big-number stakes" },
  { re: /\b(biggest|best|worst|most|least|terbaik|terburuk|paling|nomor\s?1|number one)\b/i, weight: 10, reason: "Superlative claim" },
  { re: /\b(you|kamu|anda|kau|your|milikmu)\b/i, weight: 6, reason: "Direct viewer address" },
  { re: /\b(imagine|bayangkan|what if|gimana kalau|seandainya)\b/i, weight: 11, reason: "Imagination trigger" },
  { re: /\b(but|however|tapi|tetapi|namun|ternyata|actually|sebenarnya)\b/i, weight: 8, reason: "Contrast / twist setup" },
  { re: /\b(free|gratis|gift|bonus|giveaway)\b/i, weight: 8, reason: "Value promise" },
  { re: /\b(crazy|insane|gila|mind.?blown|shocking|mengejutkan|luar biasa)\b/i, weight: 10, reason: "High-emotion language" },
  { re: /\b(story|cerita|experience|pengalaman|kejadian)\b/i, weight: 7, reason: "Narrative framing" },
  { re: /\b(today|hari ini|now|sekarang|right now)\b/i, weight: 4, reason: "Immediacy cue" },
  { re: /\b(why|kenapa|mengapa|alasan)\b/i, weight: 8, reason: "Reason-seeking hook" },
  { re: /\b(truth|fakta|kenyataan|realita|truth is)\b/i, weight: 9, reason: "Reveal framing" },
  { re: /\d+%/, weight: 9, reason: "Statistic anchor" },
  { re: /\b(first|pertama|awal|mulai|start)\b/i, weight: 4, reason: "Listicle opener" },
];

const ENERGY_WORDS =
  /\b(love|cinta| hate|benci|amazing|fantastic|incredible|awesome|gokil|keren|mantap|wow|whoa|whoa|damn|gosh|literally|beneran|sumpah|serius|seriously|literally|literally|banget|sekali|extremely|super|hyper|total|completely|sepenuhnya|benar-benar)\b/gi;

const FILLER_WORDS =
  /\b(um|uh|erm|like|you know|ya kan|gitu|anu|emm|hmm|okay|ok|so|jadi|terus|then|and|dan|yang|itu|ini)\b/gi;

interface Candidate {
  startCue: number;
  endCue: number;
  start: number;
  end: number;
  score: number;
  reasons: string[];
  hookText: string;
  title: string;
}

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

function sentenceEnds(text: string): boolean {
  return /[.!?…]["')\]]*\s*$/.test(text.trim());
}

function scoreWindow(
  cues: TranscriptCue[],
  from: number,
  to: number,
  sensitivity: HookSensitivity
): { score: number; reasons: string[] } {
  const slice = cues.slice(from, to + 1);
  const text = slice.map((c) => c.text).join(" ");
  const words = text.split(/\s+/).filter(Boolean);
  const duration = slice[slice.length - 1].end - slice[0].start;
  if (duration <= 0 || words.length < 8) return { score: 0, reasons: [] };

  const reasons: string[] = [];
  let score = 30;

  const hookZone = slice
    .filter((c) => c.start < slice[0].start + Math.min(8, duration * 0.3))
    .map((c) => c.text)
    .join(" ");
  let hookHits = 0;
  for (const p of HOOK_PATTERNS) {
    if (p.re.test(hookZone)) {
      score += p.weight;
      hookHits++;
      if (reasons.length < 4) reasons.push(p.reason);
    }
  }
  if (hookHits === 0) score -= 8;

  const energy = countMatches(text, ENERGY_WORDS);
  const energyDensity = energy / words.length;
  score += Math.min(14, energyDensity * 220);
  if (energyDensity > 0.03) reasons.push("High emotional energy");

  const wps = words.length / duration;
  if (wps >= 2 && wps <= 3.6) {
    score += 10;
    reasons.push("Punchy speaking pace");
  } else if (wps < 1.2) {
    score -= 12;
  } else if (wps > 4.5) {
    score -= 6;
  }

  const fillers = countMatches(text.toLowerCase(), FILLER_WORDS);
  const fillerRatio = fillers / words.length;
  if (fillerRatio > 0.3) score -= 10;
  else if (fillerRatio < 0.15) score += 4;

  const lastText = slice[slice.length - 1].text;
  if (sentenceEnds(lastText)) {
    score += 10;
    reasons.push("Clean story ending");
  } else {
    score -= 6;
  }
  if (sentenceEnds(slice[0].text) || from === 0) {
    score += 4;
  }

  const uniqueRatio = new Set(words.map((w) => w.toLowerCase())).size / words.length;
  if (uniqueRatio > 0.6) score += 5;

  const gapPenalty = slice.some((c, i) => i > 0 && c.start - slice[i - 1].end > 4);
  if (gapPenalty) score -= 8;

  if (sensitivity === "aggressive") {
    score += hookHits * 3;
  } else if (sensitivity === "context") {
    if (sentenceEnds(lastText)) score += 8;
    const sentences = countMatches(text, /[.!?]/g);
    if (sentences >= 3) score += 6;
  }

  return { score: Math.max(1, Math.min(99, Math.round(score))), reasons: [...new Set(reasons)].slice(0, 4) };
}

function makeTitle(hookText: string): string {
  let t = hookText.replace(/\s+/g, " ").trim();
  const sentenceMatch = t.match(/^.*?[.!?](?:\s|$)/);
  if (sentenceMatch && sentenceMatch[0].length > 20) t = sentenceMatch[0];
  if (t.length > 72) {
    const cut = t.slice(0, 72);
    const lastSpace = cut.lastIndexOf(" ");
    t = cut.slice(0, lastSpace > 40 ? lastSpace : 72) + "…";
  }
  t = t.replace(/^[\s,.!?-]+/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function detectClips(
  cues: TranscriptCue[],
  duration: DurationPreset,
  sensitivity: HookSensitivity,
  videoDuration: number
): Omit<ClipSegment, "renderedUrl" | "renderedTemplate" | "renderedRatio">[] {
  if (cues.length === 0) return [];
  const [minDur, maxDur] = DURATION_RANGES[duration];
  const effectiveMax = Math.min(maxDur, videoDuration);
  const effectiveMin = Math.min(minDur, effectiveMax * 0.6);

  const candidates: Candidate[] = [];
  const step = Math.max(1, Math.floor(cues.length / 400));

  for (let i = 0; i < cues.length; i += step) {
    const start = cues[i].start;
    let j = i;
    let bestJ = -1;
    let bestBoundaryBonus = -1;
    while (j < cues.length && cues[j].end - start <= effectiveMax) {
      const dur = cues[j].end - start;
      if (dur >= effectiveMin) {
        const boundary = sentenceEnds(cues[j].text) ? 2 : 0;
        const midPreference = 1 - Math.abs(dur - (effectiveMin + effectiveMax) / 2) / effectiveMax;
        const bonus = boundary + midPreference;
        if (bonus > bestBoundaryBonus) {
          bestBoundaryBonus = bonus;
          bestJ = j;
        }
      }
      j++;
    }
    if (bestJ === -1) continue;
    const { score, reasons } = scoreWindow(cues, i, bestJ, sensitivity);
    if (score < 35) continue;
    const slice = cues.slice(i, bestJ + 1);
    const hookText = slice
      .filter((c) => c.start < start + 7)
      .map((c) => c.text)
      .join(" ")
      .slice(0, 200);
    candidates.push({
      startCue: i,
      endCue: bestJ,
      start,
      end: cues[bestJ].end,
      score,
      reasons,
      hookText,
      title: makeTitle(hookText || slice[0].text),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected: Candidate[] = [];
  const maxClips = videoDuration < 90 ? 1 : videoDuration < 600 ? 6 : 10;
  for (const cand of candidates) {
    if (selected.length >= maxClips) break;
    const overlap = selected.some(
      (s) => cand.start < s.end + 2 && cand.end > s.start - 2
    );
    if (!overlap) selected.push(cand);
  }
  selected.sort((a, b) => b.score - a.score);

  return selected.map((c, idx) => ({
    id: `clip-${idx + 1}`,
    start: Math.max(0, c.start - 0.15),
    end: Math.min(videoDuration, c.end + 0.25),
    title: c.title,
    hookText: c.hookText,
    score: c.score,
    reasons: c.reasons,
    cues: cues.slice(c.startCue, c.endCue + 1).map((cue) => ({
      ...cue,
      start: cue.start - c.start,
      end: cue.end - c.start,
      words: cue.words.map((w) => ({
        ...w,
        start: Math.max(0, w.start - c.start),
        end: Math.max(0.1, w.end - c.start),
      })),
    })),
  }));
}