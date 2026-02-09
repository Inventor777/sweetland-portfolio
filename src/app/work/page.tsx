"use client";

import { useEffect, useMemo, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { SceneShell } from "@/components/SceneShell";
import { ReturnButton } from "@/components/ReturnButton";
import { workTerminalSections } from "@/lib/portalData";

function useTyping(lines: string[], start: boolean) {
  const [out, setOut] = useState<string[]>([]);
  useEffect(() => {
    if (!start) return;
    let i = 0;
    setOut([]);
    const id = window.setInterval(() => {
      setOut((p) => [...p, lines[i]]);
      i++;
      if (i >= lines.length) window.clearInterval(id);
    }, 230);
    return () => window.clearInterval(id);
  }, [start, lines]);
  return out;
}

export default function WorkPage() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  const x = useMotionValue(0);
  const progress = useTransform(x, [0, 220], ["0%", "100%"]);

  const bootLines = useMemo(
    () => ["AUTHENTICATING…", "VERIFYING CREDENTIALS…", "CHECKING ACCESS LEVEL…", "LOADING PROFILE…", "READY."],
    []
  );

  const typed = useTyping(bootLines, authed);

  useEffect(() => {
    if (!authed) return;
    if (typed.length === bootLines.length) {
      const t = window.setTimeout(() => setReady(true), 350);
      return () => window.clearTimeout(t);
    }
  }, [authed, typed.length, bootLines.length]);

  return (
    <div className="relative">
      <ReturnButton />

      <SceneShell title="WORK" subtitle="Swipe to authenticate. Then scroll the profile in-terminal.">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] items-start">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="text-xs tracking-[0.3em] text-white/50">ACCESS</div>

            <div className="mt-6 space-y-5">
              <motion.div
                className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/12 to-white/6 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
                style={{ x }}
                drag={!authed ? "x" : false}
                dragConstraints={{ left: 0, right: 220 }}
                dragElastic={0.08}
                onDragEnd={() => {
                  const val = x.get();
                  if (val > 180) {
                    setAuthed(true);
                    animate(x, 220, { type: "spring", stiffness: 240, damping: 26 });
                  } else {
                    animate(x, 0, { type: "spring", stiffness: 240, damping: 26 });
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium tracking-tight">CHLOE</div>
                    <div className="mt-1 text-xs text-white/60">CREATOR • STRATEGY</div>
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                    VERIFIED
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[10px] tracking-[0.35em] text-white/40">ID</div>
                  <div className="mt-2 h-10 w-full rounded-lg bg-white/10" />
                </div>

                <div className="mt-4 text-xs text-white/50 flex items-center justify-between">
                  <span>{!authed ? "DRAG TO SWIPE" : "ACCESS GRANTED"}</span>
                  {!authed ? (
                    <span className="text-white/40 font-mono">→</span>
                  ) : null}
                </div>
              </motion.div>

              <div className="relative h-16 rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0)_100%)] opacity-40" />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white/50">CARD READER</div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">→</div>

                {/* Live progress fill so the swipe reads as "doing something" */}
                <motion.div
                  className="absolute left-0 top-0 h-full bg-white/10"
                  style={{ width: progress }}
                />

                {/* Scan flash after auth */}
                {authed ? (
                  <motion.div
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.22)_50%,rgba(255,255,255,0)_100%)]"
                    initial={{ x: "-80%", opacity: 0 }}
                    animate={{ x: "80%", opacity: [0, 1, 0] }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                  />
                ) : null}
              </div>

              <p className="text-sm text-white/60">This portal stays inside the Chloeverse. No redirect needed.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="text-xs tracking-[0.3em] text-white/50">TERMINAL</div>
              <div className="text-xs text-white/40 font-mono">imchloekang://work</div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/70 p-5 font-mono">
              {!authed ? (
                <div className="text-white/60">
                  <span className="text-white/40">{"$"}</span> SWIPE BADGE TO CONTINUE
                  <span className="ml-2 inline-block h-4 w-2 bg-white/40 align-[-3px] animate-pulse" />
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {typed.map((l, i) => (
                    <div key={i} className="text-white/70">
                      <span className="text-white/35">{"$"}</span> {l}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {ready ? (
              <div className="mt-6 max-h-[46vh] overflow-auto rounded-2xl border border-white/10 bg-white/5 p-5">
                {workTerminalSections.map((sec) => (
                  <div key={sec.heading} className="mb-7">
                    <div className="text-xs tracking-[0.35em] text-white/50">{sec.heading}</div>
                    <div className="mt-3 space-y-2 font-mono text-sm text-white/75">
                      {sec.body.map((line, idx) => (
                        <div key={idx}>{line}</div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="pt-2 text-xs text-white/45">
                  Edit this content in <span className="font-mono text-white/60">src/lib/portalData.ts</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </SceneShell>
    </div>
  );
}
