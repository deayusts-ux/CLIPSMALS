"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";

interface Stats {
  projects: number;
  clips: number;
  rendered: number;
}

export default function ProfilePage() {
  const [stats, setStats] = useState<Stats>({ projects: 0, clips: 0, rendered: 0 });
  const [engine, setEngine] = useState<{ ytdlp: boolean; ffmpeg: boolean; deno: boolean } | null>(null);
  const [name, setName] = useState("Creator");

  useEffect(() => {
    const savedName = localStorage.getItem("klipviral-name");
    if (savedName) setName(savedName);
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setEngine(d.binaries))
      .catch(() => {});
    fetch("/api/projects")
      .then((r) => r.json())
      .then(async (d) => {
        const projects = d.projects || [];
        let rendered = 0;
        for (const p of projects.slice(0, 20)) {
          try {
            const full = await fetch(`/api/projects/${p.id}`).then((r) => r.json());
            rendered += (full.clips || []).filter((c: { renderedUrl?: string }) => c.renderedUrl).length;
          } catch {}
        }
        setStats({
          projects: projects.length,
          clips: projects.reduce((a: number, p: { clipCount: number }) => a + p.clipCount, 0),
          rendered,
        });
      })
      .catch(() => {});
  }, []);

  const saveName = (v: string) => {
    setName(v);
    localStorage.setItem("klipviral-name", v);
  };

  return (
    <AppShell>
      <div className="flex flex-col w-full px-margin space-y-space-lg pb-10 max-w-[480px] mx-auto">
        <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface-container">
          <span className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary-container to-inverse-primary ring-4 ring-primary/20">
            <Icon name="person" fill className="text-on-primary-container" size={40} />
          </span>
          <input
            value={name}
            onChange={(e) => saveName(e.target.value)}
            className="bg-transparent text-center font-headline font-bold text-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg px-3 py-1 max-w-[240px]"
            aria-label="Your display name"
          />
          <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-[10px] font-bold uppercase tracking-wider">
            Pro · Local Engine
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Projects", value: stats.projects, icon: "folder" },
            { label: "Clips found", value: stats.clips, icon: "movie" },
            { label: "Rendered", value: stats.rendered, icon: "check_circle" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-container"
            >
              <Icon name={s.icon} size={18} className="text-primary" />
              <span className="font-headline font-extrabold text-xl text-on-surface">
                {s.value}
              </span>
              <span className="text-[9px] font-bold text-outline uppercase tracking-wide">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col rounded-2xl bg-surface-container p-space-md gap-3">
          <span className="font-headline font-semibold text-[15px] text-on-surface">
            Engine Status
          </span>
          {[
            { key: "ytdlp", label: "yt-dlp (YouTube extractor)", desc: "Downloads video & transcripts" },
            { key: "ffmpeg", label: "FFmpeg (video renderer)", desc: "Cuts, crops & burns captions" },
            { key: "deno", label: "Deno (JS runtime)", desc: "Solves YouTube challenges" },
          ].map((b) => {
            const ok = engine ? engine[b.key as keyof typeof engine] : null;
            return (
              <div key={b.key} className="flex items-center gap-3">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    ok === null ? "bg-outline animate-pulse" : ok ? "bg-secondary" : "bg-error"
                  }`}
                />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-on-surface">{b.label}</p>
                  <p className="text-[10px] text-outline font-body">{b.desc}</p>
                </div>
                <span
                  className={`text-[10px] font-bold ${ok ? "text-secondary" : ok === null ? "text-outline" : "text-error"}`}
                >
                  {ok === null ? "Checking…" : ok ? "Ready" : "Missing"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col rounded-2xl bg-surface-container p-space-md gap-2">
          <span className="font-headline font-semibold text-[15px] text-on-surface">
            How it works
          </span>
          {[
            "Paste a YouTube URL — the engine fetches metadata & the full transcript.",
            "AI scoring ranks every segment by hook strength, energy, pacing & story completeness.",
            "Top segments are cut, reframed to 9:16, and burned with animated captions.",
            "Edit subtitles word-by-word, re-render, then download MP4 or SRT.",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-on-surface-variant font-body leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col rounded-2xl bg-surface-container p-space-md gap-2">
          <span className="font-headline font-semibold text-[15px] text-on-surface">
            Storage &amp; privacy
          </span>
          <p className="text-xs text-on-surface-variant font-body leading-relaxed">
            Everything runs locally on your machine — videos, transcripts and renders are stored in the
            project&apos;s <code className="text-primary">data/</code> folder. No cloud upload, no API keys,
            no monthly fees. Only clip videos you own or have permission to use.
          </p>
          <Link
            href="/clips"
            className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-fixed"
          >
            Manage projects &amp; free up space
            <Icon name="chevron_right" size={14} />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}