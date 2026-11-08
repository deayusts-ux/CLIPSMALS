"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { CaptionPreview } from "./CaptionPreview";
import { formatTimestamp, type AspectRatio, type CaptionTemplate, type ClipSegment } from "@/lib/types";
import { studioZoom } from "@/lib/studio";

export function LiveClipPreview({
  projectId,
  clip,
  template,
  ratio,
  burnCaptions,
}: {
  projectId: string;
  clip: ClipSegment;
  template: CaptionTemplate;
  ratio: AspectRatio;
  burnCaptions: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [captionTime, setCaptionTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const duration = Math.max(0.5, clip.end - clip.start);

  useEffect(() => {
    setPlaying(false);
    setCaptionTime(0);
    setReady(false);
    setError(false);
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.load();
    }
  }, [clip.id, projectId]);

  const handleLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = clip.start;
    setReady(true);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime >= clip.end) {
      v.currentTime = clip.start;
      setCaptionTime(0);
      return;
    }
    if (v.currentTime < clip.start - 0.3) {
      v.currentTime = clip.start;
    }
    setCaptionTime(Math.max(0, v.currentTime - clip.start));
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < clip.start || v.currentTime >= clip.end - 0.05) {
        v.currentTime = clip.start;
      }
      v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const aspectClass =
    ratio === "9:16" ? "aspect-[9/16]" : ratio === "1:1" ? "aspect-square" : "aspect-video";
  const fitClass = ratio === "16:9" ? "object-contain" : "object-cover";

  return (
    <div
      className={`relative ${aspectClass} max-h-[55vh] w-full mx-auto rounded-2xl overflow-hidden bg-black ring-1 ring-white/10`}
    >
      <video
        ref={videoRef}
        src={`/api/media/${projectId}/source.mp4`}
        className={`absolute inset-0 w-full h-full ${fitClass} object-center`}
        style={
          template === "studio"
            ? { transform: `scale(${studioZoom(captionTime)})` }
            : undefined
        }
        playsInline
        preload="auto"
        muted={false}
        onLoadedMetadata={handleLoaded}
        onTimeUpdate={handleTimeUpdate}
        onError={() => setError(true)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      {template === "studio" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.5) 100%)",
          }}
        />
      )}

      {burnCaptions && (
        <CaptionPreview
          template={template}
          cues={clip.cues}
          playing={false}
          time={captionTime}
          title={clip.title}
          className="absolute inset-0"
        />
      )}

      <button
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center group"
        aria-label={playing ? "Pause preview" : "Play preview"}
      >
        {!playing && (
          <span className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-glow-primary group-active:scale-95 transition-transform">
            <Icon name="play_arrow" fill className="text-on-primary" size={32} />
          </span>
        )}
      </button>

      <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 text-[10px] font-bold text-white flex items-center gap-1 pointer-events-none">
        <Icon name="visibility" size={12} />
        Live preview · {ratio}
      </div>

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
          <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center">
          <p className="text-xs text-on-surface-variant">
            Source video unavailable. Render the clip to preview the final file.
          </p>
        </div>
      )}

      <div className="absolute bottom-0 inset-x-0 px-3 pb-2 pointer-events-none">
        <div className="flex items-center justify-between text-[9px] font-bold text-white/90 mb-1">
          <span>{formatTimestamp(captionTime)}</span>
          <span>{formatTimestamp(duration)}</span>
        </div>
        <div className="h-1 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-150"
            style={{ width: `${Math.min(100, (captionTime / duration) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}