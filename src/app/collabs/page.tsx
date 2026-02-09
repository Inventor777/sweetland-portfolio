"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SceneShell } from "@/components/SceneShell";
import { ReturnButton } from "@/components/ReturnButton";
import { collabVideos } from "@/lib/portalData";

function Screen({
  item,
}: {
  item: { title: string; brand?: string; embedUrl?: string; mp4Url?: string };
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.6rem] border border-white/10 bg-black">
      {item.mp4Url ? (
        <video
          src={item.mp4Url}
          className="h-full w-full object-cover"
          playsInline
          muted
          loop
          controls={false}
          preload="metadata"
          autoPlay
        />
      ) : item.embedUrl ? (
        <iframe
          className="h-full w-full"
          src={item.embedUrl}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
          title={item.title}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
          Add <span className="mx-1 font-mono text-white/70">embedUrl</span>/<span className="font-mono text-white/70">mp4Url</span> in{" "}
          <span className="font-mono text-white/70">src/lib/portalData.ts</span>
        </div>
      )}

      {/* CRT vibe */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:100%_3px] opacity-25" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.14),rgba(0,0,0,0.88)_70%)] opacity-65" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.75)]" />

      <div className="pointer-events-none absolute left-6 bottom-5 right-6">
        <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl px-4 py-3">
          <div className="text-xs tracking-[0.3em] text-white/60">COMMERCIAL BREAK</div>
          <div className="mt-2 text-sm font-medium">{item.title}</div>
          {item.brand ? <div className="mt-1 text-xs text-white/55">{item.brand}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function CollabsPage() {
  const items = useMemo(() => collabVideos, []);
  const [ch, setCh] = useState(0);

  const active = items[Math.max(0, Math.min(items.length - 1, ch))];

  const next = () => setCh((p) => (p + 1) % items.length);
  const prev = () => setCh((p) => (p - 1 + items.length) % items.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") prev();
      if (e.key === "ArrowDown") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  return (
    <div className="relative">
      <ReturnButton />

      <SceneShell title="COLLABS" subtitle="Retro broadcast energy. Sponsored moments curated like channels.">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr] items-start">
          {/* Bigger TV */}
          <div className="relative">
            <div className="mx-auto w-full max-w-5xl rounded-[3rem] border border-white/10 bg-gradient-to-b from-white/10 to-black/40 p-7 shadow-[0_60px_120px_rgba(0,0,0,0.8)] backdrop-blur-xl">
              <div className="flex items-center justify-between px-2">
                <div className="text-xs tracking-[0.35em] text-white/55">COMMERCIAL BREAK IN PROGRESS</div>
                <div className="text-xs text-white/45 font-mono">CH {String(ch + 1).padStart(2, "0")}</div>
              </div>

              <div className="mt-5 aspect-[16/9] w-full">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active?.title || ch}
                    className="h-full w-full"
                    initial={{ opacity: 0, filter: "blur(2px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(2px)" }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <Screen item={active} />
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-6 flex items-center justify-between px-2 text-white/45">
                <div className="text-xs tracking-[0.35em]">CH {String(ch + 1).padStart(2, "0")}</div>
                <div className="flex gap-3">
                  <div className="h-3 w-3 rounded-full border border-white/15 bg-white/5" />
                  <div className="h-3 w-3 rounded-full border border-white/15 bg-white/5" />
                </div>
              </div>
            </div>

            {/* Ground/field hint */}
            <div className="pointer-events-none absolute left-1/2 top-[72%] -translate-x-1/2 w-[120%] max-w-[1100px] h-[420px] rounded-[999px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.10),rgba(0,0,0,0)_70%)] blur-3xl opacity-40" />
          </div>

          {/* Remote (replaces the list) */}
          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-[2.75rem] border border-white/10 bg-gradient-to-b from-white/10 to-black/40 p-7 backdrop-blur-xl shadow-[0_50px_120px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between">
                <div className="text-xs tracking-[0.35em] text-white/55">REMOTE</div>
                <div className="text-xs font-mono text-white/55">CH {String(ch + 1).padStart(2, "0")}</div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="text-xs text-white/50">Now playing</div>
                <div className="mt-2 text-sm font-medium">{active?.title}</div>
                <div className="mt-1 text-xs text-white/55">{active?.brand || "Brand Name"}</div>
              </div>

              <div className="mt-7 grid place-items-center gap-4">
                <button
                  onClick={prev}
                  className="h-14 w-14 rounded-2xl border border-white/12 bg-white/5 hover:bg-white/10 transition active:scale-[0.98]"
                  aria-label="Channel up"
                >
                  <ChevronUp className="mx-auto h-6 w-6 text-white/80" />
                </button>

                <div className="text-[11px] tracking-[0.35em] text-white/55">CHANNEL</div>

                <button
                  onClick={next}
                  className="h-14 w-14 rounded-2xl border border-white/12 bg-white/5 hover:bg-white/10 transition active:scale-[0.98]"
                  aria-label="Channel down"
                >
                  <ChevronDown className="mx-auto h-6 w-6 text-white/80" />
                </button>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-xs text-white/55">
                  VOL −
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-xs text-white/55">
                  VOL +
                </div>
              </div>

              <div className="mt-5 text-xs text-white/45">
                Tip: use <span className="font-mono text-white/60">↑</span>/<span className="font-mono text-white/60">↓</span> or tap buttons.
              </div>
            </div>
          </div>
        </div>
      </SceneShell>
    </div>
  );
}
