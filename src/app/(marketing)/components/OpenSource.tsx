"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/animations";

const techBadges = [
  "Next.js 16",
  "DuckDB",
  "Claude AI",
  "TypeScript",
  "Tailwind CSS",
];

export default function OpenSource() {
  const cardRef = useRef<HTMLDivElement>(null);
  const starRef = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      if (!cardRef.current || !starRef.current) return;

      const counter = { value: 0 };
      const tl = gsap.timeline({
        scrollTrigger: { trigger: cardRef.current, start: "top 85%" },
      });

      tl.from(cardRef.current, {
        opacity: 0,
        scale: 0.92,
        duration: 0.8,
        ease: "power2.out",
      });

      tl.to(counter, {
        value: 0, // placeholder — will be dynamic later
        duration: 1.5,
        ease: "power1.inOut",
        snap: { value: 1 },
        onStart: () => {
          starRef.current!.textContent = "0";
        },
        onUpdate: () => {
          starRef.current!.textContent = new Intl.NumberFormat(
            "en-US"
          ).format(Math.round(counter.value));
        },
      });
    },
    { scope: cardRef }
  );

  return (
    <section className="px-6 md:px-16 py-20 md:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-[#94a3b8]">
          OPEN SOURCE
        </p>

        <h2 className="text-3xl md:text-4xl font-bold text-[#f1f5f9] mt-4">
          Built in the open. Free forever.
        </h2>

        <p className="text-[#94a3b8] mt-4 max-w-2xl mx-auto">
          No vendor lock-in. No premium tier. No &ldquo;contact sales.&rdquo;
          Glyte is MIT-licensed and always will be.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          {techBadges.map((badge) => (
            <span
              key={badge}
              className="px-3 py-1.5 rounded-full border border-[#334155] bg-[#1e293b] text-xs text-[#94a3b8] font-medium"
            >
              {badge}
            </span>
          ))}
        </div>

        <div
          ref={cardRef}
          className="bg-[#1e293b] border border-[#334155] rounded-xl p-8 mt-12 inline-block"
        >
          <p
            ref={starRef}
            className="text-5xl font-bold text-[#f1f5f9]"
          >
            0
          </p>
          <p className="text-sm text-[#94a3b8] mt-2">GitHub Stars</p>
          <p className="text-sm text-[#64748b] mt-4">
            Star us on GitHub to follow the journey.
          </p>
        </div>
      </div>
    </section>
  );
}
