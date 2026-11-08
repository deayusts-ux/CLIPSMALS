"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { CaptionPreview } from "@/components/CaptionPreview";
import { STUDIO_DEMO } from "@/lib/studio";
import { TEMPLATE_META, type CaptionTemplate } from "@/lib/types";

export default function TemplatesPage() {
  const [selected, setSelected] = useState<CaptionTemplate>("hormozi");

  const applyTemplate = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("klipviral-settings") || "{}");
      localStorage.setItem(
        "klipviral-settings",
        JSON.stringify({ ...saved, template: selected })
      );
    } catch {}
    window.location.href = "/?template=" + selected;
  };

  return (
    <AppShell>
      <div className="flex flex-col w-full px-margin space-y-space-lg pb-10 max-w-[480px] mx-auto">
        <div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">
            Caption Templates
          </h1>
          <p className="text-xs text-on-surface-variant font-body mt-1">
            Kinetic typography styles burned into every clip. Preview the animation live, then apply.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(TEMPLATE_META) as CaptionTemplate[]).map((key) => {
            const meta = TEMPLATE_META[key];
            const isSelected = selected === key;
            const featured = key === "studio";
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`${
                  featured ? "grid grid-cols-[42%_1fr] col-span-2" : "flex flex-col"
                } rounded-2xl overflow-hidden text-left transition-all ${
                  isSelected
                    ? "ring-2 ring-primary shadow-glow-primary"
                    : "ring-1 ring-white/10 hover:ring-primary/40"
                }`}
              >
                <div className="relative aspect-[9/16] bg-gradient-to-br from-surface-container-high via-surface-container-lowest to-black overflow-hidden">
                  <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_30%,#a078ff33,transparent_60%)]" />
                  <CaptionPreview
                    template={key}
                    cues={featured ? STUDIO_DEMO : undefined}
                    title={featured ? "The fastest way to master a new skill" : undefined}
                    className="absolute inset-0"
                  />
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Icon name="check" fill className="text-on-primary" size={16} />
                    </span>
                  )}
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-bold text-white uppercase tracking-wider">
                    Live preview
                  </span>
                  {featured && (
                    <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-[#E8262D] text-[8px] font-bold text-white uppercase tracking-wider">
                      New
                    </span>
                  )}
                </div>
                <div className={`p-3 bg-surface-container ${featured ? "flex flex-col justify-center p-4" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-headline font-semibold text-[13px] text-on-surface">
                      {meta.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold ${
                        key === "hormozi"
                          ? "text-primary"
                          : key === "beast"
                            ? "text-error"
                            : key === "cyber"
                              ? "text-secondary"
                              : key === "studio"
                                ? "text-[#FF6B6B]"
                                : "text-outline"
                      }`}
                    >
                      {meta.tag}
                    </span>
                  </div>
                  <p className="text-[10px] text-outline font-body mt-1 leading-snug">
                    {meta.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={applyTemplate}
          className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-headline font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-glow-primary"
        >
          <Icon name="check_circle" fill size={18} />
          Use {TEMPLATE_META[selected].name} for next clips
        </button>
      </div>
    </AppShell>
  );
}