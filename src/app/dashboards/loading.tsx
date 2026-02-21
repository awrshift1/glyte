import { Sidebar } from "@/components/sidebar";

export default function DashboardsLoading() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-48 rounded bg-[#1e293b] animate-pulse" />
        {/* Cards grid */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-[#1e293b] animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
