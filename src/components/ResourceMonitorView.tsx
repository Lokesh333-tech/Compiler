import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Pause, Play, RefreshCw, Server, Cpu, Info } from "lucide-react";
import type { BenchmarkResult, SystemSnapshot } from "../types/compiler";

interface ResourceMonitorViewProps {
  system: SystemSnapshot | null;
  monitorHistory: Array<{
    time: string;
    cpu: number;
    memory: number;
    userCpu: number;
    sysCpu: number;
  }>;
  latestBenchmark: BenchmarkResult | null;
  pollingEnabled: boolean;
  onTogglePolling: () => void;
  onRefreshNow: () => void;
}

export default function ResourceMonitorView({
  system,
  monitorHistory,
  latestBenchmark,
  pollingEnabled,
  onTogglePolling,
  onRefreshNow,
}: ResourceMonitorViewProps) {
  const benchProc = latestBenchmark?.optimized ?? latestBenchmark?.original;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            OS Resource Monitor
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Live Linux host telemetry from <span className="font-mono text-slate-200">/proc</span> separated from isolated benchmark child-process rusage metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onTogglePolling}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-[#101522] hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {pollingEnabled ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                Pause Polling
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                Resume Polling
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRefreshNow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sample Now
          </button>
        </div>
      </div>

      {/* Section 1: Live Machine-Level Monitoring */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
          <Server className="w-4 h-4" />
          <span>Live Machine-Level Monitoring (Linux /proc Host Telemetry)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#101522] border border-slate-800/90">
            <div className="text-xs text-slate-400">CPU Utilization</div>
            <div className="font-mono text-2xl font-semibold text-cyan-400 tabular-nums mt-1">
              {system ? `${system.cpu.utilization_percent}%` : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5 font-mono tabular-nums">
              {system
                ? `User ${system.cpu.user_percent}% · Sys ${system.cpu.system_percent}%`
                : "Sampling..."}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#101522] border border-slate-800/90">
            <div className="text-xs text-slate-400">Physical Memory Used</div>
            <div className="font-mono text-2xl font-semibold text-blue-400 tabular-nums mt-1">
              {system ? `${system.memory.used_mb} MB` : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5 font-mono tabular-nums">
              {system
                ? `of ${system.memory.total_mb} MB (${system.memory.utilization_percent}%)`
                : "Sampling..."}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#101522] border border-slate-800/90">
            <div className="text-xs text-slate-400">Load Average (1m / 5m / 15m)</div>
            <div className="font-mono text-xl font-semibold text-white tabular-nums mt-1">
              {system
                ? `${system.cpu.load_avg_1m} / ${system.cpu.load_avg_5m} / ${system.cpu.load_avg_15m}`
                : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              {system?.os.cpu_cores ?? "—"} logical CPU cores
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#101522] border border-slate-800/90">
            <div className="text-xs text-slate-400">Backend Monitor Worker</div>
            <div className="font-mono text-xl font-semibold text-white tabular-nums mt-1">
              {system ? `PID ${system.process.pid}` : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-2 font-mono tabular-nums">
              {system
                ? `${system.process.threads} thread(s) · ${system.process.rss_mb} MB RSS`
                : "Sampling..."}
            </div>
          </div>
        </div>

        {/* Live CPU & Memory Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-sm font-semibold text-white">
                Live Host CPU Utilization (%)
              </h2>
              <span className="text-xs font-mono text-slate-400">
                /proc/stat 120ms delta
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monitorHistory}>
                  <defs>
                    <linearGradient id="monCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
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
                    name="Total CPU %"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    fill="url(#monCpu)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-sm font-semibold text-white">
                Live Host Memory Usage (%)
              </h2>
              <span className="text-xs font-mono text-slate-400">
                /proc/meminfo
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monitorHistory}>
                  <defs>
                    <linearGradient id="monMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
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
                    fill="url(#monMem)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Individual Benchmark Process Metrics */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
          <Cpu className="w-4 h-4" />
          <span>Individual Benchmark Process Telemetry (Isolated Child Process rusage)</span>
        </div>

        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
          {benchProc && latestBenchmark?.success ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
              <div>
                <div className="text-slate-400">Execution Time</div>
                <div className="font-mono text-lg text-white font-semibold tabular-nums mt-1">
                  {benchProc.execution_time_ms} ms
                </div>
              </div>
              <div>
                <div className="text-slate-400">User / System CPU</div>
                <div className="font-mono text-lg text-cyan-400 font-semibold tabular-nums mt-1">
                  {benchProc.user_cpu_ms} / {benchProc.system_cpu_ms} ms
                </div>
              </div>
              <div>
                <div className="text-slate-400">Peak RSS Memory</div>
                <div className="font-mono text-lg text-white font-semibold tabular-nums mt-1">
                  {benchProc.memory_rss_kb} KB
                </div>
              </div>
              <div>
                <div className="text-slate-400">Thread Count</div>
                <div className="font-mono text-lg text-white font-semibold tabular-nums mt-1">
                  {benchProc.thread_count}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Minor Page Faults</div>
                <div className="font-mono text-lg text-white font-semibold tabular-nums mt-1">
                  {benchProc.minor_page_faults}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Context Switches</div>
                <div className="font-mono text-lg text-white font-semibold tabular-nums mt-1">
                  {benchProc.context_switches}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              No individual benchmark process has been executed in this session yet. Run a benchmark in Benchmark Analysis to inspect child-process rusage telemetry.
            </p>
          )}

          {/* Honest Syscall Disclosure */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-400">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">System Calls Disclosure: </span>
              {system?.syscalls.note ??
                "Kernel syscall counting (ptrace/strace) is unavailable in unprivileged container sandboxes; OptiForge-OS never fabricates syscall counts and reports verified kernel rusage page faults and context switches instead."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
