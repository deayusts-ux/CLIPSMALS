import type { AspectRatio, CaptionTemplate, TranscriptCue } from "./types";
import {
  isStudioKeyword,
  studioBanner,
  studioCaptionLines,
  studioCards,
  studioTagline,
  studioVisibleChunks,
} from "./studio";

function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${r.toFixed(2).padStart(5, "0")}`;
}

function escapeAss(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

const DIMS: Record<AspectRatio, { w: number; h: number }> = {
  "9:16": { w: 720, h: 1280 },
  "1:1": { w: 720, h: 720 },
  "16:9": { w: 1280, h: 720 },
};

interface StyleSpec {
  font: string;
  size: number;
  primary: string;
  outlineColor: string;
  back: string;
  bold: boolean;
  outline: number;
  shadow: number;
  marginV: number;
  borderStyle: 1 | 3;
}

const STYLES: Record<CaptionTemplate, StyleSpec> = {
  hormozi: {
    font: "Arial Black",
    size: 58,
    primary: "&H00FFFFFF",
    outlineColor: "&H00000000",
    back: "&H80000000",
    bold: true,
    outline: 5,
    shadow: 2,
    marginV: 260,
    borderStyle: 1,
  },
  beast: {
    font: "Arial Black",
    size: 72,
    primary: "&H00FFFFFF",
    outlineColor: "&H00000000",
    back: "&H80000000",
    bold: true,
    outline: 6,
    shadow: 3,
    marginV: 300,
    borderStyle: 1,
  },
  minimal: {
    font: "Arial",
    size: 40,
    primary: "&H00FFFFFF",
    outlineColor: "&H00000000",
    back: "&H90000000",
    bold: false,
    outline: 0,
    shadow: 0,
    marginV: 180,
    borderStyle: 3,
  },
  cyber: {
    font: "Arial Black",
    size: 52,
    primary: "&H00FFFF00",
    outlineColor: "&H00FF00FF",
    back: "&H80000000",
    bold: true,
    outline: 3,
    shadow: 0,
    marginV: 260,
    borderStyle: 1,
  },
  studio: {
    font: "Arial",
    size: 55,
    primary: "&H00FFFFFF",
    outlineColor: "&H00000000",
    back: "&H60000000",
    bold: true,
    outline: 2,
    shadow: 2,
    marginV: 346,
    borderStyle: 1,
  },
  cinematic: {
    font: "Arial Black",
    size: 62,
    primary: "&H00FFFFFF",
    outlineColor: "&H00000000",
    back: "&H90000000",
    bold: true,
    outline: 1.5,
    shadow: 3,
    marginV: 280,
    borderStyle: 1,
  },
  explainer: {
    font: "Arial",
    size: 48,
    primary: "&H00FFFFFF",
    outlineColor: "&H00000000",
    back: "&H90000000",
    bold: true,
    outline: 2,
    shadow: 2,
    marginV: 220,
    borderStyle: 1,
  },
  editorial: {
    font: "Georgia",
    size: 48,
    primary: "&H00FFFFFF",
    outlineColor: "&H00000000",
    back: "&H80000000",
    bold: false,
    outline: 1,
    shadow: 2,
    marginV: 210,
    borderStyle: 1,
  },
};

export const HIGHLIGHT_WORDS = new Set([
  "secret", "rahasia", "free", "gratis", "million", "juta", "billion", "miliar",
  "never", "jangan", "stop", "best", "terbaik", "worst", "terburuk", "biggest",
  "paling", "crazy", "gila", "insane", "amazing", "keren", "you", "kamu", "anda",
  "money", "uang", "cash", "profit", "success", "sukses", "win", "menang",
  "lose", "kalah", "fail", "gagal", "mistake", "kesalahan", "truth", "fakta",
]);

export function isHighlight(word: string): boolean {
  return HIGHLIGHT_WORDS.has(word.toLowerCase().replace(/[^a-z]/g, "")) || /\d/.test(word);
}

export function chunkWords(
  cues: TranscriptCue[],
  maxWords: number,
  maxChars: number
): { start: number; end: number; words: { text: string; start: number; end: number }[] }[] {
  const all = cues.flatMap((c) => c.words);
  const chunks: { start: number; end: number; words: typeof all }[] = [];
  let cur: typeof all = [];
  for (const w of all) {
    const chars = cur.reduce((a, x) => a + x.text.length + 1, 0);
    if (cur.length >= maxWords || chars + w.text.length > maxChars) {
      if (cur.length) chunks.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) chunks.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    chunks[i].end = next ? Math.min(chunks[i].end + 0.08, next.start) : chunks[i].end + 0.15;
    if (chunks[i].end <= chunks[i].start) chunks[i].end = chunks[i].start + 0.15;
  }
  return chunks;
}

export function buildAss(
  cues: TranscriptCue[],
  template: CaptionTemplate,
  ratio: AspectRatio,
  clipDuration: number,
  title?: string
): string {
  const { w, h } = DIMS[ratio];
  const st = STYLES[template];
  const scale = ratio === "16:9" ? 0.72 : ratio === "1:1" ? 0.8 : 1;
  const fontSize =
    template === "studio" ? Math.round(h * 0.043) : Math.round(st.size * scale);
  const marginV =
    template === "studio" ? Math.round(h * 0.27) : Math.round(st.marginV * (h / 1280));
  const align = template === "studio" ? 1 : 2;
  const marginL = template === "studio" ? Math.round(w * 0.06) : 40;

  let extraStyles = "";
  if (template === "studio") {
    extraStyles = `Style: Banner,Arial,${Math.round(h * 0.033)},&H00FFFFFF,&H0000FFFF,&H002D26E8,&H002D26E8,-1,0,0,0,100,100,0,0,3,5,0,8,0,0,0,1
Style: Tag,Georgia,${Math.round(h * 0.03)},&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,0,-1,0,0,100,100,0,0,1,2,1,8,0,0,0,1
Style: CardL,Arial,${Math.round(h * 0.03)},&H00333333,&H0000FFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: CardD,Arial,${Math.round(h * 0.03)},&H00EEEEEE,&H0000FFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
`;
  } else if (template === "explainer") {
    extraStyles = `Style: RedBadge,Arial,${Math.round(h * 0.032)},&H00FFFFFF,&H0000FFFF,&H002626DC,&H002626DC,-1,0,0,0,100,100,0,0,3,7,0,8,0,0,0,1
`;
  }

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${st.font},${fontSize},${st.primary},&H0000FFFF,${st.outlineColor},${st.back},${st.bold ? -1 : 0},0,0,0,100,100,0,0,${st.borderStyle},${st.outline},${st.shadow},${align},${marginL},40,${marginV},1
${extraStyles}
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events: string[] = [];
  const push = (start: number, end: number, text: string, style = "Default", layer = 0) => {
    const s = Math.max(0, Math.min(start, clipDuration));
    const e = Math.max(s + 0.05, Math.min(end, clipDuration + 0.2));
    events.push(`Dialogue: ${layer},${assTime(s)},${assTime(e)},${style},,0,0,0,,${text}`);
  };

  if (template === "hormozi") {
    for (const chunk of chunkWords(cues, 3, 24)) {
      for (let i = 0; i < chunk.words.length; i++) {
        const w = chunk.words[i];
        const end = i + 1 < chunk.words.length ? chunk.words[i + 1].start : chunk.end;
        const parts = chunk.words.map((cw, ci) => {
          const active = ci === i;
          const color = active ? "\\c&H00F5FF&" : isHighlight(cw.text) ? "\\c&H00D7FF&" : "\\c&HFFFFFF&";
          const anim = active ? "\\t(0,90,\\fscx118\\fscy118)\\t(90,180,\\fscx100\\fscy100)" : "";
          return `{${color}${anim}}${escapeAss(cw.text.toUpperCase())}{\\r}`;
        });
        push(w.start, end, parts.join(" "));
      }
    }
  } else if (template === "beast") {
    for (const chunk of chunkWords(cues, 2, 18)) {
      for (let i = 0; i < chunk.words.length; i++) {
        const w = chunk.words[i];
        const end = i + 1 < chunk.words.length ? chunk.words[i + 1].start : chunk.end;
        const color = isHighlight(w.text) ? "\\c&H0000FF&" : "\\c&HFFFFFF&";
        push(
          w.start,
          end,
          `{\\fscx60\\fscy60\\t(0,110,\\fscx112\\fscy112)\\t(110,200,\\fscx100\\fscy100)${color}}${escapeAss(w.text.toUpperCase())}`
        );
      }
    }
  } else if (template === "minimal") {
    for (const chunk of chunkWords(cues, 9, 64)) {
      const text = chunk.words.map((w) => escapeAss(w.text)).join(" ");
      push(chunk.start, chunk.end, `{\\fad(160,120)}${text}`);
    }
  } else if (template === "cinematic") {
    // 2-tier stacked storyteller typography
    for (const chunk of chunkWords(cues, 3, 22)) {
      if (chunk.words.length <= 1) {
        const w = chunk.words[0];
        if (w) {
          push(
            chunk.start,
            chunk.end,
            `{\\fs${Math.round(fontSize * 1.15)}\\b1}${escapeAss(w.text.toLowerCase())}`
          );
        }
      } else {
        const topWord = chunk.words[0].text.toLowerCase();
        const bottomWords = chunk.words.slice(1).map((w) => w.text.toLowerCase()).join(" ");
        push(
          chunk.start,
          chunk.end,
          `{\\fs${Math.round(fontSize * 0.65)}\\b0}${escapeAss(topWord)}\\N{\\fs${Math.round(fontSize * 1.2)}\\b1}${escapeAss(bottomWords)}`
        );
      }
    }
  } else if (template === "explainer") {
    // Red Topic Badge at top
    const firstSpeechStart = cues[0]?.words[0]?.start ?? cues[0]?.start ?? 0;
    const badgeText = (title || cues[0]?.text || "EXPLAINER")
      .toUpperCase()
      .split(/\s+/)
      .slice(0, 4)
      .join(" ");
    push(
      firstSpeechStart,
      clipDuration,
      `{\\an8\\pos(${w / 2},${Math.round(h * 0.16)})}${escapeAss(badgeText)}`,
      "RedBadge",
      2
    );

    // Clean educational subtitle sentences below
    for (const chunk of chunkWords(cues, 6, 42)) {
      const text = chunk.words.map((w) => escapeAss(w.text)).join(" ");
      push(chunk.start, chunk.end, `"${text}"`);
    }
  } else if (template === "editorial") {
    // Georgia serif talkshow/podcast caption
    const isLandscape = ratio === "16:9";
    for (const chunk of chunkWords(cues, 3, 22)) {
      const text = chunk.words.map((w) => escapeAss(w.text.toLowerCase())).join(" ");
      if (isLandscape) {
        push(
          chunk.start,
          chunk.end,
          `{\\an6\\pos(${Math.round(w * 0.86)},${Math.round(h * 0.5)})\\fs${Math.round(fontSize * 1.05)}}${text}`
        );
      } else {
        push(chunk.start, chunk.end, `{\\fs${fontSize}}${text}`);
      }
    }
  } else if (template === "studio") {
    const firstSpeechStart = cues[0]?.words[0]?.start ?? cues[0]?.start ?? 0;
    const bannerStart = Math.max(0, firstSpeechStart);
    const bannerEnd = Math.min(bannerStart + 4.5, clipDuration);
    const bFs = Math.round(h * 0.033);
    const banner = studioBanner(title || cues[0]?.text || "Clip");
    banner.forEach((ln, i) => {
      push(
        bannerStart,
        bannerEnd,
        `{\\an8\\pos(${w / 2},${Math.round(h * 0.11 + i * bFs * 1.35)})}${escapeAss(ln)}`,
        "Banner",
        1
      );
    });
    const tagline = studioTagline(cues);
    if (tagline) {
      push(
        bannerStart,
        bannerEnd,
        `{\\an8\\pos(${w / 2},${Math.round(h * 0.11 + banner.length * bFs * 1.35 + h * 0.012)})}${escapeAss(tagline)}`,
        "Tag",
        1
      );
    }
    for (const chunk of studioVisibleChunks(cues, title || cues[0]?.text || "Clip")) {
      const capLines = studioCaptionLines(chunk.text);
      push(chunk.start, chunk.end, capLines.map((l) => escapeAss(l)).join("\\N"));
    }
    const cFs = Math.round(h * 0.03);
    const lineH = cFs * 1.5;
    for (const card of studioCards(cues)) {
      const light = card.theme === "light";
      const fill = light ? "&H00E1E4E6&" : "&H000A0A0A&";
      const base = light ? "&H00333333&" : "&H00EEEEEE&";
      push(
        card.start,
        card.end,
        `{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\fad(120,120)\\c${fill}}m 0 0 l ${w} 0 ${w} ${h} 0 ${h}`,
        "Default",
        5
      );
      card.lines.forEach((ln, li) => {
        const y = Math.round(h / 2 + (li - (card.lines.length - 1) / 2) * lineH);
        const parts = ln.split(" ").map((word) => {
          const esc = escapeAss(word);
          return isStudioKeyword(word)
            ? `{\\b1\\c${light ? "&H002D26E8&" : "&H00FFFFFF&"}}${esc}{\\b0\\c${base}}`
            : esc;
        });
        push(
          card.start,
          card.end,
          `{\\an5\\pos(${w / 2},${y})\\fad(120,120)\\c${base}}${parts.join(" ")}`,
          light ? "CardL" : "CardD",
          6
        );
      });
      const rw = Math.round(w * 0.16);
      const rh = Math.max(4, Math.round(h * 0.006));
      const ry = Math.round(h / 2 + (card.lines.length / 2) * lineH + h * 0.02);
      push(
        card.start,
        card.end,
        `{\\an7\\pos(${Math.round((w - rw) / 2)},${ry})\\p1\\bord0\\shad0\\fad(120,120)\\c&H002D26E8&}m 0 0 l ${rw} 0 ${rw} ${rh} 0 ${rh}`,
        "Default",
        6
      );
    }
  } else {
    for (const chunk of chunkWords(cues, 4, 30)) {
      for (let i = 0; i < chunk.words.length; i++) {
        const w = chunk.words[i];
        const end = i + 1 < chunk.words.length ? chunk.words[i + 1].start : chunk.end;
        const parts = chunk.words.map((cw, ci) => {
          const color = ci <= i ? "\\c&HFFFF00&" : "\\c&H666688&";
          const glow = ci === i ? "\\blur3\\bord4" : "\\blur0\\bord2";
          return `{${color}${glow}}${escapeAss(cw.text.toUpperCase())}{\\r}`;
        });
        push(w.start, end, parts.join(" "));
      }
    }
  }

  return header + events.join("\n") + "\n";
}

export function buildSrt(cues: TranscriptCue[]): string {
  const fmt = (sec: number) => {
    const s = Math.max(0, sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = Math.floor(s % 60);
    const ms = Math.round((s % 1) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };
  return (
    cues
      .map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`)
      .join("\n") + "\n"
  );
}
