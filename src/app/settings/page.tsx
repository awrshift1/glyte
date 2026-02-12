import { Sidebar } from "@/components/sidebar";
import { AiSidebar } from "@/components/ai-sidebar";
import { AiPageContext } from "@/components/ai-page-context";
import { Settings, Key } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen">
      <AiPageContext mode="salesperson" page="settings" />
      <Sidebar />
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

        <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-6 max-w-lg">
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-4 w-4 text-[#2563eb]" />
            <h2 className="text-white font-medium">AI Configuration</h2>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            The AI Sidebar requires an Anthropic API key. Add it to your <code className="text-[#2563eb]">.env.local</code> file:
          </p>
          <pre className="bg-[#0f1729] border border-[#334155] rounded p-3 text-xs text-gray-300 overflow-x-auto">
            ANTHROPIC_API_KEY=sk-ant-...
          </pre>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-6 max-w-lg mt-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-4 w-4 text-[#2563eb]" />
            <h2 className="text-white font-medium">MCP Server</h2>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            Connect Glyte to any AI agent via MCP. Add to your client config:
          </p>
          <pre className="bg-[#0f1729] border border-[#334155] rounded p-3 text-xs text-gray-300 overflow-x-auto">
{`{
  "mcpServers": {
    "glyte": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "<path-to-glyte>"
    }
  }
}`}
          </pre>
        </div>
      </main>
      <AiSidebar />
    </div>
  );
}
