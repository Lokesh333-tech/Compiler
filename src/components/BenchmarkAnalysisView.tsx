import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Play,
  RotateCw,
  Download,
  FileText,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import type { BenchmarkResult } from "../types/compiler";

interface BenchmarkAnalysisViewProps {
  programName: string;
  originalCode: string;
  optimizedCode: string | null;
  benchmark: BenchmarkResult | null;
  running: boolean;
  runsCount: number;
  compilerFlag: string;
  onRunBenchmark: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onExportJSON: () => void;
}

export default function BenchmarkAnalysisView({
  programName,
  originalCode,
  optimizedCode,
  benchmark,
  running,
  runsCount,
  compilerFlag,
  onRunBenchmark,
  onExportCSV,
  onExportPDF,
  onExportJSON,
}: BenchmarkAnalysisViewProps) {
  const orig = benchmark?.original;
  const opt = benchmark?.optimized;
  const deltas = benchmark?.deltas;

  const execChartData =
    orig && opt
      ? [
          {
            metric: "Wall Time (ms)",
            Original: orig.execution_time_ms,
            Optimized: opt.execution_time_ms,
          },
          {
            metric: "User CPU (ms)",
            Original: orig.user_cpu_ms,
            Optimized: opt.user_cpu_ms,
          },
        ]
      : [];

  const cpuChartData =
    orig && opt
      ? [
          {
            metric: "CPU Utilization (%)",
            Original: orig.cpu_utilization_percent,
            Optimized: opt.cpu_utilization_percent,
          },
        ]
      : [];

  const memChartData =
    orig && opt
      ? [
          {
            metric: "Peak RSS (KB)",
            Original: orig.memory_rss_kb,
            Optimized: opt.memory_rss_kb,
          },
        ]
      : [];

  const overallChartData =
    deltas
      ? [
          {
            metric: "Exec Time Δ%",
            Improvement: deltas.execution_time_improvement_pct,
          },
          {
            metric: "CPU Util Δ%",
            Improvement: deltas.cpu_improvement_pct,
          },
          {
            metric: "Memory RSS Δ%",
            Improvement: deltas.memory_improvement_pct,
          },
          {
            metric: "Binary Size Δ%",
            Improvement: deltas.binary_size_improvement_pct,
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Performance Benchmarking
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Compiles and executes original vs optimized <span className="font-mono text-slate-200">{programName}</span> under identical <span className="font-mono text-cyan-400">gcc {compilerFlag}</span> sandboxed conditions ({runsCount} runs averaged).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={running}
            onClick={onRunBenchmark}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {benchmark ? (
              <RotateCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {running
              ? "Running Sandboxed Benchmark..."
              : benchmark
              ? "Repeat Benchmark"
              : "Run Benchmark"}
          </button>

          {benchmark?.success && (
            <>
              <button
                type="button"
                onClick={onExportPDF}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-[#101522] hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                Export PDF
              </button>
              <button
                type="button"
                onClick={onExportCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-[#101522] hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={onExportJSON}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#101522] hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sandbox Security Notice */}
      <div className="p-3.5 rounded-xl bg-[#101522] border border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="inline-flex items-center gap-2 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Isolated Sandbox Execution: 2s CPU rlimit · 128 MB address space cap · empty environment · no network access
          </span>
        </div>
        {!optimizedCode && (
          <span className="text-amber-300">
            Note: No optimized code generated yet — running benchmark will auto-optimize first.
          </span>
        )}
      </div>

      {benchmark && !benchmark.success && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Benchmark Failed</div>
            <p className="mt-1 font-mono">{benchmark.error}</p>
            {benchmark.security_violations && benchmark.security_violations.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-rose-300">
                {benchmark.security_violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!benchmark ? (
        <div className="p-12 rounded-xl bg-[#101522] border border-slate-800 text-center space-y-3">
          <p className="text-sm font-medium text-slate-200">
            Ready to benchmark {originalCode ? programName : "your C program"}
          </p>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            Click <strong className="text-cyan-400">Run Benchmark</strong> to compile both original and optimized versions with gcc and measure real execution time, CPU utilization, RSS memory, and page faults.
          </p>
        </div>
      ) : benchmark.success && orig && opt && deltas ? (
        <>
          {/* Comparison Table */}
          <div className="rounded-xl bg-[#101522] border border-slate-800/90 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white">
                Measured Comparison Table
              </h2>
              <span className="font-mono text-[11px] text-slate-400">
                Averaged over {orig.runs} isolated runs
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#080B12]/70 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-5 font-medium">Metric</th>
                    <th className="py-3 px-4 font-medium text-right">Original Program</th>
                    <th className="py-3 px-4 font-medium text-right">Optimized Program</th>
                    <th className="py-3 px-5 font-medium text-right">Difference / Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                  <tr>
                    <td className="py-3 px-5 font-sans font-medium text-slate-200">
                      Execution Time (Wall)
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      {orig.execution_time_ms} ms
                    </td>
                    <td className="py-3 px-4 text-right text-cyan-300">
                      {opt.execution_time_ms} ms
                    </td>
                    <td
                      className={`py-3 px-5 text-right font-semibold ${
                        deltas.execution_time_improvement_pct > 0
                          ? "text-emerald-400"
                          : deltas.execution_time_improvement_pct < 0
                          ? "text-amber-400"
                          : "text-slate-400"
                      }`}
                    >
                      {deltas.execution_time_diff_ms > 0 ? "+" : ""}
                      {deltas.execution_time_diff_ms} ms ({deltas.execution_time_improvement_pct}% saved)
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-5 font-sans font-medium text-slate-200">
                      CPU Utilization
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      {orig.cpu_utilization_percent}%
                    </td>
                    <td className="py-3 px-4 text-right text-cyan-300">
                      {opt.cpu_utilization_percent}%
                    </td>
                    <td className="py-3 px-5 text-right text-slate-300">
                      {deltas.cpu_utilization_diff_pct > 0 ? "+" : ""}
                      {deltas.cpu_utilization_diff_pct}% ({deltas.cpu_improvement_pct}% Δ)
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-5 font-sans font-medium text-slate-200">
                      Memory Consumption (Peak RSS)
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      {orig.memory_rss_kb} KB
                    </td>
                    <td className="py-3 px-4 text-right text-cyan-300">
                      {opt.memory_rss_kb} KB
                    </td>
                    <td className="py-3 px-5 text-right text-slate-300">
                      {deltas.memory_diff_kb > 0 ? "+" : ""}
                      {deltas.memory_diff_kb} KB ({deltas.memory_improvement_pct}% Δ)
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-5 font-sans font-medium text-slate-200">
                      Compiled Binary Size
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      {orig.binary_size_bytes} bytes
                    </td>
                    <td className="py-3 px-4 text-right text-cyan-300">
                      {opt.binary_size_bytes} bytes
                    </td>
                    <td className="py-3 px-5 text-right text-slate-300">
                      {deltas.binary_size_diff_bytes > 0 ? "+" : ""}
                      {deltas.binary_size_diff_bytes} B ({deltas.binary_size_improvement_pct}% Δ)
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-5 font-sans font-medium text-slate-200">
                      Thread Count
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      {orig.thread_count}
                    </td>
                    <td className="py-3 px-4 text-right text-cyan-300">
                      {opt.thread_count}
                    </td>
                    <td className="py-3 px-5 text-right text-slate-400">0</td>
                  </tr>

                  <tr>
                    <td className="py-3 px-5 font-sans font-medium text-slate-200">
                      Minor Page Faults
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      {orig.minor_page_faults}
                    </td>
                    <td className="py-3 px-4 text-right text-cyan-300">
                      {opt.minor_page_faults}
                    </td>
                    <td className="py-3 px-5 text-right text-slate-300">
                      {deltas.page_faults_diff > 0 ? "+" : ""}
                      {deltas.page_faults_diff}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-5 font-sans font-medium text-slate-200">
                      System Calls
                    </td>
                    <td colSpan={3} className="py-3 px-5 text-right font-sans text-slate-400">
                      Not measured (kernel ptrace/strace disabled inside unprivileged sandbox)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 4 Interactive Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
              <h3 className="font-display text-sm font-semibold text-white mb-4">
                Execution Time Comparison (ms)
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={execChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="metric" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0B0F1A",
                        borderColor: "#1E293B",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="Original" fill="#64748B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Optimized" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
              <h3 className="font-display text-sm font-semibold text-white mb-4">
                CPU Usage Comparison (%)
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cpuChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="metric" stroke="#64748B" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0B0F1A",
                        borderColor: "#1E293B",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="Original" fill="#64748B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Optimized" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
              <h3 className="font-display text-sm font-semibold text-white mb-4">
                Memory Consumption Comparison (Peak RSS KB)
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={memChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="metric" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0B0F1A",
                        borderColor: "#1E293B",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="Original" fill="#64748B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Optimized" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
              <h3 className="font-display text-sm font-semibold text-white mb-4">
                Overall Performance Improvement (%)
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overallChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="metric" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0B0F1A",
                        borderColor: "#1E293B",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="Improvement" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Formulas & Program Output Verification */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90 space-y-2.5 text-xs">
              <h3 className="font-display text-sm font-semibold text-white">
                Measurement Formulas
              </h3>
              <div className="p-3 rounded-lg bg-[#080B12] border border-slate-800 font-mono text-slate-300 space-y-1.5">
                <div>Improvement % = ((Original - Optimized) / Original) * 100</div>
                <div>CPU Utilization % = ((User_CPU_ms + System_CPU_ms) / Wall_Time_ms) * 100</div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90 space-y-2.5 text-xs">
              <h3 className="font-display text-sm font-semibold text-white">
                Semantic Equivalence Verification (Program Stdout)
              </h3>
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="p-2.5 rounded bg-[#080B12] border border-slate-800 text-slate-300 overflow-auto max-h-24">
                  <div className="text-[10px] text-slate-500 mb-1">Original Output</div>
                  {orig.stdout || "(empty)"}
                </div>
                <div className="p-2.5 rounded bg-[#080B12] border border-slate-800 text-cyan-300 overflow-auto max-h-24">
                  <div className="text-[10px] text-slate-500 mb-1">Optimized Output</div>
                  {opt.stdout || "(empty)"}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
