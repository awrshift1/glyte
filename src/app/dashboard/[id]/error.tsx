"use client";

import Link from "next/link";
import { Sidebar } from "@/components/sidebar";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Dashboard Error</h2>
          <p className="text-gray-400 text-sm mb-4 max-w-md">
            {error.message || "An unexpected error occurred"}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm hover:bg-[#1d4ed8]"
            >
              Retry
            </button>
            <Link
              href="/dashboards"
              className="px-4 py-2 border border-[#334155] text-gray-300 rounded-lg text-sm hover:bg-[#1e293b]"
            >
              All dashboards
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
