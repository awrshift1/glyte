"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

const BEATS = [
  "The dashboard that builds itself.",
  "Upload CSV. Get charts. No config.",
  "Open source. Free forever.",
];

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

function beatOpacity(progress: number, index: number): number {
  const segSize = 1 / BEATS.length;
  const start = index * segSize;
  const local = (progress - start) / segSize;
  const fade = 0.2;
  if (local <= 0 || local >= 1) return 0;
  if (local < fade) return local / fade;
  if (local > 1 - fade) return (1 - local) / fade;
  return 1;
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scrollable = el.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const raw = -rect.top / scrollable;
    setProgress(clamp(raw));
  }, []);

  useEffect(() => {
    let raf: number;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(handleScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [handleScroll]);

  return (
    <section
      ref={sectionRef}
      id="hero-scroll"
      className="relative h-[200vh] bg-[#0f1729]"
    >
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center px-6">
        {/* Mascot */}
        <div className="animate-float rounded-full shadow-[0_0_40px_rgba(6,182,212,0.3)]">
          <Image
            src="/images/mascot/v3-01-idle.png"
            alt="Glyte mascot"
            width={280}
            height={280}
            priority
            className="h-[200px] w-[200px] md:h-[280px] md:w-[280px]"
          />
        </div>

        {/* ScrollTextBeats */}
        <div className="relative mt-8 h-24 w-full max-w-3xl md:h-32">
          {BEATS.map((beat, i) => (
            <p
              key={i}
              className="absolute inset-0 flex items-center justify-center text-center font-[var(--font-space-grotesk)] text-4xl font-bold text-[#f1f5f9] md:text-6xl"
              style={{ opacity: beatOpacity(progress, i) }}
            >
              {beat}
            </p>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/home"
            className="rounded-lg bg-gradient-to-r from-[#2563eb] to-[#06b6d4] px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          >
            Upload Your CSV
          </Link>
          <Link
            href="/home"
            className="text-sm text-[#94a3b8] underline transition-colors hover:text-[#cbd5e1]"
          >
            or try sample data
          </Link>
        </div>
      </div>
    </section>
  );
}
