"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Database, Settings } from "lucide-react";

const navItems = [
  { key: "home", label: "Home", icon: Home, href: "/home" },
  { key: "dashboards", label: "Dashboards", icon: BarChart3, href: "/dashboards" },
  { key: "data", label: "Data Sources", icon: Database, href: "/data" },
  { key: "settings", label: "Settings", icon: Settings, href: "/settings" },
] as const;

function getActiveKey(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/dashboard")) return "dashboards";
  if (pathname.startsWith("/data")) return "data";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}

export function Sidebar() {
  const pathname = usePathname();
  const active = getActiveKey(pathname);

  return (
    <aside className="w-60 min-h-screen bg-[#0f1729] border-r border-[#334155] flex flex-col">
      <div className="p-5">
        <h1 className="text-xl font-bold text-white tracking-tight">Glyte</h1>
      </div>

      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? "bg-[#2563eb]/20 text-[#2563eb] font-medium"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#1e293b]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-5 text-xs text-gray-500">v2.0-beta</div>
    </aside>
  );
}
