import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowUpRight,
  Cpu,
  HardDrive,
  Sparkles,
  Play,
  Database,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type {
  HistoryRecord,
  NavSection,
  OverviewSummary,
  SystemSnapshot,
} from "../types/compiler";

interface OverviewDashboardProps {
  overview: OverviewSummary | null;
  system: SystemSnapshot | null;
  monitorHistory: Array<{
    time: string;
    cpu: number;
    memory: number;
  }>;
  loading: boolean;
  includeDemoData: boolean;
  onLoadDemo: () => void;
  onNavigate: (section: NavSection) => void;
  onOpenRecord: (record: HistoryRecord) => void;
}

export default function OverviewDashboard({
  overview,
  system,
  monitorHistory,
  loading,
  includeDemoData,
  onLoadDemo,
  onNavigate,
  onOpenRecord,
}: OverviewDashboardProps) {
  const totalPrograms = overview?.total_programs_analyzed ?? 0;
  const successfulOpts = overview?.successful_optimizations ?? 0;
  const avgExec = overview?.average_execution_time_ms;
  const avgMemKb = overview?.average_memory_kb;
  const recentHistory = overview?.recent_history ?? [];
  const latestRecs = overview?.latest_recommendations ?? [];
  const activitySeries = overview?.activity_series ?? [];

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            System Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aggregated compilation telemetry, optimization throughput, and live Linux host metrics.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {totalPrograms === 0 && (
            <button
              type="button"
              onClick={onLoadDemo}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-cyan-300 bg-[#101522] hover:bg-slate-800 border border-cyan-500/40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              Load Demonstration Samples
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate("compiler")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            New Compilation
          </button>
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
          <div className="text-xs font-medium text-slate-400 mb-2">
            Total Programs Analyzed
          </div>
          <div className="font-mono text-2xl font-semibold text-white tabular-nums">
            {loading && !overview ? "—" : totalPrograms}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {includeDemoData ? "Includes labeled demo runs" : "User sessions only"}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
          <div className="text-xs font-medium text-slate-400 mb-2">
            Successful Optimizations
          </div>
          <div className="font-mono text-2xl font-semibold text-cyan-400 tabular-nums">
            {loading && !overview ? "—" : successfulOpts}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            AST & Three-Address IR verified
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
          <div className="text-xs font-medium text-slate-400 mb-2">
            Average Execution Time
          </div>
          <div className="font-mono text-2xl font-semibold text-white tabular-nums">
            {avgExec !== null && avgExec !== undefined ? `${avgExec} ms` : "No benchmarks"}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Measured via sandboxed gcc binaries
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
          <div className="text-xs font-medium text-slate-400 mb-2">
            Average Memory Consumption
          </div>
          <div className="font-mono text-2xl font-semibold text-white tabular-nums">
            {avgMemKb !== null && avgMemKb !== undefined
              ? `${(avgMemKb / 1024).toFixed(2)} MB`
              : "No benchmarks"}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Peak child RSS via Linux rusage
          </div>
        </div>
      </div>

      {/* Live Host CPU & Memory Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-white">
                Host CPU Utilization (%)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Live kernel /proc/stat delta across {system?.os.cpu_cores ?? "—"} logical cores
              </p>
            </div>
            <span className="font-mono text-sm font-semibold text-cyan-400 tabular-nums">
              {system ? `${system.cpu.utilization_percent}%` : "—"}
            </span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monitorHistory}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0B0F1A",
                    borderColor: "#1E293B",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  name="CPU %"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  fill="url(#cpuGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-white">
                Host Memory Consumption (%)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {system
                  ? `${system.memory.used_mb} MB used of ${system.memory.total_mb} MB`
                  : "Reading /proc/meminfo"}
              </p>
            </div>
            <span className="font-mono text-sm font-semibold text-blue-400 tabular-nums">
              {system ? `${system.memory.utilization_percent}%` : "—"}
            </span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monitorHistory}>
                <defs>
                  <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0B0F1A",
                    borderColor: "#1E293B",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="memory"
                  name="Memory %"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#memGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Optimization Activity + System Status & AI Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 p-5 rounded-xl bg-[#101522] border border-slate-800/90">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-white">
                Optimization Activity
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Applied optimization passes per recorded session
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("benchmark")}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer"
            >
              Benchmarks
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {activitySeries.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activitySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0B0F1A",
                      borderColor: "#1E293B",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="passes"
                    name="Applied Passes"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-lg p-6">
              <p className="text-sm text-slate-400">
                No optimization sessions recorded yet.
              </p>
              <button
                type="button"
                onClick={onLoadDemo}
                className="mt-3 px-3.5 py-1.5 text-xs font-medium text-cyan-300 bg-[#080B12] hover:bg-slate-800 border border-slate-700 rounded-md cursor-pointer"
              >
                Load Demonstration Runs
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-5">
          {/* Host System Status */}
          <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-semibold text-white">
                Host Runtime Environment
              </h2>
              <span className="text-xs font-medium text-emerald-400 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Operational
              </span>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-500" />
                  Architecture
                </span>
                <span className="font-mono text-slate-200">
                  {system ? `${system.os.system} ${system.os.arch}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                  Load Avg (1m / 5m)
                </span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {system
                    ? `${system.cpu.load_avg_1m} / ${system.cpu.load_avg_5m}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Kernel Uptime
                </span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {system
                    ? `${Math.floor(system.os.uptime_seconds / 60)} min`
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Latest AI Recommendations */}
          <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-semibold text-white inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Latest AI Recommendations
              </h2>
              <button
                type="button"
                onClick={() => onNavigate("optimizer")}
                className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                Open Engine
              </button>
            </div>
            {latestRecs.length > 0 ? (
              <div className="space-y-2.5">
                {latestRecs.slice(0, 3).map((rec) => (
                  <div
                    key={rec.pass_id}
                    className="p-3 rounded-lg bg-[#080B12] border border-slate-800/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-100">
                        {rec.pass_name}
                      </span>
                      <span className="font-mono text-xs text-cyan-400 tabular-nums">
                        {Math.round(rec.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {rec.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Run the Optimization Engine on any C program to generate structural pass recommendations.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Compilation History Table */}
      <div className="rounded-xl bg-[#101522] border border-slate-800/90 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-white">
            Recent Compilation History
          </h2>
          <button
            type="button"
            onClick={() => onNavigate("history")}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
          >
            View All History
          </button>
        </div>

        {recentHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#080B12]/70 text-slate-400 border-b border-slate-800/80">
                <tr>
                  <th className="py-3 px-5 font-medium">Program</th>
                  <th className="py-3 px-4 font-medium">Language</th>
                  <th className="py-3 px-4 font-medium">Applied Passes</th>
                  <th className="py-3 px-4 font-medium text-right">Exec Time</th>
                  <th className="py-3 px-4 font-medium text-right">Memory RSS</th>
                  <th className="py-3 px-5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-5 font-medium text-slate-100">
                      {item.program_name}
                      {item.is_demo && (
                        <span className="ml-2 text-[11px] font-mono text-purple-400">
                          [Demo]
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 uppercase">
                      {item.language}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {item.applied_passes.length > 0
                        ? item.applied_passes.join(", ")
                        : "None"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-200 tabular-nums">
                      {item.execution_time_ms !== null
                        ? `${item.execution_time_ms} ms`
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-200 tabular-nums">
                      {item.memory_kb !== null ? `${item.memory_kb} KB` : "—"}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenRecord(item)}
                        className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                      >
                        Load
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">
            No compilation history stored yet. Compile or optimize a program to begin tracking telemetry.
          </div>
        )}
      </div>
    </div>
  );
}
