"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { LiveClipPreview } from "./LiveClipPreview";
import {
  TEMPLATE_META,
  formatTimestamp,
  type AspectRatio,
  type CaptionTemplate,
  type ClipSegment,
  type Project,
  type TranscriptCue,
} from "@/lib/types";

export function ClipEditor({
  project,
  clip,
  onClose,
  onUpdate,
}: {
  project: Project;
  clip: ClipSegment;
  onClose: () => void;
  onUpdate: (clip: ClipSegment) => void;
}) {
  const [template, setTemplate] = useState<CaptionTemplate>(
    clip.renderedTemplate || project.settings.template
  );
  const [ratio, setRatio] = useState<AspectRatio>(
    clip.renderedRatio || project.settings.ratio
  );
  const [burnCaptions, setBurnCaptions] = useState(true);
  const [cues, setCues] = useState<TranscriptCue[]>(clip.cues);
  const [title, setTitle] = useState(clip.title);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [renderedUrl, setRenderedUrl] = useState<string | undefined>(clip.renderedUrl);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"preview" | "subtitles">("preview");
  const [previewMode, setPreviewMode] = useState<"live" | "rendered">(
    clip.renderedUrl ? "rendered" : "live"
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTarget, setSeekTarget] = useState<number | undefined>(undefined);

  const changeTemplate = (t: CaptionTemplate) => {
    setTemplate(t);
    setPreviewMode("live");
  };
  const changeRatio = (r: AspectRatio) => {
    setRatio(r);
    setPreviewMode("live");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSaveSubtitles = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId: clip.id, cues, title }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Save failed");
      onUpdate(d.clip);
      setRenderedUrl(undefined);
      setPreviewMode("live");
      setDirty(false);
    } catch (e) {
      setRenderError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRender = async () => {
    setRendering(true);
    setRenderError("");
    try {
      if (dirty) await handleSaveSubtitles();
      const r = await fetch(`/api/render/${project.id}/${clip.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, ratio, burnCaptions }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Render failed");
      setRenderedUrl(d.url);
      setPreviewMode("rendered");
      onUpdate(d.clip);
    } catch (e) {
      setRenderError(e instanceof Error ? e.message : "Render failed");
    } finally {
      setRendering(false);
    }
  };

  const updateCueText = (idx: number, text: string) => {
    setCues((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const tokens = text.split(/\s+/).filter(Boolean);
        const words = tokens.map((tok, wi) => {
          const orig = c.words[wi];
          const start = orig
            ? Math.min(orig.start, c.end)
            : c.start + ((c.end - c.start) * wi) / tokens.length;
          const end = orig
            ? Math.max(start + 0.05, Math.min(orig.end, c.end))
            : c.start + ((c.end - c.start) * (wi + 1)) / tokens.length;
          return { text: tok, start, end };
        });
        return { ...c, text, words };
      })
    );
    setDirty(true);
  };

  const shiftTiming = (idx: number, delta: number) => {
    setCues((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const start = Math.max(0, c.start + delta);
        const end = Math.max(start + 0.2, c.end + delta);
        return {
          ...c,
          start,
          end,
          words: c.words.map((w) => ({
            ...w,
            start: Math.max(0, w.start + delta),
            end: Math.max(0.05, w.end + delta),
          })),
        };
      })
    );
    setDirty(true);
  };

  const seekToCue = (startSec: number) => {
    if (previewMode === "live") {
      setSeekTarget(startSec);
      setCurrentTime(startSec);
    } else if (videoRef.current) {
      videoRef.current.currentTime = startSec;
      videoRef.current.play().catch(() => {});
      setCurrentTime(startSec);
    }
  };

  const aspectClass =
    ratio === "9:16" ? "aspect-[9/16]" : ratio === "1:1" ? "aspect-square" : "aspect-video";

  const safeDownloadName = encodeURIComponent(
    (title || clip.title || "clip").replace(/[^\w\s-]/g, "").trim().slice(0, 50) || "clip"
  );

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-md overflow-y-auto">
      <div className="max-w-[480px] mx-auto px-margin pt-4 pb-12 flex flex-col gap-3 min-h-full">
        {/* Top Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            aria-label="Close editor"
          >
            <Icon name="arrow_back" size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-headline font-bold text-[15px] text-on-surface truncate">
              {title || "Clip Editor"}
            </h2>
            <p className="text-[10px] text-outline font-body">
              {formatTimestamp(clip.start)} → {formatTimestamp(clip.end)} ·{" "}
              {formatTimestamp(clip.end - clip.start)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/15 border border-secondary/50 text-secondary text-xs font-bold shadow-sm">
            <Icon name="local_fire_department" fill size={14} />
            {clip.score}
          </span>
        </div>

        {/* Title Input */}
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container text-on-surface font-headline font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 border border-white/5"
          placeholder="Clip title…"
        />

        {/* Video Preview: Always accessible at top */}
        {renderedUrl && (
          <div className="flex gap-1 p-1 rounded-xl bg-surface-container border border-white/5">
            {(["live", "rendered"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPreviewMode(m)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  previewMode === m
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {m === "live" ? "Live preview" : "Rendered final MP4"}
              </button>
            ))}
          </div>
        )}

        {previewMode === "live" || !renderedUrl ? (
          <LiveClipPreview
            projectId={project.id}
            clip={{ ...clip, cues, title }}
            template={template}
            ratio={ratio}
            burnCaptions={burnCaptions}
            seekTo={seekTarget}
            onTimeChange={setCurrentTime}
          />
        ) : (
          <div
            className={`relative ${aspectClass} max-h-[50vh] w-full mx-auto rounded-2xl overflow-hidden bg-black ring-1 ring-white/10 shadow-2xl`}
          >
            <video
              ref={videoRef}
              src={renderedUrl}
              controls
              playsInline
              className="absolute inset-0 w-full h-full object-contain"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-container border border-white/5 mt-1">
          {(["preview", "subtitles"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                tab === t
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t === "preview" ? "Style & Format" : `Subtitles & Timing (${cues.length})`}
            </button>
          ))}
        </div>

        {tab === "preview" ? (
          <div className="flex flex-col gap-3">
            {/* Caption Style selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-on-surface-variant">Caption style</span>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(TEMPLATE_META) as CaptionTemplate[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => changeTemplate(key)}
                    className={`py-2 px-1 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                      template === key
                        ? "bg-primary/20 text-primary ring-2 ring-primary shadow-sm"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    <span>{TEMPLATE_META[key].name.split(" ")[0]}</span>
                    <span className="text-[8px] opacity-70">
                      {key === "hormozi" ? "Bounce" : key === "beast" ? "Punch" : key === "studio" ? "Vox" : key === "cyber" ? "Glow" : "Clean"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-on-surface-variant">Aspect ratio</span>
              <div className="grid grid-cols-3 gap-2">
                {(["9:16", "1:1", "16:9"] as AspectRatio[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => changeRatio(r)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      ratio === r
                        ? "bg-primary/20 text-primary ring-2 ring-primary shadow-sm"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {r} {r === "9:16" ? "(TikTok/Reels)" : r === "1:1" ? "(Feed)" : "(Landscape)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Burn Captions switch */}
            <label className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-surface-container border border-white/5 cursor-pointer">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-on-surface">Burn animated captions into video</span>
                <span className="text-[10px] text-outline">Permanent kinetic typography burned with FFmpeg</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={burnCaptions}
                onClick={() => {
                  setBurnCaptions(!burnCaptions);
                  setPreviewMode("live");
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  burnCaptions ? "bg-primary" : "bg-surface-container-highest"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                    burnCaptions ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </label>
          </div>
        ) : (
          /* Subtitles & Timing Tab */
          <div className="flex flex-col gap-2.5">
            <p className="text-[11px] text-outline font-body flex items-center gap-1">
              <Icon name="info" size={13} />
              Click any timestamp to jump to that moment in the video. Edit text or adjust timing below.
            </p>
            {cues.map((cue, idx) => {
              const isActive = currentTime >= cue.start && currentTime < cue.end;
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl bg-surface-container transition-all border ${
                    isActive
                      ? "border-primary shadow-glow-primary ring-1 ring-primary/60 bg-primary/5"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => seekToCue(cue.start)}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[10px] font-bold hover:bg-primary/25 transition-colors"
                      title="Jump to this cue in video"
                    >
                      <Icon name="play_arrow" size={12} fill />
                      {formatTimestamp(cue.start)} → {formatTimestamp(cue.end)}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => shiftTiming(idx, -0.2)}
                        className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[9px] font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors"
                        title="Shift 0.2s earlier"
                      >
                        −0.2s
                      </button>
                      <button
                        onClick={() => shiftTiming(idx, 0.2)}
                        className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[9px] font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors"
                        title="Shift 0.2s later"
                      >
                        +0.2s
                      </button>
                      <button
                        onClick={() => shiftTiming(idx, -0.5)}
                        className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[9px] font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors"
                        title="Shift 0.5s earlier"
                      >
                        −0.5s
                      </button>
                      <button
                        onClick={() => shiftTiming(idx, 0.5)}
                        className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[9px] font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors"
                        title="Shift 0.5s later"
                      >
                        +0.5s
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={cue.text}
                    onChange={(e) => updateCueText(idx, e.target.value)}
                    rows={2}
                    className="w-full bg-surface-container-low px-2.5 py-1.5 rounded-lg text-[13px] font-body text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none border border-white/5"
                  />
                </div>
              );
            })}
            {cues.length === 0 && (
              <p className="text-xs text-outline text-center py-6">No subtitle cues found in this clip.</p>
            )}
          </div>
        )}

        {/* Error message */}
        {renderError && (
          <div className="px-3.5 py-2.5 rounded-xl bg-error-container/40 border border-error/40 text-on-error-container text-xs flex items-center gap-2">
            <Icon name="error" size={16} />
            {renderError}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2.5 mt-auto pt-3">
          {dirty && (
            <button
              onClick={handleSaveSubtitles}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-surface-container-high text-on-surface text-sm font-bold hover:bg-surface-bright transition-colors disabled:opacity-50 border border-white/10 flex items-center justify-center gap-1.5"
            >
              <Icon name="save" size={16} />
              {saving ? "Saving changes…" : "Save subtitle edits"}
            </button>
          )}

          <button
            onClick={handleRender}
            disabled={rendering}
            className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-headline font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60 shadow-glow-primary"
          >
            {rendering ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-on-primary border-t-transparent animate-spin" />
                Rendering clip with FFmpeg… (~15–30s)
              </>
            ) : (
              <>
                <Icon name="auto_fix_high" fill size={18} />
                {renderedUrl ? "Re-render with current settings" : "Render Final Video (High Quality)"}
              </>
            )}
          </button>

          {renderedUrl && (
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={`${renderedUrl}?download=1&filename=${safeDownloadName}`}
                download={`${(title || clip.title || "clip").replace(/[^\w\s-]/g, "").trim()}.mp4`}
                className="py-3 rounded-xl bg-secondary text-on-secondary text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform shadow-glow-secondary"
              >
                <Icon name="download" size={18} />
                Download MP4
              </a>
              <a
                href={`/api/export/${project.id}/${clip.id}`}
                download
                className="py-3 rounded-xl bg-surface-container-high text-on-surface text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-surface-bright transition-colors border border-white/5"
              >
                <Icon name="subtitles" size={18} />
                Export SRT
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
