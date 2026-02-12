import { Sidebar } from "@/components/sidebar";
import { AiSidebar } from "@/components/ai-sidebar";
import { AiPageContext } from "@/components/ai-page-context";
import { Database } from "lucide-react";

export default function DataPage() {
  return (
    <div className="flex min-h-screen">
      <AiPageContext mode="guide" page="data" />
      <Sidebar />
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Data Sources</h1>
        <div className="text-center py-20">
          <Database className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">Coming soon</p>
          <p className="text-gray-400 text-sm">Connect databases, APIs, and other data sources.</p>
        </div>
      </main>
      <AiSidebar />
    </div>
  );
}
