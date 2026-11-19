import { Database, Trash2, Shield } from "lucide-react";
import type { AppSettings } from "../types/compiler";

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onLoadDemo: () => void;
  onClearUserHistory: () => void;
  statusMessage: string | null;
}

export default function SettingsView({
  settings,
  onUpdateSettings,
  onLoadDemo,
  onClearUserHistory,
  statusMessage,
}: SettingsViewProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">
          Platform Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure compiler baseline flags, sandbox benchmark sampling, resource polling cadence, and demonstration visibility.
        </p>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200">
          {statusMessage}
        </div>
      )}

      {/* Compiler & Benchmark Parameters */}
      <div className="p-6 rounded-xl bg-[#101522] border border-slate-800/90 space-y-5">
        <h2 className="font-display text-base font-semibold text-white">
          Compiler & Benchmark Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              GCC Baseline Flag for Benchmark Execution
            </label>
            <select
              value={settings.compilerFlag}
              onChange={(e) =>
                onUpdateSettings({
                  compilerFlag: e.target.value as AppSettings["compilerFlag"],
                })
              }
              className="w-full px-3 py-2 text-xs bg-[#080B12] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="-O0">-O0 (Recommended: isolates OptiForge AST/IR transformations)</option>
              <option value="-O1">-O1 (GCC basic optimizations enabled)</option>
              <option value="-O2">-O2 (GCC aggressive optimizations enabled)</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Both Original and Optimized sources compile with the identical flag for fair comparison.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Benchmark Iterations Averaged
            </label>
            <select
              value={settings.benchmarkRuns}
              onChange={(e) =>
                onUpdateSettings({
                  benchmarkRuns: Number(e.target.value) as AppSettings["benchmarkRuns"],
                })
              }
              className="w-full px-3 py-2 text-xs bg-[#080B12] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value={3}>3 isolated runs</option>
              <option value={5}>5 isolated runs (Default)</option>
              <option value={10}>10 isolated runs</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Resource Monitor Polling Interval
            </label>
            <select
              value={settings.monitorIntervalMs}
              onChange={(e) =>
                onUpdateSettings({
                  monitorIntervalMs: Number(e.target.value) as AppSettings["monitorIntervalMs"],
                })
              }
              className="w-full px-3 py-2 text-xs bg-[#080B12] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value={2000}>Every 2 seconds</option>
              <option value={5000}>Every 5 seconds (Default)</option>
              <option value={10000}>Every 10 seconds</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Demonstration Mode Visibility
            </label>
            <label className="flex items-center gap-3 p-2.5 rounded-lg bg-[#080B12] border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.includeDemoData}
                onChange={(e) =>
                  onUpdateSettings({ includeDemoData: e.target.checked })
                }
                className="accent-cyan-400"
              />
              <span className="text-xs text-slate-200">
                Include clearly labeled [Demo] records in Overview & History
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Data & Demonstration Actions */}
      <div className="p-6 rounded-xl bg-[#101522] border border-slate-800/90 space-y-4">
        <h2 className="font-display text-base font-semibold text-white">
          Session Data & Demonstration Controls
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onLoadDemo}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-cyan-300 bg-[#080B12] hover:bg-slate-800 border border-cyan-500/40 rounded-lg transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            Populate Demonstration Sessions
          </button>

          <button
            type="button"
            onClick={onClearUserHistory}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-rose-300 bg-[#080B12] hover:bg-rose-950/40 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear User Compilation History
          </button>
        </div>
      </div>

      {/* Sandbox Security Specification */}
      <div className="p-6 rounded-xl bg-[#101522] border border-slate-800/90 space-y-3">
        <h2 className="font-display text-base font-semibold text-white inline-flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Sandbox Execution & AI Architecture
        </h2>
        <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
          <li>User C programs are statically checked for restricted system headers and process-spawning APIs prior to compilation.</li>
          <li>Compiled binaries execute in isolated temporary directories with strict CPU (2s), address space (128 MB), and file size (1 MB) rlimits.</li>
          <li>AI recommendations combine deterministic AST/IR feature analysis with server-side Gemini 4 Hydrogen when configured in environment secrets.</li>
        </ul>
      </div>
    </div>
  );
}
