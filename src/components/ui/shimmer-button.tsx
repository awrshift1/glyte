"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ShimmerButtonProps<T extends React.ElementType> = {
  as?: T;
  containerClassName?: string;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className">;

const ShimmerButton = React.forwardRef(
  <T extends React.ElementType = "button">(
    { as, className, containerClassName, children, ...props }: ShimmerButtonProps<T>,
    ref: React.Ref<HTMLElement>
  ) => {
    const Component = (as || "button") as React.ElementType;

    return (
      <Component
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white text-black shadow-[0_20px_50px_rgba(0,0,0,0.35)]",
          containerClassName
        )}
        {...props}
      >
        <span className="pointer-events-none absolute inset-0 opacity-60">
          <span className="absolute -inset-full animate-shimmer bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.7)_40%,transparent_70%)]" />
        </span>
        <span className={cn("relative z-10 inline-flex items-center gap-2", className)}>
          {children}
        </span>
      </Component>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";

export { ShimmerButton };
