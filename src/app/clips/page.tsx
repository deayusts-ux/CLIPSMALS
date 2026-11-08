"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { ClipEditor } from "@/components/ClipEditor";
import {
  formatTimestamp,
  timeAgo,
  type Project,
} from "@/lib/types";

interface ProjectSummary {
  id: string;
  video: { title: string; thumbnail: string; duration: number; channel: string };
  clipCount: number;
  topScore: number;
  createdAt: number;
}

function ClipsInner() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadProjects = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadProject = useCallback(
    (id: string) => {
      setLoading(true);
      fetch(`/api/projects/${id}`)
        .then(async (r) => {
          if (!r.ok) throw new Error("Project not found");
          return r.json();
        })
        .then((p: Project) => {
          setProject(p);
          setError("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (projectId) loadProject(projectId);
    else {
      setProject(null);
      setLoading(false);
    }
  }, [projectId, loadProject]);

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Delete this project and all its clips?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    loadProjects();
    if (projectId === id) {
      setProject(null);
      window.history.replaceState(null, "", "/clips");
    }
  };

  const editingClip = project?.clips.find((c) => c.id === editingClipId) || null;

  return (
    <div className="flex flex-col w-full px-margin space-y-space-lg pb-10 max-w-[480px] mx-auto">
      {project ? (
        <>
          <div className="flex items-center gap-2">
            <Link
              href="/clips"
              className="p-2 -ml-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              <Icon name="arrow_back" size={20} />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="font-headline font-bold text-lg text-on-surface truncate">
                {project.video.title}
              </h1>
              <p className="text-[11px] text-outline font-body truncate">
                {project.video.channel} · {formatTimestamp(project.video.duration)} ·{" "}
                {project.transcriptSource === "manual" ? "Manual captions" : project.transcriptSource === "auto" ? "Auto captions" : "No captions"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/10 border border-secondary/20">
            <Icon name="auto_awesome" size={16} className="text-secondary" />
            <span className="text-xs font-body text-on-surface">
              <strong className="text-secondary">{project.clips.length} viral-ready clips</strong> detected — sorted by viral score. Tap a clip to preview, edit subtitles &amp; export.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {project.clips.map((clip) => (
              <button
                key={clip.id}
                onClick={() => setEditingClipId(clip.id)}
                className="flex flex-col rounded-2xl bg-surface-container overflow-hidden text-left hover:bg-surface-container-high transition-colors ring-1 ring-white/5 hover:ring-primary/40"
              >
                <div className="relative aspect-[9/16] bg-surface-container-lowest overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.video.thumbnail}
                    alt={clip.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
                  <span
                    className={`absolute top-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      clip.score >= 75
                        ? "bg-secondary/15 text-secondary border-secondary/50"
                        : clip.score >= 55
                          ? "bg-tertiary/15 text-tertiary border-tertiary/50"
                          : "bg-surface-container/70 text-on-surface-variant border-outline/40"
                    }`}
                  >
                    <Icon name="local_fire_department" fill size={11} />
                    {clip.score}
                  </span>
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-tertiary/15 border border-tertiary/50 text-tertiary text-[9px] font-bold">
                    HOOK {formatTimestamp(clip.start)}
                  </span>
                  <div className="absolute bottom-0 inset-x-0 p-2.5">
                    <p className="text-[11px] font-headline font-semibold text-white leading-snug line-clamp-3">
                      {clip.title}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="px-1 py-0.5 rounded bg-black/70 text-[9px] font-bold text-white">
                        {formatTimestamp(clip.end - clip.start)}
                      </span>
                      {clip.renderedUrl && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-secondary">
                          <Icon name="check_circle" fill size={11} /> Rendered
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                    <span className="w-11 h-11 rounded-full bg-primary/90 flex items-center justify-center shadow-glow-primary">
                      <Icon name="play_arrow" fill className="text-on-primary" size={26} />
                    </span>
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-[10px] text-outline font-body line-clamp-2 leading-snug">
                    {clip.hookText}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {clip.reasons.slice(0, 2).map((r) => (
                      <span
                        key={r}
                        className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-[8px] font-bold"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="font-headline font-bold text-2xl text-on-surface">Your Clips</h1>
            <span className="text-[10px] font-bold text-outline">
              {projects.reduce((a, p) => a + p.clipCount, 0)} clips · {projects.length} projects
            </span>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-[9/16] rounded-2xl skeleton" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-error-container/30 border border-error/30 text-on-error-container text-sm">
              {error}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-surface-container text-center">
              <span className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
                <Icon name="movie" className="text-primary" size={28} />
              </span>
              <p className="font-headline font-semibold text-on-surface">No clips yet</p>
              <p className="text-xs text-outline font-body max-w-[240px]">
                Paste a YouTube link on the Generate tab and let the AI find the best moments.
              </p>
              <Link
                href="/"
                className="mt-1 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold"
              >
                Generate your first clip
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container hover:bg-surface-container-high transition-colors"
                >
                  <Link
                    href={`/clips?project=${p.id}`}
                    className="relative w-24 h-16 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.video.thumbnail}
                      alt={p.video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-surface-container-lowest/80 text-[9px] font-bold text-on-surface">
                      {formatTimestamp(p.video.duration)}
                    </span>
                  </Link>
                  <Link href={`/clips?project=${p.id}`} className="flex flex-col flex-1 min-w-0">
                    <span className="font-headline font-semibold text-[14px] text-on-surface truncate">
                      {p.video.title}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-secondary/15 text-secondary text-[10px] font-bold">
                        <Icon name="local_fire_department" fill size={11} /> {p.clipCount} Clips
                      </span>
                      <span className="text-[10px] font-bold text-outline">
                        Top score {p.topScore} · {timeAgo(p.createdAt)}
                      </span>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDeleteProject(p.id)}
                    className="p-2 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors"
                    aria-label="Delete project"
                  >
                    <Icon name="delete" size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editingClip && project && (
        <ClipEditor
          project={project}
          clip={editingClip}
          onClose={() => setEditingClipId(null)}
          onUpdate={(updated) => {
            setProject((prev) =>
              prev
                ? {
                    ...prev,
                    clips: prev.clips.map((c) =>
                      c.id === updated.id ? updated : c
                    ),
                  }
                : prev
            );
          }}
        />
      )}
    </div>
  );
}

export default function ClipsPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="px-margin max-w-[480px] mx-auto w-full">
            <div className="h-8 w-40 rounded-lg skeleton mb-4" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="aspect-[9/16] rounded-2xl skeleton" />
              ))}
            </div>
          </div>
        }
      >
        <ClipsInner />
      </Suspense>
    </AppShell>
  );
}