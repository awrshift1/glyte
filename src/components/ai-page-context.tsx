"use client";

import { useEffect } from "react";
import { useAi, type AiMode } from "./ai-provider";

/**
 * Sets AI mode and page context when a page mounts.
 * Place inside any page component.
 */
export function AiPageContext({ mode, page }: { mode: AiMode; page: string }) {
  const { setMode, setPageContext } = useAi();

  useEffect(() => {
    setMode(mode);
    setPageContext({ page });
  }, [mode, page, setMode, setPageContext]);

  return null;
}
