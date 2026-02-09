"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SceneShell } from "@/components/SceneShell";
import { ReturnButton } from "@/components/ReturnButton";
import { projectVideos } from "@/lib/portalData";

function PhoneReels({
  items,
}: {
  items: {
    id: string;
    title: string;
    subtitle?: string;
    embedUrl?: string;
    mp4Url?: string;
  }[];
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      const h = el.clientHeight || 1;
      const idx = Math.round(el.scrollTop / h);
      setActive(Math.max(0, Math.min(items.length - 1, idx)));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length]);

  useEffect(() => {
    // Pause everything, then play the active slide if it's an MP4.
    videoRefs.current.forEach((v, idx) => {
      if (!v) return;
      if (idx === active) {
        const p = v.play();
        // Autoplay can be blocked; ignore.
        if (p && typeof p.catch === "function") p.catch(() => {});
      } else {
        v.pause();
        v.currentTime = 0;
      }
    });
  }, [active]);

  return (
    <div className="absolute inset-[18px] rounded-[2.75rem] overflow-hidden">
      <div
        ref={scrollerRef}
        className="h-full w-full overflow-y-auto overscroll-contain snap-y snap-mandatory bg-black"
      >
        {items.map((v, i) => (
          <section key={v.id} className="relative h-full w-full snap-start">
            <div className="absolute inset-0">
              {v.mp4Url ? (
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  src={v.mp4Url}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                  loop
                  controls={false}
                  preload="metadata"
                />
              ) : v.embedUrl ? (
                <iframe
                  className="h-full w-full"
                  src={v.embedUrl}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  referrerPolicy="no-referrer"
                  title={v.title}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
                  Add <span className="mx-1 font-mono text-white/70">mp4Url</span> or{" "}
                  <span className="mx-1 font-mono text-white/70">embedUrl</span> in{" "}
                  <span className="font-mono text-white/70">src/lib/portalData.ts</span>
                </div>
              )}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.12),rgba(0,0,0,0.85)_70%)] opacity-60 pointer-events-none" />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-none">
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl px-4 py-3 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
                <div className="text-sm font-medium tracking-tight">{v.title}</div>
                {v.subtitle ? (
                  <div className="mt-1 text-xs text-white/60">{v.subtitle}</div>
                ) : null}
                <div className="mt-2 text-[11px] text-white/45">
                  {i === 0 ? "Scroll to browse (snap scrolling)." : " "}
                </div>
              </div>
            </div>

            {/* Tiny side affordance like a reels scrollbar */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-28 w-[3px] rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-1/3 w-full bg-white/35"
                style={{
                  transform: `translateY(${(active / Math.max(1, items.length - 1)) * 200}%)`,
                }}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [impact, setImpact] = useState(false);

  const items = useMemo(() => projectVideos, []);

  useEffect(() => {
    const t = window.setTimeout(() => setImpact(true), 1300);
    const t2 = window.setTimeout(() => setImpact(false), 1650);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="relative">
      <ReturnButton label="Click to stay in the Chloeverse" />

      <SceneShell title="PROJECTS" subtitle="A black sky, a quiet field, and a phone that drops from nowhere.">
        <div className="relative flex justify-center">
          {/* "Field" illusion */}
          <div className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 w-[140%] max-w-[1100px] h-[520px] rounded-[999px] bg-[radial-gradient(ellipse_at_center,rgba(120,190,120,0.12),rgba(0,0,0,0)_70%)] blur-2xl opacity-60" />
          <div className="pointer-events-none absolute left-1/2 top-[64%] -translate-x-1/2 w-[120%] max-w-[1000px] h-[260px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),rgba(0,0,0,0)_70%)] blur-2xl opacity-60" />

          {/* Impact dust */}
          <AnimatePresence>
            {impact ? (
              <motion.div
                className="pointer-events-none absolute left-1/2 top-[64%] -translate-x-1/2 w-[520px] h-[260px] rounded-[999px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14),rgba(0,0,0,0)_70%)] blur-2xl"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1.05 }}
                exit={{ opacity: 0, scale: 1.25 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
            ) : null}
          </AnimatePresence>

          {/* Phone drop - slowed down */}
          <motion.div
            className="relative w-[360px] h-[720px] md:w-[400px] md:h-[780px]"
            initial={{ y: -560, rotateX: 16, scale: 0.95, filter: "blur(1px)" }}
            animate={{
              y: 0,
              rotateX: 0,
              scale: 1,
              filter: "blur(0px)",
            }}
            transition={{
              type: "spring",
              stiffness: 55,
              damping: 18,
              mass: 1.25,
              delay: 0.35,
            }}
          >
            {/* Shadow + bloom */}
            <motion.div
              className="pointer-events-none absolute left-1/2 -bottom-10 -translate-x-1/2 w-[420px] h-28 rounded-[999px] bg-black/60 blur-2xl"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 0.9, scale: 1 }}
              transition={{ delay: 0.85, duration: 0.6, ease: "easeOut" }}
            />
            <motion.div
              className="pointer-events-none absolute left-1/2 -bottom-12 -translate-x-1/2 w-[520px] h-36 rounded-[999px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.18),rgba(0,0,0,0)_70%)] blur-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.65 }}
              transition={{ delay: 1.05, duration: 0.7, ease: "easeOut" }}
            />

            {/* Phone body */}
            <div className="absolute inset-0 rounded-[3.2rem] border border-white/10 bg-gradient-to-b from-white/10 to-black/40 shadow-[0_60px_120px_rgba(0,0,0,0.8)] backdrop-blur-xl" />
            <div className="absolute inset-[10px] rounded-[2.85rem] border border-white/10 bg-black/40" />
            <div className="absolute left-1/2 top-4 -translate-x-1/2 h-3 w-24 rounded-full bg-black/70 border border-white/10" />

            {/* Reels feed inside the phone */}
            <PhoneReels items={items} />
          </motion.div>
        </div>
      </SceneShell>
    </div>
  );
}
