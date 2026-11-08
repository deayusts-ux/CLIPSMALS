"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Icon } from "./Icon";
import { CaptionPreview } from "./CaptionPreview";
import { formatTimestamp, type AspectRatio, type CaptionTemplate, type ClipSegment } from "@/lib/types";

export function LiveClipPreview({
  projectId,
  clip,
  template,
  ratio,
  burnCaptions,
  seekTo,
  onTimeChange,
}: {
  projectId: string;
  clip: ClipSegment;
  template: CaptionTemplate;
  ratio: AspectRatio;
  burnCaptions: boolean;
  seekTo?: number;
  onTimeChange?: (t: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [captionTime, setCaptionTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isScrubbing, setIsScrubbing] = useState(false);
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

  // Jump to specific cue timestamp when user clicks a subtitle cue in editor
  useEffect(() => {
    if (seekTo != null && videoRef.current) {
      const target = Math.max(clip.start, Math.min(clip.end, clip.start + seekTo));
      videoRef.current.currentTime = target;
      setCaptionTime(target - clip.start);
      onTimeChange?.(target - clip.start);
    }
  }, [seekTo, clip.start, clip.end, onTimeChange]);

  const handleLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = clip.start;
    setReady(true);
  };

  // High-precision 60FPS RAF clock for butter-smooth word animation
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused && !isScrubbing) {
        if (v.currentTime >= clip.end) {
          v.currentTime = clip.start;
          setCaptionTime(0);
          onTimeChange?.(0);
        } else if (v.currentTime < clip.start) {
          v.currentTime = clip.start;
          setCaptionTime(0);
          onTimeChange?.(0);
        } else {
          const t = Math.max(0, v.currentTime - clip.start);
          setCaptionTime(t);
          onTimeChange?.(t);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [clip.start, clip.end, isScrubbing, onTimeChange]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < clip.start || v.currentTime >= clip.end - 0.05) {
        v.currentTime = clip.start;
      }
      v.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const handleSeek = useCallback(
    (clientX: number) => {
      const bar = progressBarRef.current;
      const v = videoRef.current;
      if (!bar || !v) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetTime = clip.start + pct * duration;
      v.currentTime = targetTime;
      const t = pct * duration;
      setCaptionTime(t);
      onTimeChange?.(t);
    },
    [clip.start, duration, onTimeChange]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    handleSeek(e.clientX);
    const onMove = (ev: MouseEvent) => handleSeek(ev.clientX);
    const onUp = () => {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setIsScrubbing(true);
    if (e.touches[0]) handleSeek(e.touches[0].clientX);
    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches[0]) handleSeek(ev.touches[0].clientX);
    };
    const onTouchEnd = () => {
      setIsScrubbing(false);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1, 1.25, 1.5];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (videoRef.current) {
      videoRef.current.playbackRate = next;
    }
  };

  const aspectClass =
    ratio === "9:16" ? "aspect-[9/16]" : ratio === "1:1" ? "aspect-square" : "aspect-video";
  const fitClass = ratio === "16:9" ? "object-contain" : "object-cover";

  return (
    <div
      className={`relative ${aspectClass} max-h-[50vh] w-full mx-auto rounded-2xl overflow-hidden bg-black ring-1 ring-white/10 shadow-2xl select-none`}
    >
      {/* Video element - completely stable frame, NO zoompan or scaling */}
      <video
        ref={videoRef}
        src={`/api/media/${projectId}/source.mp4`}
        className={`absolute inset-0 w-full h-full ${fitClass} object-center`}
        playsInline
        preload="auto"
        muted={muted}
        onLoadedMetadata={handleLoaded}
        onError={() => setError(true)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      {(template === "studio" || template === "explainer") && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)",
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

      {/* Main play / pause touch target */}
      <button
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center group focus:outline-none"
        aria-label={playing ? "Pause preview" : "Play preview"}
      >
        {!playing && (
          <span className="w-14 h-14 rounded-full bg-primary/90 backdrop-blur-md flex items-center justify-center shadow-glow-primary group-hover:scale-110 active:scale-95 transition-all">
            <Icon name="play_arrow" fill className="text-on-primary ml-1" size={32} />
          </span>
        )}
      </button>

      {/* Top Badges & Controls */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white flex items-center gap-1">
          <Icon name="visibility" size={12} className="text-primary" />
          Live preview · {ratio}
        </div>
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={cycleSpeed}
            className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white hover:bg-black/80 transition-colors"
            title="Playback Speed"
          >
            {playbackRate}x
          </button>
          <button
            onClick={toggleMute}
            className="p-1 rounded-md bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-colors"
            title={muted ? "Unmute" : "Mute"}
          >
            <Icon name={muted ? "volume_off" : "volume_up"} size={14} />
          </button>
        </div>
      </div>

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
          <span className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center">
          <p className="text-xs text-on-surface-variant">
            Source video unavailable. Render the clip to preview the final file.
          </p>
        </div>
      )}

      {/* Interactive Timeline Scrubber */}
      <div className="absolute bottom-0 inset-x-0 p-3 pt-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between text-[10px] font-bold text-white/90 mb-1.5 font-mono">
          <span>{formatTimestamp(captionTime)}</span>
          <span className="text-white/60">{formatTimestamp(duration)}</span>
        </div>
        <div
          ref={progressBarRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className="relative h-3 flex items-center cursor-pointer group"
        >
          <div className="h-1.5 w-full rounded-full bg-white/20 group-hover:h-2 transition-all overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-75"
              style={{ width: `${Math.min(100, (captionTime / duration) * 100)}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md border-2 border-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{
              left: `calc(${Math.min(100, (captionTime / duration) * 100)}% - 7px)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
