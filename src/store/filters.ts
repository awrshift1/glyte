"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface Filter {
  column: string;
  value: string;
  source: string; // chart ID that created this filter
}

export function useFilterStore() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => {
    const params = searchParams.getAll("filter");
    return params.map((f) => {
      const [col, ...rest] = f.split(":");
      return { column: col, value: rest.join(":"), source: "" };
    });
  }, [searchParams]);

  const updateUrl = useCallback(
    (newFilters: Filter[]) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("filter");
      for (const f of newFilters) {
        params.append("filter", `${f.column}:${f.value}`);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? "?" + qs : ""}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const addFilter = useCallback(
    (filter: Filter) => {
      const exists = filters.find(
        (f) => f.column === filter.column && f.value === filter.value
      );
      if (exists) {
        // Toggle off
        updateUrl(
          filters.filter(
            (f) => !(f.column === filter.column && f.value === filter.value)
          )
        );
      } else {
        // Replace filter on same column (single-select per column)
        updateUrl([
          ...filters.filter((f) => f.column !== filter.column),
          filter,
        ]);
      }
    },
    [filters, updateUrl]
  );

  const removeFilter = useCallback(
    (column: string) => {
      updateUrl(filters.filter((f) => f.column !== column));
    },
    [filters, updateUrl]
  );

  const clearAll = useCallback(() => {
    updateUrl([]);
  }, [updateUrl]);

  return { filters, addFilter, removeFilter, clearAll };
}
