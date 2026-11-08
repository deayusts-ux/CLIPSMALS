"use client";

import { useEffect, useRef, useState } from "react";
import type { CaptionTemplate, TranscriptCue } from "@/lib/types";
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

const HIGHLIGHT = new Set([
  "secret", "nobody", "you", "million", "free", "best", "never", "stop", "crazy",
]);

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

  if (template === "studio") {
    const chunk = studioVisibleChunks(data, title || data[0]?.text || "Clip").find(
      (c) => time >= c.start && time < c.end
    );
    const capLines = chunk ? studioCaptionLines(chunk.text) : [];
    const card = studioCards(data).find((c) => time >= c.start && time < c.end);
    const banner = studioBanner(title || data[0]?.text || "Clip");
    const tagline = studioTagline(data);
    const light = card?.theme === "light";
    return (
      <div className={`pointer-events-none ${className}`}>
        {time < STUDIO_BANNER_END && (
          <div
            className="absolute inset-x-0 flex flex-col items-center gap-[3px]"
            style={{ top: "11%" }}
          >
            {banner.map((ln, i) => (
              <span
                key={i}
                className="px-2 py-[2px] font-headline font-extrabold text-white text-[14px] leading-tight text-center"
                style={{ background: STUDIO_RED }}
              >
                {ln}
              </span>
            ))}
            {tagline && (
              <span
                className="text-white text-[12px] italic text-center px-2"
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  textShadow: "1px 1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.8)",
                }}
              >
                {tagline}
              </span>
            )}
          </div>
        )}
        {capLines.length > 0 && !card && (
          <div
            className="absolute font-body font-bold text-white text-[17px] leading-[1.15]"
            style={{
              left: "6%",
              bottom: "27%",
              textShadow: "1px 1px 0 #000, 0 3px 8px rgba(0,0,0,0.85)",
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
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center animate-fade-up"
            style={{ background: light ? "#E6E4E1" : "#0A0A0A" }}
          >
            {card.lines.map((ln, li) => (
              <p
                key={li}
                className="text-[13px] leading-snug font-body"
                style={{ color: light ? "#333333" : "#EEEEEE" }}
              >
                {ln.split(" ").map((word, wi) => (
                  <span
                    key={wi}
                    className={isStudioKeyword(word) ? "font-extrabold" : ""}
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

  const words = data.flatMap((c) => c.words);
  const activeIdx = words.findIndex((w) => time >= w.start && time < w.end);

  let visible: { text: string; active: boolean; key: number }[] = [];
  if (template === "hormozi" || template === "cyber") {
    const chunkSize = template === "hormozi" ? 3 : 4;
    const idx = activeIdx === -1 ? (time < 0.2 ? 0 : -1) : activeIdx;
    if (idx >= 0) {
      const chunkStart = Math.floor(idx / chunkSize) * chunkSize;
      visible = words.slice(chunkStart, chunkStart + chunkSize).map((w, i) => ({
        text: w.text.toUpperCase(),
        active: chunkStart + i === idx,
        key: chunkStart + i,
      }));
    }
  } else if (template === "beast") {
    if (activeIdx >= 0) {
      visible = [
        {
          text: words[activeIdx].text.toUpperCase(),
          active: true,
          key: activeIdx,
        },
      ];
    }
  } else {
    const cue = data.find((c) => time >= c.start && time < c.end);
    if (cue) visible = [{ text: cue.text, active: true, key: cue.start }];
  }

  return (
    <div
      className={`flex items-end justify-center text-center pointer-events-none ${className}`}
      style={{ paddingBottom: "18%" }}
    >
      {template === "minimal" ? (
        visible.map((v) => (
          <div
            key={v.key}
            className="animate-fade-up px-3 py-1.5 rounded-md bg-black/70 text-white text-[13px] font-body font-semibold max-w-[90%]"
          >
            {v.text}
          </div>
        ))
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 max-w-[94%]">
          {visible.map((v) => (
            <span
              key={`${v.key}-${v.active}`}
              className={`font-headline font-extrabold leading-tight ${
                template === "beast" ? "text-[26px]" : "text-[19px]"
              } ${v.active ? "animate-bounce-word" : ""}`}
              style={
                template === "hormozi"
                  ? {
                      color: v.active
                        ? "#F5FF00"
                        : HIGHLIGHT.has(v.text.toLowerCase())
                          ? "#FFD700"
                          : "#FFFFFF",
                      textShadow:
                        "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 3px 6px rgba(0,0,0,0.8)",
                    }
                  : template === "beast"
                    ? {
                        color: HIGHLIGHT.has(v.text.toLowerCase()) ? "#FF2222" : "#FFFFFF",
                        textShadow:
                          "3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 10px rgba(0,0,0,0.9)",
                      }
                    : {
                        color: v.active ? "#00FFFF" : "#8888AA",
                        textShadow: v.active
                          ? "0 0 12px #00FFFF, 0 0 24px #FF00FF, 2px 2px 0 #000"
                          : "1px 1px 0 #000",
                      }
              }
            >
              {v.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}