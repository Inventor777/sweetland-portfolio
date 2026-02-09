"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SceneShell } from "@/components/SceneShell";
import { ReturnButton } from "@/components/ReturnButton";
import { contactInfo } from "@/lib/portalData";

export default function ContactPage() {
  const [assembled, setAssembled] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [pickedUp, setPickedUp] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setAssembled(true), 450);
    const t2 = window.setTimeout(() => setRinging(true), 1100);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="relative">
      <ReturnButton />

      <SceneShell title="CONTACT" subtitle="A phone reconstructs itself. Then it rings until you answer.">
        <div className="relative mx-auto w-full max-w-6xl">
          <div className="flex items-start justify-center">
            <div className="relative">
              {/* Phone (bigger) */}
              <div className="relative w-[520px] h-[520px] md:w-[560px] md:h-[560px]">
                {/* Base */}
                <motion.div
                  className="absolute left-1/2 top-[240px] -translate-x-1/2 w-[420px] h-[230px] rounded-[3.25rem] border border-white/10 bg-gradient-to-b from-white/10 to-black/40 backdrop-blur-xl shadow-[0_60px_120px_rgba(0,0,0,0.8)]"
                  initial={{ opacity: 0, y: 60, scale: 0.92 }}
                  animate={
                    assembled
                      ? { opacity: 1, y: 0, scale: 1 }
                      : { opacity: 0, y: 60, scale: 0.92 }
                  }
                  transition={{ duration: 0.75, ease: "easeOut" }}
                />

                {/* Dial plate */}
                <motion.div
                  className="absolute left-1/2 top-[300px] -translate-x-1/2 w-[240px] h-[160px] rounded-[2.5rem] border border-white/10 bg-black/40"
                  initial={{ opacity: 0, scale: 0.86 }}
                  animate={assembled ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.86 }}
                  transition={{ duration: 0.75, ease: "easeOut", delay: 0.1 }}
                >
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border border-white/15 bg-black/40" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 border border-white/10" />
                </motion.div>

                {/* Handset */}
                <motion.button
                  className="absolute left-1/2 top-[140px] -translate-x-1/2 w-[500px] h-[120px] rounded-[999px] border border-white/10 bg-gradient-to-b from-white/12 to-black/45 backdrop-blur-xl shadow-[0_60px_120px_rgba(0,0,0,0.8)] flex items-center justify-center text-sm text-white/70"
                  initial={{ opacity: 0, y: -30, rotateZ: -12 }}
                  animate={
                    assembled
                      ? {
                          opacity: 1,
                          y: 0,
                          rotateZ: pickedUp ? -18 : ringing ? [-2, 2, -2] : 0,
                          x: pickedUp ? 70 : 0,
                        }
                      : { opacity: 0, y: -30, rotateZ: -12 }
                  }
                  transition={{
                    duration: 0.75,
                    ease: "easeOut",
                    delay: 0.2,
                    repeat: ringing && !pickedUp ? Infinity : 0,
                    repeatType: "mirror",
                  }}
                  onClick={() => {
                    if (!assembled) return;
                    setPickedUp(true);
                    setRinging(false);
                  }}
                >
                  {!pickedUp ? (ringing ? "CLICK TO ANSWER" : "…") : "CONNECTED"}
                </motion.button>

                {/* Ring ripple (stronger) */}
                <AnimatePresence>
                  {ringing && !pickedUp ? (
                    <motion.div
                      className="pointer-events-none absolute left-1/2 top-[145px] -translate-x-1/2 w-[520px] h-[170px] rounded-[999px] border border-white/15"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: [0.0, 0.55, 0.0], scale: [0.9, 1.08, 1.18] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.05, repeat: Infinity, ease: "easeOut" }}
                    />
                  ) : null}
                </AnimatePresence>

                <div className="absolute left-1/2 top-[500px] -translate-x-1/2 text-xs text-white/50">
                  {!pickedUp ? "Click the handset." : "Answer detected."}
                </div>
              </div>
            </div>
          </div>

          {/* Media card only appears after pickup */}
          <AnimatePresence>
            {pickedUp ? (
              <>
                {/* Desktop: card slides out from the phone gap */}
                <motion.div
                  className="hidden lg:block absolute left-1/2 top-[190px] -translate-x-1/2 w-[440px]"
                  initial={{ opacity: 0, x: -140, scale: 0.4, filter: "blur(2px)" }}
                  animate={{ opacity: 1, x: 360, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: 260, scale: 0.98 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                >
                  <div className="rounded-3xl border border-white/10 bg-black/50 p-6 backdrop-blur-xl shadow-[0_60px_120px_rgba(0,0,0,0.8)]">
                    <div className="text-xs tracking-[0.35em] text-white/50">CONTACT</div>
                    <div className="mt-3 text-2xl font-semibold tracking-tight">Let’s build something unreal.</div>

                    <div className="mt-6 space-y-3">
                      {contactInfo.map((c) => (
                        <div
                          key={c.label}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <div className="text-sm text-white/70">{c.label}</div>
                          <div className="text-sm text-white/85">{c.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 text-xs text-white/45">
                      Edit handles in <span className="font-mono text-white/60">src/lib/portalData.ts</span>
                    </div>
                  </div>
                </motion.div>

                {/* Mobile: card appears below */}
                <motion.div
                  className="lg:hidden mt-10 mx-auto w-full max-w-md"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <div className="rounded-3xl border border-white/10 bg-black/50 p-6 backdrop-blur-xl">
                    <div className="text-xs tracking-[0.35em] text-white/50">CONTACT</div>
                    <div className="mt-3 text-2xl font-semibold tracking-tight">Let’s build something unreal.</div>

                    <div className="mt-6 space-y-3">
                      {contactInfo.map((c) => (
                        <div
                          key={c.label}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <div className="text-sm text-white/70">{c.label}</div>
                          <div className="text-sm text-white/85">{c.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 text-xs text-white/45">
                      Edit handles in <span className="font-mono text-white/60">src/lib/portalData.ts</span>
                    </div>
                  </div>
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </div>
      </SceneShell>
    </div>
  );
}
