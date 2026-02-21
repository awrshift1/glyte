"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";

export type AiMode = "salesperson" | "analyst" | "guide";

interface AiContextValue {
  mode: AiMode;
  setMode: (mode: AiMode) => void;
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  pageContext: PageContext;
  setPageContext: (ctx: PageContext) => void;
}

interface PageContext {
  page: string;
  dashboardId?: string;
  dashboardTitle?: string;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AiMode>("salesperson");
  const [open, setOpen] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext>({ page: "home" });

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  const value = useMemo(
    () => ({ mode, setMode, open, toggle, setOpen, pageContext, setPageContext }),
    [mode, open, pageContext]
  );

  return (
    <AiContext.Provider value={value}>
      {children}
    </AiContext.Provider>
  );
}

export function useAi() {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used within AiProvider");
  return ctx;
}
