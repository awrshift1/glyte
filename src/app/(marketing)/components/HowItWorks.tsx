"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/animations";
import { Upload, Sparkles, LayoutDashboard } from "lucide-react";

const steps = [
  {
    icon: Upload,
    color: "#2563eb",
    title: "Upload",
    body: "Drop your CSV, TSV, or Excel file. Any size, any schema.",
  },
  {
    icon: Sparkles,
    color: "#06b6d4",
    title: "AI Analyzes",
    body: "Glyte profiles your data, detects types, and picks the right charts. Automatically.",
  },
  {
    icon: LayoutDashboard,
    color: "#22c55e",
    title: "Dashboard",
    body: "Interactive charts, cross-filters, and an AI sidebar that speaks SQL. Ready in seconds.",
  },
] as const;

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<HTMLDivElement[]>([]);
  cardRefs.current = [];

  useGSAP(
    () => {
      if (!headingRef.current) return;
      gsap.from(headingRef.current, {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: { trigger: headingRef.current, start: "top 85%" },
      });
    },
    { scope: sectionRef }
  );

  useGSAP(
    () => {
      const cards = cardRefs.current.filter(Boolean);
      if (!cards.length) return;
      gsap.from(cards, {
        opacity: 0,
        y: 60,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: { trigger: cards[0], start: "top 85%" },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="px-6 md:px-16 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div ref={headingRef} className="text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-[#94a3b8]">
            HOW IT WORKS
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#f1f5f9] mt-3 font-[var(--font-space-grotesk)]">
            Three steps. Zero configuration.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          {steps.map((step, i) => (
            <div
              key={step.title}
              ref={(el) => {
                if (el) cardRefs.current[i] = el;
              }}
              className="bg-[#1e293b] border border-[#334155] rounded-lg p-6 md:p-8"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${step.color}1a` }}
              >
                <step.icon className="w-6 h-6" style={{ color: step.color }} />
              </div>
              <h3 className="text-xl font-semibold text-[#f1f5f9] mt-4">
                {step.title}
              </h3>
              <p className="text-[#94a3b8] mt-2 text-sm">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
