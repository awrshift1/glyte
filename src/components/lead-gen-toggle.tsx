"use client";

interface LeadGenToggleProps {
  confidence: number;
  titleColumn?: string;
  onEnable: () => void;
  onDismiss: () => void;
}

export function LeadGenToggle({
  confidence,
  titleColumn,
  onEnable,
  onDismiss,
}: LeadGenToggleProps) {
  if (!titleColumn) return null;

  return (
    <div className="flex items-center gap-3 bg-[#1e293b] border border-[#334155] rounded-lg px-4 py-2.5 mb-4">
      <span className="text-sm text-[#cbd5e1]">
        This looks like a contact list (
        {Math.round(confidence * 100)}% confidence). Enable{" "}
        <span className="font-medium text-white">Lead Gen Mode</span> for ICP
        classification?
      </span>
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={onEnable}
          className="px-3 py-1 text-xs font-medium bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-md transition-colors"
        >
          Enable
        </button>
        <button
          onClick={onDismiss}
          className="text-[#64748b] hover:text-[#94a3b8] text-xs transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
