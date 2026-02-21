import { Sidebar } from "@/components/sidebar";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-[#1e293b] animate-pulse" />
          ))}
        </div>
        {/* Chart grid */}
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 rounded-lg bg-[#1e293b] animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
