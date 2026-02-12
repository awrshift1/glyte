"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesDelete,
} from "@xyflow/react";
import { Check, X } from "lucide-react";
import { TableNode, type TableNodeData, type ColumnInfo } from "./table-node";
import type { DashboardConfig, Relationship } from "@/types/dashboard";
import type { SuggestedRelationship } from "@/lib/relationship-detector";

interface CanvasViewProps {
  dashboardId: string;
  config: DashboardConfig;
  onRelationshipChange: () => void;
  suggestedRelationships?: SuggestedRelationship[];
  onAcceptSuggestion?: (suggestion: SuggestedRelationship) => void;
  onRejectSuggestion?: (suggestion: SuggestedRelationship) => void;
}

const nodeTypes = { tableNode: TableNode };

function buildNodes(
  config: DashboardConfig,
  columnsMap: Record<string, ColumnInfo[]>,
  relationships: Relationship[]
): Node[] {
  const allTables = [
    config.tableName,
    ...(config.tables ?? []).map((t) => t.tableName),
  ];

  const connectedByTable: Record<string, Set<string>> = {};
  for (const rel of relationships) {
    if (!connectedByTable[rel.fromTable]) connectedByTable[rel.fromTable] = new Set();
    if (!connectedByTable[rel.toTable]) connectedByTable[rel.toTable] = new Set();
    connectedByTable[rel.fromTable].add(rel.fromColumn);
    connectedByTable[rel.toTable].add(rel.toColumn);
  }

  return allTables.map((table, i) => ({
    id: table,
    type: "tableNode",
    position: { x: i * 450, y: 40 },
    data: {
      label: table,
      columns: columnsMap[table] ?? [],
      accent: i === 0 ? "blue" : "green",
      connectedColumns: connectedByTable[table] ?? new Set(),
    } satisfies TableNodeData,
  }));
}

function buildEdges(relationships: Relationship[]): Edge[] {
  return relationships.map((rel) => ({
    id: rel.id,
    source: rel.fromTable,
    sourceHandle: `${rel.fromColumn}-source`,
    target: rel.toTable,
    targetHandle: `${rel.toColumn}-target`,
    type: "default",
    label: `${rel.fromColumn} ↔ ${rel.toColumn}`,
    animated: false,
    style: { stroke: "#475569", strokeWidth: 2 },
    labelStyle: { fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" },
    labelBgStyle: { fill: "#0f1729", fillOpacity: 0.9 },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
  }));
}

function buildSuggestionEdges(suggestions: SuggestedRelationship[]): Edge[] {
  return suggestions.map((s, i) => ({
    id: `suggestion-${i}`,
    source: s.fromTable,
    sourceHandle: `${s.fromColumn}-source`,
    target: s.toTable,
    targetHandle: `${s.toColumn}-target`,
    type: "default",
    label: `${s.fromColumn} ↔ ${s.toColumn} (${Math.round(s.confidence * 100)}%)`,
    animated: true,
    style: { stroke: "#475569", strokeWidth: 1.5, strokeDasharray: "8 4", opacity: 0.6 },
    labelStyle: { fill: "#94a3b8", fontSize: 10, fontFamily: "monospace", fontStyle: "italic" },
    labelBgStyle: { fill: "#0f1729", fillOpacity: 0.85 },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
  }));
}

function parseHandle(handleId: string | null): string {
  if (!handleId) return "";
  return handleId.replace(/-(?:source|target)$/, "");
}

function CanvasInner({ dashboardId, config, onRelationshipChange, columnsMap, relationships, setRelationships, suggestedRelationships, onAcceptSuggestion, onRejectSuggestion }: {
  dashboardId: string;
  config: DashboardConfig;
  onRelationshipChange: () => void;
  columnsMap: Record<string, ColumnInfo[]>;
  relationships: Relationship[];
  setRelationships: React.Dispatch<React.SetStateAction<Relationship[]>>;
  suggestedRelationships: SuggestedRelationship[];
  onAcceptSuggestion?: (suggestion: SuggestedRelationship) => void;
  onRejectSuggestion?: (suggestion: SuggestedRelationship) => void;
}) {
  const [saving, setSaving] = useState(false);
  const { fitView } = useReactFlow();

  const nodesData = useMemo(
    () => buildNodes(config, columnsMap, relationships),
    [config, columnsMap, relationships]
  );
  const confirmedEdges = useMemo(
    () => buildEdges(relationships),
    [relationships]
  );
  const suggestionEdges = useMemo(
    () => buildSuggestionEdges(suggestedRelationships),
    [suggestedRelationships]
  );
  const edgesData = useMemo(
    () => [...confirmedEdges, ...suggestionEdges],
    [confirmedEdges, suggestionEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesData);
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesData);

  // Smart sync: update node data without overwriting user-dragged positions
  useEffect(() => {
    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((n) => [n.id, n]));
      return nodesData.map((newNode) => {
        const existing = currentById.get(newNode.id);
        if (existing) {
          // Preserve user position, update data only
          return { ...existing, data: newNode.data };
        }
        return newNode;
      });
    });
  }, [nodesData, setNodes]);

  // Sync edges (no position to preserve)
  useEffect(() => { setEdges(edgesData); }, [edgesData, setEdges]);

  // Fit view after initial render
  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.2 }), 100);
    return () => clearTimeout(timer);
  }, [fitView]);

  const onConnect: OnConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const fromColumn = parseHandle(connection.sourceHandle);
      const toColumn = parseHandle(connection.targetHandle);
      if (!fromColumn || !toColumn) return;
      if (connection.source === connection.target) return;

      setSaving(true);
      try {
        const res = await fetch(`/api/dashboard/${dashboardId}/relationships`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromTable: connection.source,
            fromColumn,
            toTable: connection.target,
            toColumn,
            type: "one-to-many",
          }),
        });
        const data = await res.json();
        if (data.relationship) {
          setRelationships((prev) => [...prev, data.relationship]);
          onRelationshipChange();
        }
      } finally {
        setSaving(false);
      }
    },
    [dashboardId, onRelationshipChange, setRelationships]
  );

  const onEdgesDelete: OnEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        await fetch(`/api/dashboard/${dashboardId}/relationships`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relationshipId: edge.id }),
        }).catch(() => {});
        setRelationships((prev) => prev.filter((r) => r.id !== edge.id));
      }
      onRelationshipChange();
    },
    [dashboardId, onRelationshipChange, setRelationships]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onEdgesDelete={onEdgesDelete}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      deleteKeyCode={["Backspace", "Delete"]}
      colorMode="dark"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.5}
        color="#1e293b"
      />
      <Controls
        showInteractive={false}
        position="bottom-left"
      />
      <MiniMap
        nodeColor="#475569"
        maskColor="rgba(15, 23, 41, 0.8)"
        position="bottom-right"
        style={{ backgroundColor: "#0f1729", borderColor: "#334155" }}
      />
      {saving && (
        <Panel position="top-center">
          <div className="px-3 py-1.5 rounded-full bg-[#2563eb] text-white text-xs font-medium shadow-lg">
            Saving connection...
          </div>
        </Panel>
      )}
      {relationships.length === 0 && suggestedRelationships.length === 0 && (
        <Panel position="bottom-center">
          <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-[#0f1729]/90 border border-[#334155] shadow-xl backdrop-blur-sm mb-4">
            <span className="text-[#2563eb] text-lg">↗</span>
            <p className="text-sm font-medium text-slate-300">
              Drag from a column handle to another table to create a connection
            </p>
          </div>
        </Panel>
      )}
      {suggestedRelationships.length > 0 && (
        <Panel position="top-right">
          <div className="bg-[#0f1729]/95 border border-[#334155] rounded-lg shadow-xl backdrop-blur-sm p-3 max-w-xs space-y-2">
            <p className="text-xs font-medium text-slate-300 mb-2">
              AI Suggestions ({suggestedRelationships.length})
            </p>
            {suggestedRelationships.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-[#1e293b]/60 hover:bg-[#1e293b]"
              >
                <div className="min-w-0 text-[11px]">
                  <span className="text-slate-300 font-mono truncate">
                    {s.fromTable}.{s.fromColumn}
                  </span>
                  <span className="text-[#475569] mx-1">→</span>
                  <span className="text-slate-300 font-mono truncate">
                    {s.toTable}.{s.toColumn}
                  </span>
                  <span
                    className={`ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      s.confidence >= 0.7
                        ? "bg-emerald-500/20 text-emerald-400"
                        : s.confidence >= 0.5
                          ? "bg-[#eab308]/20 text-[#eab308]"
                          : "bg-[#94a3b8]/20 text-[#94a3b8]"
                    }`}
                  >
                    {Math.round(s.confidence * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onAcceptSuggestion?.(s)}
                    className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                    title="Accept"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onRejectSuggestion?.(s)}
                    className="p-1 rounded hover:bg-[#ef4444]/20 text-[#ef4444] transition-colors"
                    title="Reject"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </ReactFlow>
  );
}

export function CanvasView({ dashboardId, config, onRelationshipChange, suggestedRelationships = [], onAcceptSuggestion, onRejectSuggestion }: CanvasViewProps) {
  const [columnsMap, setColumnsMap] = useState<Record<string, ColumnInfo[]>>({});
  const [relationships, setRelationships] = useState<Relationship[]>(config.relationships ?? []);
  const [ready, setReady] = useState(false);

  const allTables = useMemo(
    () => [config.tableName, ...(config.tables ?? []).map((t) => t.tableName)],
    [config]
  );

  // Fetch columns for all tables
  useEffect(() => {
    const controller = new AbortController();
    const fetchAll = async () => {
      const result: Record<string, ColumnInfo[]> = {};
      await Promise.all(
        allTables.map(async (table) => {
          try {
            const res = await fetch(`/api/columns?table=${encodeURIComponent(table)}`, { signal: controller.signal });
            if (res.ok) {
              const data = await res.json();
              result[table] = (data.columns as string[]).map((name) => ({
                name,
                type: getColumnType(config, table, name),
              }));
            }
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return;
          }
        })
      );
      setColumnsMap(result);
      setReady(true);
    };
    fetchAll();
    return () => controller.abort();
  }, [allTables, config]);

  // Fetch relationships from DuckDB (snake_case → camelCase)
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/dashboard/${dashboardId}/relationships`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        const mapped = (d.relationships ?? [])
          .filter((r: Record<string, string>) => r.status !== "rejected")
          .map((r: Record<string, string>) => ({
            id: r.id,
            fromTable: r.from_table,
            fromColumn: r.from_column,
            toTable: r.to_table,
            toColumn: r.to_column,
            type: r.type,
          }));
        setRelationships(mapped);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [dashboardId]);

  if (!ready) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading canvas...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <ReactFlowProvider>
        <CanvasInner
          dashboardId={dashboardId}
          config={config}
          onRelationshipChange={onRelationshipChange}
          columnsMap={columnsMap}
          relationships={relationships}
          setRelationships={setRelationships}
          suggestedRelationships={suggestedRelationships}
          onAcceptSuggestion={onAcceptSuggestion}
          onRejectSuggestion={onRejectSuggestion}
        />
      </ReactFlowProvider>
    </div>
  );
}

function getColumnType(config: DashboardConfig, tableName: string, columnName: string): string {
  if (tableName === config.tableName && config.profile) {
    const col = config.profile.columns.find((c) => c.name === columnName);
    if (col) return col.type ?? "varchar";
  }
  return "varchar";
}
