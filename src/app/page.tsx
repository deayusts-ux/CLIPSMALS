"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ProcessingOverlay } from "@/components/ProcessingOverlay";
import { AppShell } from "@/components/AppShell";
import {
  TEMPLATE_META,
  formatTimestamp,
  timeAgo,
  type CaptionTemplate,
  type DurationPreset,
  type HookSensitivity,
  type AspectRatio,
  type JobState,
} from "@/lib/types";

interface ProjectSummary {
  id: string;
  video: { title: string; thumbnail: string; duration: number };
  clipCount: number;
  createdAt: number;
}

const SAMPLES = [
  { label: "Me at the zoo (19s)", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", icon: "trending_up" },
  { label: "TED: Procrastination", url: "https://www.youtube.com/watch?v=arj7oStGLkU", icon: "mic" },
];

export default function GeneratePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [urlFlash, setUrlFlash] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [template, setTemplate] = useState<CaptionTemplate>("hormozi");
  const [duration, setDuration] = useState<DurationPreset>("short");
  const [hook, setHook] = useState<HookSensitivity>("aggressive");
  const [ratio, setRatio] = useState<AspectRatio>("9:16");
  const [job, setJob] = useState<JobState | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [engineReady, setEngineReady] = useState<boolean | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadProjects = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadProjects();
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setEngineReady(d.ready))
      .catch(() => setEngineReady(false));
    const saved = localStorage.getItem("klipviral-settings");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.template) setTemplate(s.template);
        if (s.duration) setDuration(s.duration);
        if (s.hook) setHook(s.hook);
        if (s.ratio) setRatio(s.ratio);
      } catch {}
    }
    const urlTemplate = new URLSearchParams(window.location.search).get("template");
    if (urlTemplate && ["hormozi", "beast", "minimal", "cyber", "studio"].includes(urlTemplate)) {
      setTemplate(urlTemplate as CaptionTemplate);
    }
    const activeJob = localStorage.getItem("klipviral-job");
    if (activeJob) pollJob(activeJob, true);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "klipviral-settings",
      JSON.stringify({ template, duration, hook, ratio })
    );
  }, [template, duration, hook, ratio]);

  const pollJob = useCallback(
    (jobId: string, resume = false) => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (resume) setShowOverlay(true);
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/jobs/${jobId}`);
          if (r.status === 404) {
            localStorage.removeItem("klipviral-job");
            if (pollRef.current) clearInterval(pollRef.current);
            setShowOverlay(false);
            return;
          }
          const j: JobState = await r.json();
          setJob(j);
          if (j.stage === "done" && j.projectId) {
            localStorage.removeItem("klipviral-job");
            if (pollRef.current) clearInterval(pollRef.current);
            loadProjects();
            router.push(`/clips?project=${j.projectId}`);
          } else if (j.stage === "error") {
            localStorage.removeItem("klipviral-job");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {}
      }, 1200);
    },
    [loadProjects, router]
  );

  const flashUrl = () => {
    setUrlFlash(true);
    setTimeout(() => setUrlFlash(false), 900);
  };

  const handlePaste = async () => {
    setUrlError("");
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        flashUrl();
      }
    } catch {
      setUrlError("Clipboard access denied — paste manually with Ctrl+V.");
    }
  };

  const handleGenerate = async () => {
    setUrlError("");
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError("Paste a YouTube link first.");
      return;
    }
    if (!/youtube\.com|youtu\.be/.test(trimmed)) {
      setUrlError("That doesn't look like a YouTube link.");
      return;
    }
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed,
          settings: { template, duration, hook, ratio },
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setUrlError(d.error || "Failed to start generation");
        return;
      }
      localStorage.setItem("klipviral-job", d.jobId);
      setJob({ id: d.jobId, stage: "queued", progress: 0, message: "Queued", startedAt: Date.now() });
      setShowOverlay(true);
      pollJob(d.jobId);
    } catch {
      setUrlError("Network error — is the server running?");
    }
  };

  const totalClips = projects.reduce((a, p) => a + p.clipCount, 0);

  return (
    <AppShell>
    <div className="flex flex-col w-full px-margin space-y-space-lg pb-10 max-w-[480px] mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-surface-container-high p-space-md shadow-lg">
        <div className="absolute -right-10 -top-10 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-4 bottom-2 opacity-15 pointer-events-none">
          <Icon name="auto_fix_high" className="text-primary" size={72} />
        </div>
        <div className="relative z-10 flex flex-col space-y-space-xs max-w-[85%]">
          <div className="inline-flex items-center gap-1.5 self-start px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[10px] font-bold uppercase tracking-wider">
            <Icon name="bolt" fill size={13} />
            AI Clip Engine v2.4
          </div>
          <h1 className="font-headline font-bold text-xl text-on-surface tracking-tight leading-tight">
            Turn 1 YouTube Video into 10+ Viral Shorts in 60s
          </h1>
          <p className="font-body text-xs text-on-surface-variant">
            Auto-hook detection, smart speaker 9:16 reframing &amp; animated captions.
          </p>
        </div>
      </div>

      {engineReady === false && (
        <div className="px-4 py-3 rounded-xl bg-error-container/30 border border-error/30 text-on-error-container text-xs">
          Engine binaries not found. Run <code className="font-bold">setup.bat</code> in the project folder to install yt-dlp + ffmpeg.
        </div>
      )}

      {/* URL input */}
      <div className="flex flex-col rounded-2xl bg-surface-container p-space-md shadow-md space-y-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-variant text-error">
              <Icon name="smart_display" fill size={18} />
            </span>
            <span className="font-headline font-semibold text-[15px] text-on-surface">
              Source Long-form Video
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant text-[10px] font-bold">
            Up to 3 hrs
          </span>
        </div>
        <div
          className={`relative flex items-center w-full rounded-lg bg-surface-container-low shadow-inner transition-all ${
            urlFlash ? "ring-2 ring-secondary" : "focus-within:ring-2 focus-within:ring-primary/40"
          }`}
        >
          <div className="pl-3 text-on-surface-variant">
            <Icon name="link" size={20} />
          </div>
          <input
            className="w-full h-12 bg-transparent pl-2.5 pr-24 text-on-surface font-body text-sm placeholder:text-outline focus:outline-none"
            placeholder="https://youtube.com/watch?v=…"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setUrlError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <button
            className="absolute right-1.5 h-9 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 active:scale-95 transition-transform shadow-sm"
            onClick={handlePaste}
            type="button"
          >
            <Icon name="content_paste" size={16} />
            Paste
          </button>
        </div>
        {urlError && (
          <p className="text-xs text-error font-body -mt-1">{urlError}</p>
        )}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] font-bold text-outline whitespace-nowrap">Try Sample:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.url}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-variant text-on-surface text-[10px] font-bold whitespace-nowrap active:bg-surface-bright transition-colors"
              onClick={() => {
                setUrl(s.url);
                flashUrl();
              }}
              type="button"
            >
              <Icon name={s.icon} size={14} className="text-tertiary" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Caption presets */}
      <div className="flex flex-col space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-headline font-semibold text-[15px] text-on-surface">
              Captions &amp; Kinetic Typography
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          </div>
          <Link
            href="/templates"
            className="flex items-center gap-0.5 text-primary hover:text-primary-fixed transition-colors text-xs font-semibold"
          >
            Customize
            <Icon name="chevron_right" size={16} />
          </Link>
        </div>
        <div className="flex items-center gap-space-sm overflow-x-auto no-scrollbar py-1">
          {(Object.keys(TEMPLATE_META) as CaptionTemplate[]).map((key) => {
            const meta = TEMPLATE_META[key];
            const selected = template === key;
            const letterBg =
              key === "hormozi"
                ? "bg-primary text-on-primary"
                : key === "beast"
                  ? "bg-error text-on-error"
                  : key === "minimal"
                    ? "bg-surface-variant text-on-surface"
                    : key === "studio"
                      ? "bg-[#E8262D] text-white"
                      : "bg-secondary text-on-secondary";
            return (
              <button
                key={key}
                onClick={() => setTemplate(key)}
                className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-sm transition-all text-left ${
                  selected
                    ? "bg-primary/15 ring-1 ring-primary"
                    : "bg-surface-container hover:bg-surface-container-high"
                }`}
                type="button"
              >
                <span
                  className={`flex items-center justify-center w-6 h-6 rounded-md font-headline text-[11px] font-extrabold ${letterBg}`}
                >
                  {meta.letter}
                </span>
                <span className="flex flex-col">
                  <span className="text-xs font-semibold leading-tight text-on-surface">
                    {meta.name}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${selected ? "text-primary" : "text-outline"}`}
                  >
                    {meta.tag}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low text-on-surface-variant">
          <Icon name="auto_awesome" size={16} className="text-primary" />
          <span className="font-body text-xs text-on-surface">
            {TEMPLATE_META[template].description}
          </span>
        </div>
      </div>

      {/* AI Director settings */}
      <div className="flex flex-col rounded-2xl bg-surface-container p-space-md space-y-space-md shadow-md">
        <div className="flex items-center justify-between">
          <span className="font-headline font-semibold text-[15px] text-on-surface">
            AI Director Settings
          </span>
          <span className="text-[10px] font-bold text-secondary flex items-center gap-1">
            <Icon name="psychology" size={14} /> Smart Auto-Detect
          </span>
        </div>

        <ChoiceGroup
          label="Target Duration"
          hint="Pacing optimized"
          options={[
            { value: "short", title: "< 30s", sub: "TikTok / Shorts" },
            { value: "medium", title: "30s – 60s", sub: "Reels Gold" },
            { value: "long", title: "60s – 90s", sub: "Deep Story" },
          ]}
          value={duration}
          onChange={(v) => setDuration(v as DurationPreset)}
        />
        <ChoiceGroup
          label="Hook Sensitivity"
          hint="Retention score target: >88%"
          hintClass="text-tertiary"
          accent="secondary"
          options={[
            { value: "aggressive", title: "Aggressive", sub: "Max virality", icon: "local_fire_department" },
            { value: "balanced", title: "Balanced", sub: "Default mix" },
            { value: "context", title: "Context", sub: "Complete ideas" },
          ]}
          value={hook}
          onChange={(v) => setHook(v as HookSensitivity)}
        />
        <ChoiceGroup
          label="Framing Format"
          hint="Center-weighted crop"
          hintClass="text-secondary"
          options={[
            { value: "9:16", title: "9:16", sub: "Auto-reframe", icon: "stay_current_portrait" },
            { value: "1:1", title: "1:1", sub: "Feed Post", icon: "crop_square" },
            { value: "16:9", title: "16:9", sub: "Original", icon: "stay_current_landscape" },
          ]}
          value={ratio}
          onChange={(v) => setRatio(v as AspectRatio)}
        />
      </div>

      {/* CTA */}
      <div className="flex flex-col space-y-2">
        <button
          className="group relative w-full h-14 rounded-xl bg-gradient-to-r from-primary-container via-inverse-primary to-primary-container p-0.5 shadow-xl hover:shadow-primary/25 active:scale-[0.98] transition-all overflow-hidden disabled:opacity-50"
          onClick={handleGenerate}
          disabled={engineReady === false || (job != null && job.stage !== "error" && job.stage !== "done")}
          type="button"
        >
          <div className="w-full h-full rounded-[10px] bg-primary flex items-center justify-center gap-2 text-on-primary">
            <Icon
              name="auto_fix_high"
              fill
              size={22}
              className="group-hover:rotate-12 transition-transform"
            />
            <span className="font-headline font-semibold text-[16px] tracking-wide">
              Generate Viral Clips
            </span>
          </div>
        </button>
        <div className="flex items-center justify-between px-1 text-on-surface-variant">
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <Icon name="token" size={15} className="text-secondary" />
            <span>
              Cost: <strong className="text-on-surface">Free · Local engine</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span>
              <strong className="text-secondary">{totalClips} clips</strong> generated so far
            </span>
          </div>
        </div>
      </div>

      {/* Recent projects */}
      <div className="flex flex-col space-y-space-sm pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="history" size={18} className="text-on-surface-variant" />
            <span className="font-headline font-semibold text-[15px] text-on-surface">
              Recent Projects
            </span>
          </div>
          <span className="text-[10px] font-bold text-outline">{projects.length} total</span>
        </div>
        {projects.length === 0 ? (
          <div className="p-4 rounded-xl bg-surface-container text-center">
            <p className="text-xs text-outline font-body">
              No projects yet — paste a YouTube link above to create your first viral clip.
            </p>
          </div>
        ) : (
          <div className="flex flex-col space-y-space-sm">
            {projects.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/clips?project=${p.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
              >
                <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="w-full h-full object-cover"
                    src={p.video.thumbnail}
                    alt={p.video.title}
                    loading="lazy"
                  />
                  <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-surface-container-lowest/80 text-[9px] font-bold text-on-surface">
                    {formatTimestamp(p.video.duration)}
                  </span>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-headline font-semibold text-[14px] text-on-surface truncate">
                    {p.video.title}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-secondary/15 text-secondary text-[10px] font-bold">
                      <Icon name="local_fire_department" fill size={11} /> {p.clipCount} Clips
                    </span>
                    <span className="text-[10px] font-bold text-outline">
                      {timeAgo(p.createdAt)}
                    </span>
                  </div>
                </div>
                <span className="p-2 rounded-lg bg-surface-variant text-on-surface-variant">
                  <Icon name="chevron_right" size={20} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showOverlay && job && (
        <ProcessingOverlay
          job={job}
          onClose={() => setShowOverlay(false)}
          onRetry={handleGenerate}
        />
      )}
    </div>
    </AppShell>
  );
}

function ChoiceGroup({
  label,
  hint,
  hintClass = "text-outline",
  options,
  value,
  onChange,
  accent = "primary",
}: {
  label: string;
  hint: string;
  hintClass?: string;
  options: { value: string; title: string; sub: string; icon?: string }[];
  value: string;
  onChange: (v: string) => void;
  accent?: "primary" | "secondary";
}) {
  const activeClass =
    accent === "secondary"
      ? "bg-secondary/15 text-secondary ring-1 ring-secondary"
      : "bg-primary/15 text-primary ring-1 ring-primary";
  return (
    <div className="flex flex-col space-y-1.5">
      <label className="text-xs font-semibold text-on-surface-variant flex items-center justify-between">
        <span>{label}</span>
        <span className={`text-[11px] ${hintClass}`}>{hint}</span>
      </label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              type="button"
              className={`px-2 py-2.5 rounded-lg flex flex-col items-center justify-center text-center transition-all ${
                selected
                  ? activeClass
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-variant"
              }`}
            >
              <span
                className={`text-xs font-bold flex items-center gap-1 ${selected ? "" : "text-on-surface"}`}
              >
                {o.icon && <Icon name={o.icon} size={14} />}
                {o.title}
              </span>
              <span
                className={`text-[10px] font-bold mt-0.5 ${selected ? "text-on-surface-variant" : "text-outline"}`}
              >
                {o.sub}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}