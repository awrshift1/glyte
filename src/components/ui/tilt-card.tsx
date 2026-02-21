"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TiltCardProps = React.HTMLAttributes<HTMLDivElement> & {
  containerClassName?: string;
  maxTilt?: number;
  scale?: number;
  glare?: boolean;
  tilt?: boolean;
};

const TiltCard = React.forwardRef<HTMLDivElement, TiltCardProps>(
  (
    {
      className,
      containerClassName,
      maxTilt = 10,
      scale = 1.02,
      glare = true,
      tilt = true,
      onMouseMove,
      onMouseLeave,
      children,
      ...props
    },
    ref
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const innerRef = React.useRef<HTMLDivElement>(null);
    const glareRef = React.useRef<HTMLDivElement>(null);
    const frameRef = React.useRef<number | null>(null);

    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    const updateTilt = (event: React.MouseEvent<HTMLDivElement>) => {
      if (!tilt) return;
      if (!containerRef.current || !innerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const rotateX = (0.5 - y) * 2 * maxTilt;
      const rotateY = (x - 0.5) * 2 * maxTilt;

      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        innerRef.current!.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
        if (glare && glareRef.current) {
          const xPct = Math.round(x * 100);
          const yPct = Math.round(y * 100);
          glareRef.current.style.opacity = "1";
          glareRef.current.style.background = `radial-gradient(circle at ${xPct}% ${yPct}%, rgba(255,255,255,0.22), rgba(255,255,255,0) 55%)`;
        }
      });
    };

    const resetTilt = () => {
      if (!tilt) return;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (innerRef.current) {
        innerRef.current.style.transform =
          "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";
      }
      if (glareRef.current) {
        glareRef.current.style.opacity = "0";
      }
    };

    return (
      <div
        ref={containerRef}
        className={cn("group relative", containerClassName)}
        onMouseMove={(event) => {
          onMouseMove?.(event);
          updateTilt(event);
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          resetTilt();
        }}
        {...props}
      >
        <div
          ref={innerRef}
          className={cn(
            "relative rounded-[22px] transition-transform duration-200 will-change-transform",
            className
          )}
        >
          <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_rgba(255,255,255,0)_55%)] opacity-40 blur-lg transition duration-500 group-hover:opacity-70" />
          {glare && (
            <div
              ref={glareRef}
              className="pointer-events-none absolute inset-0 rounded-[22px] opacity-0 transition-opacity duration-300"
            />
          )}
          <div className="relative">{children}</div>
        </div>
      </div>
    );
  }
);

TiltCard.displayName = "TiltCard";

export { TiltCard };
