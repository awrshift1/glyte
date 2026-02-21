"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/animations";
import { BarChart3, MessageSquare, Filter, Plug } from "lucide-react";
import { TiltCard } from "@/components/ui/tilt-card";

const features = [
  {
    icon: BarChart3,
    color: "#2563eb",
    title: "Auto-Charts",
    body: "Upload data, get the right chart types. Bar, line, donut, KPI \u2014 detected automatically from your columns.",
  },
  {
    icon: MessageSquare,
    color: "#06b6d4",
    title: "AI Sidebar",
    body: "Ask questions in plain English. The AI writes SQL, runs it on DuckDB, and shows results inline.",
  },
  {
    icon: Filter,
    color: "#22c55e",
    title: "Cross-Filters",
    body: "Click any chart segment to filter everything else. No configuration, no query builder. Just click.",
  },
  {
    icon: Plug,
    color: "#a855f7",
    title: "MCP Server",
    body: "Connect Glyte to Claude, Cursor, or any MCP client. Your dashboards become AI-accessible tools.",
  },
] as const;

export function Features() {
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
            FEATURES
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#f1f5f9] mt-3 font-[var(--font-space-grotesk)]">
            Everything you need. Nothing you don&apos;t.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
          {features.map((feature, i) => (
            <TiltCard
              key={feature.title}
              ref={(el) => {
                if (el) cardRefs.current[i] = el;
              }}
              containerClassName="h-full"
              className="h-full rounded-xl border border-[#334155] bg-[#1e293b] p-6"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ backgroundColor: `${feature.color}1a` }}
              >
                <feature.icon
                  className="w-5 h-5"
                  style={{ color: feature.color }}
                />
              </div>
              <h3 className="text-lg font-semibold text-[#f1f5f9]">
                {feature.title}
              </h3>
              <p className="text-[#94a3b8] text-sm mt-2">{feature.body}</p>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
