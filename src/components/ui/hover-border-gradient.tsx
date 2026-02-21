"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type HoverBorderGradientProps<T extends React.ElementType> = {
  as?: T;
  containerClassName?: string;
  className?: string;
  tilt?: boolean;
  maxTilt?: number;
  scale?: number;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className">;

const HoverBorderGradient = React.forwardRef(
  <T extends React.ElementType = "button">(
    {
      as,
      className,
      containerClassName,
      tilt = true,
      maxTilt = 8,
      scale = 1.02,
      onMouseMove,
      onMouseLeave,
      children,
      ...props
    }: HoverBorderGradientProps<T>,
    ref: React.Ref<Element>
  ) => {
    const Component = as || "button";
    const innerRef = React.useRef<HTMLSpanElement>(null);
    const frameRef = React.useRef<number | null>(null);

    const handleMove = (event: React.MouseEvent) => {
      if (!tilt || !innerRef.current) return;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const rotateX = (0.5 - y) * 2 * maxTilt;
      const rotateY = (x - 0.5) * 2 * maxTilt;

      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        innerRef.current!.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
      });
    };

    const handleLeave = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (innerRef.current) {
        innerRef.current.style.transform =
          "perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)";
      }
    };

    return (
      <Component
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center overflow-hidden rounded-lg p-[1px]",
          containerClassName
        )}
        onMouseMove={(event) => {
          onMouseMove?.(event);
          handleMove(event);
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          handleLeave();
        }}
        {...props}
      >
        <span className="absolute inset-0 rounded-[inherit] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(255,255,255,0.12),rgba(255,255,255,0.5),rgba(255,255,255,0.12))] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span
          ref={innerRef}
          className={cn(
            "relative z-10 inline-flex items-center justify-center rounded-[inherit] bg-[#1e293b] text-white transition-transform duration-200 will-change-transform",
            className
          )}
        >
          {children}
        </span>
      </Component>
    );
  }
);

HoverBorderGradient.displayName = "HoverBorderGradient";

export { HoverBorderGradient };
