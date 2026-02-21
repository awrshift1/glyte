import Link from "next/link";
import { Sidebar } from "@/components/sidebar";

export default function NotFound() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-white mb-2">404</h2>
          <p className="text-gray-400 mb-4">Page not found</p>
          <Link
            href="/"
            className="px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm hover:bg-[#1d4ed8]"
          >
            Go home
          </Link>
        </div>
      </main>
    </div>
  );
}
