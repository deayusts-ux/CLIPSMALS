import type {
  ClipSegment,
  DurationPreset,
  HookSensitivity,
  TranscriptCue,
} from "./types";
import { DURATION_RANGES } from "./types";

const HOOK_PATTERNS: { re: RegExp; weight: number; reason: string }[] = [
  // Curiosity & Intrigue
  {
    re: /\b(secret|rahasia|nobody|no one|tidak ada yang|jarang ada|tersembunyi|kebanyakan orang|most people|the reason why|alasannya adalah|tahu gak|sadar gak)\b/i,
    weight: 18,
    reason: "Curiosity-gap phrasing opens strong intrigue",
  },
  // Pattern Interrupt & Warnings
  {
    re: /\b(stop|jangan|jangan pernah|never|mistake|kesalahan terbesar|bahaya|salah besar|don't|hancur|rugi|fatal|warning)\b/i,
    weight: 17,
    reason: "Pattern-interrupt warning stops scrolling",
  },
  // Bold / Contrarian Claims
  {
    re: /\b(bukan|bukan karena|not because|the truth is|faktanya|sebenarnya|ternyata|kebohongan|myth|mitos|bullshit|bohong|realita)\b/i,
    weight: 16,
    reason: "Contrarian reveal challenges common assumptions",
  },
  // Direct Questions (Why, How, What if)
  {
    re: /\b(kenapa|mengapa|gimana|bagaimana cara|how to|why do|what happens|gimana kalau|seandainya)\b/i,
    weight: 15,
    reason: "Direct question engages the viewer's brain",
  },
  { re: /\?/, weight: 14, reason: "Question mark signals curiosity" },
  // Big Numbers & High Stakes
  {
    re: /\b(million|billion|thousand|juta|miliar|ribu|\$|rp|10x|100%|nol sampai|zero to)\b/i,
    weight: 14,
    reason: "Big numbers establish high-stakes value",
  },
  // Actionable Frameworks & Steps
  {
    re: /\b(kuncinya|caranya|rumusnya|formulanya|langkah|step by step|tips|trik|rules|aturan)\b/i,
    weight: 13,
    reason: "Actionable how-to advice promises fast learning",
  },
  // Superlatives & Extremes
  {
    re: /\b(terbaik|terburuk|paling|nomor\s?1|number one|best|worst|biggest|fastest|tercepat|mudah banget)\b/i,
    weight: 12,
    reason: "Superlative claim commands authority",
  },
  // Imagination Triggers
  {
    re: /\b(bayangkan|imagine|coba pikirkan|misalkan|what if)\b/i,
    weight: 12,
    reason: "Imagination trigger paints a vivid mental picture",
  },
  // Emotional Shock Words
  {
    re: /\b(crazy|insane|gila|mind.?blown|shocking|mengejutkan|luar biasa|gokil|parah|merinding)\b/i,
    weight: 12,
    reason: "High-emotion phrasing sparks viewer excitement",
  },
  // Storytelling & Narrative Openers
  {
    re: /\b(story|cerita|experience|pengalaman|kejadian|waktu itu|first time|pertama kali)\b/i,
    weight: 10,
    reason: "Story opener hooks narrative empathy",
  },
  // Direct Audience Address
  {
    re: /\b(kamu|anda|kalian|kau|you|your|buat kamu|kalau kamu)\b/i,
    weight: 8,
    reason: "Direct viewer address creates personal relevance",
  },
  // Value Promise
  {
    re: /\b(free|gratis|bonus|hadiah|giveaway|untung|cuan)\b/i,
    weight: 8,
    reason: "Value promise attracts immediate interest",
  },
  { re: /\d+%/, weight: 9, reason: "Specific statistic anchors credibility" },
];

const ENERGY_WORDS =
  /\b(love|cinta|hate|benci|amazing|fantastic|incredible|awesome|gokil|keren|mantap|wow|whoa|damn|beneran|sumpah|serius|seriously|banget|sekali|extremely|super|hyper|total|completely|sepenuhnya|benar-benar|brilliant|genius)\b/gi;

const FILLER_WORDS =
  /\b(um|uh|erm|like|you know|ya kan|gitu|anu|emm|hmm|okay|ok|so|jadi|terus|then|and|dan|yang|itu|ini)\b/gi;

const DANGLING_START_WORDS = new Set([
  "and", "or", "but", "so", "because", "that", "which", "then", "also",
  "dan", "atau", "tapi", "tetapi", "karena", "sebab", "jadi", "bahwa", "yang", "terus", "lalu", "juga", "sehingga",
]);

const DANGLING_END_WORDS = new Set([
  "and", "or", "but", "so", "because", "that", "which", "with", "to", "for", "in", "of", "on", "at",
  "dan", "atau", "tapi", "tetapi", "karena", "sebab", "jadi", "bahwa", "yang", "dengan", "untuk", "pada", "di", "ke", "dari", "seperti", "kalau", "jika",
]);

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

function isCleanSentenceEnd(text: string): boolean {
  const trimmed = text.trim();
  if (/[.!?…]["')\]]*$/.test(trimmed)) return true;
  if (/[,;:-]$/.test(trimmed)) return false;
  const lastWord = (trimmed.split(/\s+/).pop() || "").toLowerCase().replace(/[^a-z]/g, "");
  return !DANGLING_END_WORDS.has(lastWord);
}

function isCleanSentenceStart(cues: TranscriptCue[], index: number): boolean {
  if (index === 0) return true;
  const current = cues[index].text.trim();
  const prev = cues[index - 1];

  // Natural pause before this cue: strong indicator of new sentence
  const pause = cues[index].start - prev.end;
  if (pause >= 0.35) return true;

  // Previous cue ended with punctuation
  if (/[.!?…]["')\]]*$/.test(prev.text.trim())) return true;

  // Check if first word is a dangling connector
  const firstWord = (current.split(/\s+/)[0] || "").toLowerCase().replace(/[^a-z]/g, "");
  if (DANGLING_START_WORDS.has(firstWord)) return false;

  return /^[A-Z]/.test(current);
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
  let score = 32;

  // Hook zone: first 8 seconds or 30% of clip
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
  if (hookHits === 0) score -= 10;

  // Emotional Energy
  const energy = countMatches(text, ENERGY_WORDS);
  const energyDensity = energy / words.length;
  score += Math.min(14, energyDensity * 240);
  if (energyDensity > 0.03) reasons.push("High emotional delivery");

  // Speaking Pace (ideal: 2.0 to 3.5 words per second)
  const wps = words.length / duration;
  if (wps >= 2.0 && wps <= 3.6) {
    score += 10;
    reasons.push("Punchy speaking pace");
  } else if (wps < 1.3) {
    score -= 12;
  } else if (wps > 4.5) {
    score -= 6;
  }

  // Filler Word Penalty
  const fillers = countMatches(text.toLowerCase(), FILLER_WORDS);
  const fillerRatio = fillers / words.length;
  if (fillerRatio > 0.28) score -= 10;
  else if (fillerRatio < 0.12) score += 5;

  // Clean Start Bonus: HUGE bonus for starting naturally, never mid-sentence!
  if (isCleanSentenceStart(cues, from)) {
    score += 14;
    reasons.push("Clean sentence beginning");
  } else {
    score -= 16;
  }

  // Clean Ending Bonus: HUGE bonus for ending on a full thought, never mid-thought!
  const lastCueText = slice[slice.length - 1].text;
  if (isCleanSentenceEnd(lastCueText)) {
    score += 16;
    reasons.push("Complete conclusive ending");
  } else {
    score -= 18;
  }

  // Vocabulary Diversity
  const uniqueRatio = new Set(words.map((w) => w.toLowerCase())).size / words.length;
  if (uniqueRatio > 0.62) score += 6;

  // Silent Gap Penalty (> 3.5s of dead air)
  const gapPenalty = slice.some((c, i) => i > 0 && c.start - slice[i - 1].end > 3.5);
  if (gapPenalty) score -= 10;

  // Sensitivity adjustments
  if (sensitivity === "aggressive") {
    score += hookHits * 4;
  } else if (sensitivity === "context") {
    if (isCleanSentenceEnd(lastCueText)) score += 10;
    const sentences = countMatches(text, /[.!?]/g);
    if (sentences >= 3) score += 8;
  }

  return {
    score: Math.max(1, Math.min(99, Math.round(score))),
    reasons: [...new Set(reasons)].slice(0, 4),
  };
}

function makeTitle(hookText: string): string {
  let t = hookText.replace(/\s+/g, " ").trim();
  const sentenceMatch = t.match(/^.*?[.!?](?:\s|$)/);
  if (sentenceMatch && sentenceMatch[0].length >= 18) t = sentenceMatch[0];
  if (t.length > 70) {
    const cut = t.slice(0, 70);
    const lastSpace = cut.lastIndexOf(" ");
    t = cut.slice(0, lastSpace > 35 ? lastSpace : 70) + "…";
  }
  t = t.replace(/^[\s,.!?-]+/, "").replace(/[,;:-]+$/, "");
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
  const step = Math.max(1, Math.floor(cues.length / 500));

  for (let i = 0; i < cues.length; i += step) {
    // If cue i starts in the middle of a sentence, try nudging back or forward to a clean start
    let startIdx = i;
    if (!isCleanSentenceStart(cues, startIdx)) {
      if (startIdx > 0 && isCleanSentenceStart(cues, startIdx - 1)) {
        startIdx = startIdx - 1;
      } else if (startIdx + 1 < cues.length && isCleanSentenceStart(cues, startIdx + 1)) {
        startIdx = startIdx + 1;
      }
    }

    const start = cues[startIdx].start;
    let bestJ = -1;
    let bestBoundaryBonus = -999;

    let j = startIdx;
    while (j < cues.length && cues[j].end - start <= effectiveMax) {
      const dur = cues[j].end - start;
      if (dur >= effectiveMin) {
        const isEndClean = isCleanSentenceEnd(cues[j].text);
        const nextGap = j + 1 < cues.length ? cues[j + 1].start - cues[j].end : 1;
        const pauseBonus = nextGap >= 0.4 ? 6 : 0;
        const boundary = isEndClean ? 18 + pauseBonus : -15;

        // Ideal mid-point duration preference curve
        const midDuration = (effectiveMin + effectiveMax) / 2;
        const midPreference = 4 * (1 - Math.abs(dur - midDuration) / (effectiveMax - effectiveMin));

        const totalBonus = boundary + midPreference;
        if (totalBonus > bestBoundaryBonus) {
          bestBoundaryBonus = totalBonus;
          bestJ = j;
        }
      }
      j++;
    }

    if (bestJ === -1) continue;

    const { score, reasons } = scoreWindow(cues, startIdx, bestJ, sensitivity);
    if (score < 40) continue;

    const slice = cues.slice(startIdx, bestJ + 1);
    const hookText = slice
      .filter((c) => c.start < start + 8)
      .map((c) => c.text)
      .join(" ")
      .slice(0, 200);

    candidates.push({
      startCue: startIdx,
      endCue: bestJ,
      start,
      end: cues[bestJ].end,
      score,
      reasons,
      hookText,
      title: makeTitle(hookText || slice[0].text),
    });
  }

  // Sort by highest score first
  candidates.sort((a, b) => b.score - a.score);

  // Avoid heavy overlapping clips
  const selected: Candidate[] = [];
  const maxClips = videoDuration < 90 ? 1 : videoDuration < 600 ? 6 : 10;
  for (const cand of candidates) {
    if (selected.length >= maxClips) break;
    const overlap = selected.some(
      (s) => cand.start < s.end + 2.5 && cand.end > s.start - 2.5
    );
    if (!overlap) selected.push(cand);
  }
  selected.sort((a, b) => b.score - a.score);

  return selected.map((c, idx) => {
    // Intelligent breathing room padding:
    // Lead-in: give 0.25s of silence before first spoken word so first syllable isn't clipped
    const prevEnd = c.startCue > 0 ? cues[c.startCue - 1].end : 0;
    const leadIn = Math.min(0.3, Math.max(0.1, (c.start - prevEnd) / 2));
    const clipStart = Math.max(0, c.start - leadIn);

    // Lead-out: give 0.35s of room after last word so final word resonates naturally
    const nextStart = c.endCue + 1 < cues.length ? cues[c.endCue + 1].start : videoDuration;
    const leadOut = Math.min(0.45, Math.max(0.2, (nextStart - c.end) / 2));
    const clipEnd = Math.min(videoDuration, c.end + leadOut);

    return {
      id: `clip-${idx + 1}`,
      start: clipStart,
      end: clipEnd,
      title: c.title,
      hookText: c.hookText,
      score: c.score,
      reasons: c.reasons,
      // Synchronize cues perfectly to the trimmed clip's zero timestamp!
      cues: cues.slice(c.startCue, c.endCue + 1).map((cue) => {
        const relStart = Math.max(0, cue.start - clipStart);
        const relEnd = Math.max(relStart + 0.1, cue.end - clipStart);
        return {
          ...cue,
          start: relStart,
          end: relEnd,
          words: cue.words.map((w) => {
            const wStart = Math.max(0, w.start - clipStart);
            const wEnd = Math.max(wStart + 0.05, w.end - clipStart);
            return {
              ...w,
              start: wStart,
              end: wEnd,
            };
          }),
        };
      }),
    };
  });
}
