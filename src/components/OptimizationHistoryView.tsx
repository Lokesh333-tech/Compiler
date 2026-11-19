import { useState } from "react";
import {
  FileText,
  Download,
  Trash2,
  FolderOpen,
  Search,
  GitCompare,
  Database,
} from "lucide-react";
import type { HistoryRecord } from "../types/compiler";

interface OptimizationHistoryViewProps {
  items: HistoryRecord[];
  loading: boolean;
  onOpenRecord: (record: HistoryRecord) => void;
  onDeleteRecord: (id: number) => void;
  onDownloadPDF: (id: number) => void;
  onDownloadCSV: (id: number) => void;
  onLoadDemo: () => void;
}

export default function OptimizationHistoryView({
  items,
  loading,
  onOpenRecord,
  onDeleteRecord,
  onDownloadPDF,
  onDownloadCSV,
  onLoadDemo,
}: OptimizationHistoryViewProps) {
  const [search, setSearch] = useState("");
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.program_name.toLowerCase().includes(q) ||
      item.applied_passes.some((p) => p.toLowerCase().includes(q)) ||
      item.status.toLowerCase().includes(q)
    );
  });

  const toggleCompare = (id: number) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const comparedItems = compareIds
    .map((id) => items.find((i) => i.id === id))
    .filter((x): x is HistoryRecord => Boolean(x));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Optimization History & Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse SQLite-persisted compilation runs, compare two sessions, and export downloadable PDF or CSV reports.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search programs or passes..."
              className="pl-8 pr-3 py-2 text-xs bg-[#101522] border border-slate-700/80 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 w-56"
            />
          </div>

          {items.length === 0 && (
            <button
              type="button"
              onClick={onLoadDemo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-cyan-300 bg-[#101522] hover:bg-slate-800 border border-cyan-500/40 rounded-lg cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              Load Demo Sessions
            </button>
          )}
        </div>
      </div>

      {/* Side-by-Side Run Comparison Panel */}
      {comparedItems.length === 2 && (
        <div className="p-5 rounded-xl bg-[#101522] border border-cyan-500/40 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-white inline-flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-cyan-400" />
              Session Comparison: #{comparedItems[0].id} vs #{comparedItems[1].id}
            </h2>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Clear Comparison
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {comparedItems.map((rec) => (
              <div
                key={rec.id}
                className="p-4 rounded-lg bg-[#080B12] border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">
                    #{rec.id} · {rec.program_name}
                  </span>
                  <span className="font-mono text-cyan-400">{rec.status}</span>
                </div>
                <div className="text-slate-400">
                  Passes:{" "}
                  <span className="text-slate-200">
                    {rec.applied_passes.join(", ") || "None"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 font-mono tabular-nums">
                  <div>
                    <div className="text-[10px] text-slate-500">Exec Time</div>
                    <div className="text-slate-200">
                      {rec.execution_time_ms !== null ? `${rec.execution_time_ms} ms` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Memory RSS</div>
                    <div className="text-slate-200">
                      {rec.memory_kb !== null ? `${rec.memory_kb} KB` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Time Δ%</div>
                    <div className="text-emerald-400">
                      {rec.improvement_pct !== null ? `${rec.improvement_pct}%` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="rounded-xl bg-[#101522] border border-slate-800/90 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Loading optimization history...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm text-slate-300 font-medium">
              No matching optimization records found
            </p>
            <p className="text-xs text-slate-500">
              Compile, optimize, or benchmark a program to store persistent reports here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#080B12]/70 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-medium">Compare</th>
                  <th className="py-3 px-4 font-medium">Program</th>
                  <th className="py-3 px-3 font-medium">Lang</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Applied Optimizations</th>
                  <th className="py-3 px-3 font-medium text-right">Exec Time</th>
                  <th className="py-3 px-3 font-medium text-right">Memory</th>
                  <th className="py-3 px-3 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((item) => {
                  const selected = compareIds.includes(item.id);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCompare(item.id)}
                          aria-label={`Select record ${item.id} for comparison`}
                          className="accent-cyan-400 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        {item.program_name}
                        {item.is_demo && (
                          <span className="ml-2 text-[11px] font-mono text-purple-400">
                            [Demo]
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono uppercase text-slate-400">
                        {item.language}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono tabular-nums whitespace-nowrap">
                        {new Date(item.created_at * 1000).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                        {item.applied_passes.length > 0
                          ? item.applied_passes.join(", ")
                          : "None"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-200 tabular-nums whitespace-nowrap">
                        {item.execution_time_ms !== null
                          ? `${item.execution_time_ms} ms`
                          : "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-200 tabular-nums whitespace-nowrap">
                        {item.memory_kb !== null ? `${item.memory_kb} KB` : "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={
                            item.status === "Benchmarked"
                              ? "text-emerald-400 font-medium"
                              : "text-cyan-400 font-medium"
                          }
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenRecord(item)}
                            title="Open in Workspace"
                            className="p-1.5 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadPDF(item.id)}
                            title="Download PDF Report"
                            className="p-1.5 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadCSV(item.id)}
                            title="Download CSV Report"
                            className="p-1.5 text-slate-300 hover:text-blue-400 transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRecord(item.id)}
                            title="Delete Session"
                            className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
