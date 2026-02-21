/**
 * Glyte Design Tokens
 * Source: Brand Book (projects/glyte-mascot/BRAND-BOOK.md)
 */

export const colors = {
  background: "#0f1729",
  surface: "#1e293b",
  border: "#334155",
  primary: "#2563eb",
  accent: "#06b6d4",
  success: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",
  info: "#3b82f6",
  text: {
    primary: "#f1f5f9",
    secondary: "#94a3b8",
    muted: "#64748b",
  },
  gradient: {
    from: "#2563eb",
    to: "#06b6d4",
  },
} as const;

export const fonts = {
  display: "'Space Grotesk', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const spacing = {
  sectionY: "py-20 md:py-28",
  sectionX: "px-6 md:px-16",
  maxWidth: "max-w-6xl",
  containerCenter: "mx-auto max-w-6xl",
} as const;

export const radius = {
  card: "rounded-lg",
  button: "rounded-lg",
  input: "rounded-md",
  tag: "rounded",
  full: "rounded-full",
} as const;

export const gradientText =
  "bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent";

export const glowCyan = "shadow-[0_0_40px_rgba(6,182,212,0.3)]";
