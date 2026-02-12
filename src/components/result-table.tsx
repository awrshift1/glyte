"use client";

interface ResultTableProps {
  data: Record<string, unknown>[];
  columns: string[];
}

export function ResultTable({ data, columns }: ResultTableProps) {
  if (!data.length) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-[#334155]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#334155] bg-[#1e293b]">
            {columns.map((col) => (
              <th key={col} className="px-3 py-1.5 text-left font-medium text-[#94a3b8]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 50).map((row, i) => (
            <tr key={i} className="border-b border-[#334155]/50 hover:bg-[#1e293b]/50">
              {columns.map((col) => (
                <td key={col} className="px-3 py-1.5 text-[#f8fafc]">
                  {typeof row[col] === "number"
                    ? (row[col] as number).toLocaleString("en-US", { maximumFractionDigits: 2 })
                    : String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 50 && (
        <p className="px-3 py-1.5 text-[10px] text-[#94a3b8]">Showing 50 of {data.length} rows</p>
      )}
    </div>
  );
}
