"use client";

import { useEffect, useRef, useState } from "react";
import type { CaptionTemplate, TranscriptCue } from "@/lib/types";
import { chunkWords, isHighlight } from "@/lib/captions";
import {
  STUDIO_BANNER_END,
  STUDIO_RED,
  isStudioKeyword,
  studioBanner,
  studioCaptionLines,
  studioCards,
  studioTagline,
  studioVisibleChunks,
} from "@/lib/studio";

const SAMPLE: TranscriptCue[] = [
  {
    start: 0,
    end: 2.4,
    text: "The secret nobody tells you about success",
    words: [
      { text: "The", start: 0, end: 0.3 },
      { text: "secret", start: 0.3, end: 0.7 },
      { text: "nobody", start: 0.7, end: 1.1 },
      { text: "tells", start: 1.1, end: 1.4 },
      { text: "you", start: 1.4, end: 1.6 },
      { text: "about", start: 1.6, end: 1.9 },
      { text: "success", start: 1.9, end: 2.4 },
    ],
  },
  {
    start: 2.4,
    end: 4.8,
    text: "is that you only need one million focused hours",
    words: [
      { text: "is", start: 2.4, end: 2.6 },
      { text: "that", start: 2.6, end: 2.8 },
      { text: "you", start: 2.8, end: 3.0 },
      { text: "only", start: 3.0, end: 3.3 },
      { text: "need", start: 3.3, end: 3.6 },
      { text: "one", start: 3.6, end: 3.8 },
      { text: "million", start: 3.8, end: 4.2 },
      { text: "focused", start: 4.2, end: 4.5 },
      { text: "hours", start: 4.5, end: 4.8 },
    ],
  },
];

export function CaptionPreview({
  template,
  cues,
  playing = true,
  time: controlledTime,
  title,
  className = "",
}: {
  template: CaptionTemplate;
  cues?: TranscriptCue[];
  playing?: boolean;
  time?: number;
  title?: string;
  className?: string;
}) {
  const data = cues && cues.length > 0 ? cues : SAMPLE;
  const duration = data[data.length - 1]?.end ?? 5;
  const [innerTime, setInnerTime] = useState(0);
  const raf = useRef<number>(0);
  const startRef = useRef<number>(0);
  const controlled = controlledTime != null;

  useEffect(() => {
    if (!playing || controlled) return;
    startRef.current = performance.now();
    const tick = (now: number) => {
      const t = ((now - startRef.current) / 1000) % (duration + 0.6);
      setInnerTime(t);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, duration, controlled]);

  const time = controlled ? controlledTime : innerTime;

  // Find when the speaker actually starts talking in this clip
  const firstSpeechStart = data[0]?.words[0]?.start ?? data[0]?.start ?? 0;

  // Rule: Do NOT show subtitles or banners before the speaker begins talking!
  if (time < firstSpeechStart) {
    return null;
  }

  // 1. Studio template
  if (template === "studio") {
    const chunk = studioVisibleChunks(data, title || data[0]?.text || "Clip").find(
      (c) => time >= c.start && time < c.end
    );
    const capLines = chunk ? studioCaptionLines(chunk.text) : [];
    const card = studioCards(data).find((c) => time >= c.start && time < c.end);
    const banner = studioBanner(title || data[0]?.text || "Clip");
    const tagline = studioTagline(data);
    const light = card?.theme === "light";
    const showBanner = time >= firstSpeechStart && time < firstSpeechStart + STUDIO_BANNER_END;

    return (
      <div className={`pointer-events-none select-none ${className}`}>
        {showBanner && (
          <div
            className="absolute inset-x-0 flex flex-col items-center gap-[3px] transition-all duration-300"
            style={{ top: "11%" }}
          >
            {banner.map((ln, i) => (
              <span
                key={i}
                className="px-2.5 py-[3px] font-['Arial',sans-serif] font-black text-white text-[14px] leading-tight text-center shadow-lg"
                style={{ background: STUDIO_RED }}
              >
                {ln}
              </span>
            ))}
            {tagline && (
              <span
                className="text-white text-[12px] italic text-center px-2 mt-0.5"
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  textShadow: "1px 1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.85)",
                }}
              >
                {tagline}
              </span>
            )}
          </div>
        )}
        {capLines.length > 0 && !card && (
          <div
            className="absolute font-['Arial',sans-serif] font-bold text-white text-[17px] leading-[1.18] tracking-tight"
            style={{
              left: "6%",
              bottom: "27%",
              textShadow: "2px 2px 0 #000, -1px -1px 0 #000, 0 3px 8px rgba(0,0,0,0.9)",
            }}
          >
            {capLines.map((ln, i) => (
              <div key={i}>{ln}</div>
            ))}
          </div>
        )}
        {card && (
          <div
            key={card.start}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-6 text-center animate-fade-up"
            style={{ background: light ? "#E6E4E1" : "#0A0A0A" }}
          >
            {card.lines.map((ln, li) => (
              <p
                key={li}
                className="text-[14px] leading-snug font-['Arial',sans-serif]"
                style={{ color: light ? "#333333" : "#EEEEEE" }}
              >
                {ln.split(" ").map((word, wi) => (
                  <span
                    key={wi}
                    className={isStudioKeyword(word) ? "font-black" : "font-semibold"}
                    style={
                      isStudioKeyword(word)
                        ? { color: light ? STUDIO_RED : "#FFFFFF" }
                        : undefined
                    }
                  >
                    {word}{" "}
                  </span>
                ))}
              </p>
            ))}
            <span className="mt-3 h-1 w-16 rounded-full" style={{ background: STUDIO_RED }} />
          </div>
        )}
      </div>
    );
  }

  // 2. Cinematic Stack template (2-tier stacked storyteller)
  if (template === "cinematic") {
    const chunks = chunkWords(data, 3, 22);
    const currentChunk = chunks.find((c) => time >= c.start && time < c.end);
    if (!currentChunk || time < currentChunk.start) return null;

    const words = currentChunk.words;
    const topWord = words.length > 1 ? words[0].text.toLowerCase() : null;
    const bottomWords = (words.length > 1 ? words.slice(1) : words)
      .map((w) => w.text.toLowerCase())
      .join(" ");

    return (
      <div
        className={`flex flex-col items-center justify-end text-center pointer-events-none select-none transition-all ${className}`}
        style={{ paddingBottom: "22%" }}
      >
        <div className="flex flex-col items-center justify-center max-w-[92%] px-3">
          {topWord && (
            <span
              className="text-[14px] font-semibold tracking-wider text-white/90 font-['Arial',sans-serif]"
              style={{
                textShadow: "0 2px 8px rgba(0,0,0,0.85), 1px 1px 0 rgba(0,0,0,0.9)",
              }}
            >
              {topWord}
            </span>
          )}
          <span
            className="text-[26px] sm:text-[30px] font-black tracking-tight text-white font-['Arial_Black',Impact,sans-serif] leading-tight mt-0.5"
            style={{
              textShadow:
                "0 4px 16px rgba(0,0,0,0.95), 2px 2px 0 rgba(0,0,0,0.95), -1px -1px 0 rgba(0,0,0,0.9)",
            }}
          >
            {bottomWords}
          </span>
        </div>
      </div>
    );
  }

  // 3. Red Badge Explainer template
  if (template === "explainer") {
    const badgeText = (title || data[0]?.text || "EXPLAINER")
      .toUpperCase()
      .split(/\s+/)
      .slice(0, 4)
      .join(" ");
    const chunks = chunkWords(data, 6, 42);
    const currentChunk = chunks.find((c) => time >= c.start && time < c.end);
    const activeText =
      currentChunk && time >= currentChunk.start
        ? currentChunk.words.map((w) => w.text).join(" ")
        : null;

    return (
      <div className={`pointer-events-none select-none ${className}`}>
        {/* Top Red Topic Badge */}
        <div className="absolute inset-x-0 flex justify-center" style={{ top: "15%" }}>
          <div
            className="px-3.5 py-1 rounded bg-[#DC2626] text-white text-[11px] font-black tracking-wider uppercase shadow-xl"
            style={{
              boxShadow: "0 4px 12px rgba(220, 38, 38, 0.4), 0 2px 4px rgba(0,0,0,0.8)",
            }}
          >
            {badgeText}
          </div>
        </div>

        {/* Educational Subtitle Sentences */}
        {activeText && (
          <div
            className="absolute inset-x-0 flex items-end justify-center text-center px-4"
            style={{ bottom: "18%" }}
          >
            <div
              className="animate-fade-up text-white text-[16px] sm:text-[18px] font-bold font-['Arial',sans-serif] leading-snug tracking-tight max-w-[90%]"
              style={{
                textShadow:
                  "0 2px 10px rgba(0,0,0,0.95), 1px 1px 0 #000, -1px -1px 0 #000",
              }}
            >
              &ldquo;{activeText}&rdquo;
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. Editorial Podcast template (Georgia Serif)
  if (template === "editorial") {
    const chunks = chunkWords(data, 3, 22);
    const currentChunk = chunks.find((c) => time >= c.start && time < c.end);
    if (!currentChunk || time < currentChunk.start) return null;

    const text = currentChunk.words.map((w) => w.text.toLowerCase()).join(" ");

    return (
      <div
        className={`flex items-end justify-center text-center pointer-events-none select-none transition-all ${className}`}
        style={{ paddingBottom: "18%" }}
      >
        <div className="max-w-[88%] px-3">
          <span
            className="text-[22px] sm:text-[24px] font-normal text-white italic tracking-normal"
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              textShadow: "0 2px 12px rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.8)",
            }}
          >
            {text}
          </span>
        </div>
      </div>
    );
  }

  // 5. Hormozi, Beast, Cyber, Minimal templates
  let visible: {
    text: string;
    active: boolean;
    revealed?: boolean;
    highlight?: boolean;
    key: string | number;
  }[] = [];

  let paddingBottom = "20%";

  if (template === "hormozi") {
    paddingBottom = "20%";
    const chunks = chunkWords(data, 3, 24);
    const currentChunk = chunks.find((c) => time >= c.start && time < c.end);
    if (currentChunk && time >= currentChunk.start) {
      visible = currentChunk.words.map((w, i) => {
        const end =
          i + 1 < currentChunk.words.length ? currentChunk.words[i + 1].start : currentChunk.end;
        const active = time >= w.start && time < end;
        return {
          text: w.text.toUpperCase(),
          active,
          highlight: isHighlight(w.text),
          key: `${w.start}-${w.text}`,
        };
      });
    }
  } else if (template === "beast") {
    paddingBottom = "23%";
    const chunks = chunkWords(data, 2, 18);
    const currentChunk = chunks.find((c) => time >= c.start && time < c.end);
    if (currentChunk && time >= currentChunk.start) {
      const activeWord = currentChunk.words.find((w, i) => {
        const end =
          i + 1 < currentChunk.words.length ? currentChunk.words[i + 1].start : currentChunk.end;
        return time >= w.start && time < end;
      });
      if (activeWord && time >= activeWord.start) {
        visible = [
          {
            text: activeWord.text.toUpperCase(),
            active: true,
            highlight: isHighlight(activeWord.text),
            key: `${activeWord.start}-${activeWord.text}`,
          },
        ];
      }
    }
  } else if (template === "cyber") {
    paddingBottom = "20%";
    const chunks = chunkWords(data, 4, 30);
    const currentChunk = chunks.find((c) => time >= c.start && time < c.end);
    if (currentChunk && time >= currentChunk.start) {
      visible = currentChunk.words.map((w, i) => {
        const end =
          i + 1 < currentChunk.words.length ? currentChunk.words[i + 1].start : currentChunk.end;
        const active = time >= w.start && time < end;
        const revealed = time >= w.start;
        return {
          text: w.text.toUpperCase(),
          active,
          revealed,
          highlight: isHighlight(w.text),
          key: `${w.start}-${w.text}`,
        };
      });
    }
  } else {
    // minimal
    paddingBottom = "14%";
    const chunks = chunkWords(data, 9, 64);
    const currentChunk = chunks.find((c) => time >= c.start && time < c.end);
    if (currentChunk && time >= currentChunk.start) {
      visible = [
        {
          text: currentChunk.words.map((w) => w.text).join(" "),
          active: true,
          key: currentChunk.start,
        },
      ];
    }
  }

  // If no words are active at this moment (e.g. pause between speech), render nothing!
  if (visible.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex items-end justify-center text-center pointer-events-none select-none transition-all ${className}`}
      style={{ paddingBottom }}
    >
      {template === "minimal" ? (
        visible.map((v) => (
          <div
            key={v.key}
            className="animate-fade-up px-3.5 py-1.5 rounded-md bg-black/80 text-white text-[13px] font-['Arial',sans-serif] font-semibold max-w-[90%] tracking-wide shadow-md"
          >
            {v.text}
          </div>
        ))
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 max-w-[94%] px-2">
          {visible.map((v) => {
            const fontClass =
              template === "beast"
                ? "text-[26px] font-black font-['Arial_Black',Impact,sans-serif]"
                : "text-[20px] font-black font-['Arial_Black',Impact,sans-serif]";

            let styleObj: React.CSSProperties = {};
            if (template === "hormozi") {
              styleObj = {
                color: v.active ? "#F5FF00" : v.highlight ? "#FFD700" : "#FFFFFF",
                textShadow:
                  "3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 3px 8px rgba(0,0,0,0.9)",
              };
            } else if (template === "beast") {
              styleObj = {
                color: v.highlight ? "#FF2222" : "#FFFFFF",
                textShadow:
                  "4px 4px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 5px 12px rgba(0,0,0,0.95)",
              };
            } else if (template === "cyber") {
              styleObj = {
                color: v.active ? "#00FFFF" : v.revealed ? "#FFFFFF" : "#7A7A9E",
                textShadow: v.active
                  ? "0 0 14px #00FFFF, 0 0 28px #FF00FF, 2px 2px 0 #000"
                  : "1px 1px 0 #000, -1px -1px 0 #000",
              };
            }

            return (
              <span
                key={`${v.key}-${v.active}`}
                className={`leading-tight tracking-wider transition-transform duration-100 ${fontClass} ${
                  v.active ? "animate-bounce-word scale-105" : ""
                }`}
                style={styleObj}
              >
                {v.text}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
