import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard,
  Code2,
  Sparkles,
  GitBranch,
  Activity,
  BarChart3,
  History,
  Settings,
  Menu,
  X,
  ArrowLeft,
  Play,
} from "lucide-react";
import LandingPage from "./components/LandingPage";
import OverviewDashboard from "./components/OverviewDashboard";
import CodeCompilerView from "./components/CodeCompilerView";
import OptimizationEngineView from "./components/OptimizationEngineView";
import IRExplorerView from "./components/IRExplorerView";
import ResourceMonitorView from "./components/ResourceMonitorView";
import BenchmarkAnalysisView from "./components/BenchmarkAnalysisView";
import OptimizationHistoryView from "./components/OptimizationHistoryView";
import SettingsView from "./components/SettingsView";
import { downloadReportPDF } from "./utils/pdfExport";
import type {
  AppSettings,
  BenchmarkResult,
  CompileResult,
  HistoryRecord,
  LanguageOption,
  NavSection,
  OptimizationData,
  OptimizeResponse,
  OverviewSummary,
  RecommendResult,
  ReportPayload,
  SampleProgram,
  SystemSnapshot,
} from "./types/compiler";

const DEFAULT_CODE = `#include <stdio.h>

long workload(int alpha, int beta, int gamma) {
    int unused_diag = 99 * 11;
    long acc = 0;

    for (int i = 0; i < 2000000; i++) {
        int invariant_scale = (alpha * beta) + (gamma * 4);
        int second_invariant = (alpha * beta) + 10;
        acc += (i % 17) + invariant_scale - second_invariant;
    }

    return acc;
}

int main() {
    long total = workload(12, 34, 8);
    printf("Accumulator: %ld\\n", total);
    return 0;
}
`;

const ALL_PASS_IDS = [
  "constant_folding",
  "constant_propagation",
  "dead_code_elimination",
  "common_subexpression_elimination",
  "loop_optimization",
];

const NAV_ITEMS: Array<{
  id: Exclude<NavSection, "landing">;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "compiler", label: "Code Compiler", icon: Code2 },
  { id: "optimizer", label: "Optimization Engine", icon: Sparkles },
  { id: "ir-explorer", label: "IR Explorer", icon: GitBranch },
  { id: "monitor", label: "Resource Monitor", icon: Activity },
  { id: "benchmark", label: "Benchmark Analysis", icon: BarChart3 },
  { id: "history", label: "Optimization History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function App() {
  const [section, setSection] = useState<NavSection>("landing");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active compiler workspace state
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [programName, setProgramName] = useState<string>("loop_invariant.c");
  const [language, setLanguage] = useState<string>("c");
  const [samples, setSamples] = useState<SampleProgram[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([
    { id: "c", name: "C (GCC / C11)", supported: true, status: "Active" },
  ]);

  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [selectedPasses, setSelectedPasses] = useState<string[]>(ALL_PASS_IDS);
  const [optimization, setOptimization] = useState<OptimizationData | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendResult | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null);

  // Overview, Monitor, History, Settings
  const [overview, setOverview] = useState<OverviewSummary | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [systemSnapshot, setSystemSnapshot] = useState<SystemSnapshot | null>(null);
  const [monitorHistory, setMonitorHistory] = useState<
    Array<{ time: string; cpu: number; memory: number; userCpu: number; sysCpu: number }>
  >([]);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const [settings, setSettings] = useState<AppSettings>({
    compilerFlag: "-O0",
    benchmarkRuns: 5,
    monitorIntervalMs: 5000,
    includeDemoData: true,
  });

  // Loading & toast feedback
  const [compiling, setCompiling] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [benchmarking, setBenchmarking] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Load initial sample catalog
  useEffect(() => {
    fetch("/api/samples")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.samples)) setSamples(data.samples);
        if (Array.isArray(data.languages)) setLanguages(data.languages);
      })
      .catch(() => {});
  }, []);

  const fetchMonitorSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor");
      if (!res.ok) return;
      const snap = (await res.json()) as SystemSnapshot;
      setSystemSnapshot(snap);
      const label = new Date().toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setMonitorHistory((prev) => [
        ...prev.slice(-23),
        {
          time: label,
          cpu: snap.cpu.utilization_percent,
          memory: snap.memory.utilization_percent,
          userCpu: snap.cpu.user_percent,
          sysCpu: snap.cpu.system_percent,
        },
      ]);
    } catch {
      // silent retry on next poll
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch(`/api/overview?include_demo=${settings.includeDemoData}`);
      const data = await res.json();
      if (data.overview) setOverview(data.overview);
      if (data.system) setSystemSnapshot(data.system);
    } catch {
      // handled gracefully
    } finally {
      setOverviewLoading(false);
    }
  }, [settings.includeDemoData]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/history?include_demo=${settings.includeDemoData}`);
      const data = await res.json();
      if (Array.isArray(data.items)) setHistoryItems(data.items);
    } catch {
      // handled gracefully
    } finally {
      setHistoryLoading(false);
    }
  }, [settings.includeDemoData]);

  // Poll OS resource monitor when inside dashboard
  useEffect(() => {
    if (section === "landing") return;
    fetchMonitorSnapshot();
    if (!pollingEnabled) return;
    const timer = setInterval(fetchMonitorSnapshot, settings.monitorIntervalMs);
    return () => clearInterval(timer);
  }, [section, pollingEnabled, settings.monitorIntervalMs, fetchMonitorSnapshot]);

  useEffect(() => {
    if (section === "overview") fetchOverview();
    if (section === "history") fetchHistory();
  }, [section, fetchOverview, fetchHistory]);

  const handleCompile = async (): Promise<CompileResult | null> => {
    setCompiling(true);
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = (await res.json()) as CompileResult;
      setCompileResult(data);
      if (data.success) {
        showToast("success", `Compiled ${programName}: ${data.tokens.length} tokens, ${data.ir?.instruction_count ?? 0} IR ops.`);
      } else {
        showToast("error", `Compilation failed with ${data.errors.length} error(s).`);
      }
      return data;
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Compilation request failed.");
      return null;
    } finally {
      setCompiling(false);
    }
  };

  const handleAnalyzeRecommendations = async () => {
    setRecommending(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = (await res.json()) as RecommendResult;
      if (!data.success) {
        showToast("error", data.error || "Unable to analyze recommendations.");
        return;
      }
      setRecommendations(data);
      showToast("success", `Generated ${data.recommendations.length} optimization recommendation(s).`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Recommendation failed.");
    } finally {
      setRecommending(false);
    }
  };

  const handleOptimize = async (
    passesOverride?: string[],
    navigateAfter?: NavSection
  ): Promise<OptimizeResponse | null> => {
    setOptimizing(true);
    try {
      const passesToRun = passesOverride ?? selectedPasses;
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          program_name: programName,
          passes: passesToRun,
          save: true,
        }),
      });
      const data = (await res.json()) as OptimizeResponse;
      if (!data.success) {
        if (data.compile) setCompileResult(data.compile);
        showToast("error", data.error || "Optimization failed due to compile errors.");
        return null;
      }
      setCompileResult(data.compile);
      setOptimization(data.optimization);
      setRecommendations(data.recommendations);
      if (data.history_id) setActiveHistoryId(data.history_id);
      showToast(
        "success",
        `Applied ${data.optimization.total_transformations} transformation(s); IR instructions: ${data.optimization.ir_instruction_delta.original} → ${data.optimization.ir_instruction_delta.optimized}.`
      );
      if (navigateAfter) setSection(navigateAfter);
      return data;
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Optimization failed.");
      return null;
    } finally {
      setOptimizing(false);
    }
  };

  const handleRunBenchmark = async () => {
    setBenchmarking(true);
    try {
      let optData = optimization;
      let compData = compileResult;
      let recData = recommendations;

      if (!optData || optData.original_code !== code) {
        const freshOpt = await handleOptimize(selectedPasses);
        if (!freshOpt) {
          setBenchmarking(false);
          return;
        }
        optData = freshOpt.optimization;
        compData = freshOpt.compile;
        recData = freshOpt.recommendations;
      }

      const appliedNames = optData.pass_results
        .filter((p) => p.applied)
        .map((p) => p.name);

      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_code: code,
          optimized_code: optData.optimized_code,
          runs: settings.benchmarkRuns,
          compiler_flag: settings.compilerFlag,
          program_name: programName,
          applied_passes: appliedNames,
          recommendations: recData?.recommendations ?? [],
          original_ir_text: compData?.ir?.text ?? optData.original_ir.text,
          optimized_ir_text: optData.optimized_ir.text,
          save: true,
        }),
      });

      const data = (await res.json()) as BenchmarkResult;
      setBenchmark(data);
      if (data.success) {
        if (data.history_id) setActiveHistoryId(data.history_id);
        showToast(
          "success",
          `Benchmark complete: ${data.deltas?.execution_time_improvement_pct ?? 0}% execution time delta.`
        );
      } else {
        showToast("error", data.error || "Benchmark failed.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Benchmark error.");
    } finally {
      setBenchmarking(false);
    }
  };

  const handleLoadDemo = async () => {
    try {
      const res = await fetch("/api/demo/load", { method: "POST" });
      const data = await res.json();
      showToast("success", `Loaded ${data.loaded ?? 0} demonstration benchmark session(s).`);
      setSettingsMsg("Demonstration sessions populated with real gcc benchmark telemetry.");
      fetchOverview();
      fetchHistory();
    } catch {
      showToast("error", "Failed to load demonstration sessions.");
    }
  };

  const handleClearUserHistory = async () => {
    try {
      const res = await fetch("/api/history/clear", { method: "POST" });
      const data = await res.json();
      setSettingsMsg(`Cleared ${data.cleared ?? 0} user history record(s).`);
      fetchOverview();
      fetchHistory();
    } catch {
      showToast("error", "Failed to clear history.");
    }
  };

  const handleDeleteRecord = async (id: number) => {
    try {
      await fetch(`/api/history/${id}`, { method: "DELETE" });
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
      showToast("success", `Deleted session #${id}.`);
    } catch {
      showToast("error", "Failed to delete session.");
    }
  };

  const handleDownloadPDF = async (id: number) => {
    try {
      const res = await fetch(`/api/reports/${id}?format=json`);
      const data = (await res.json()) as { report?: ReportPayload; error?: string };
      if (!data.report) {
        showToast("error", data.error || "Report not found.");
        return;
      }
      downloadReportPDF(data.report);
      showToast("success", `Downloaded PDF report #${id}.`);
    } catch {
      showToast("error", "PDF generation failed.");
    }
  };

  const handleDownloadCSV = (id: number) => {
    window.location.assign(`/api/reports/${id}?format=csv`);
    showToast("success", `Exported CSV report #${id}.`);
  };

  const handleExportBenchmarkJSON = () => {
    if (!benchmark) return;
    const blob = new Blob([JSON.stringify(benchmark, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${programName.replace(/\.[^.]+$/, "")}_benchmark.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenHistoryRecord = async (rec: HistoryRecord) => {
    setCode(rec.original_code);
    setProgramName(rec.program_name);
    setLanguage(rec.language);
    setActiveHistoryId(rec.id);
    if (rec.benchmark) setBenchmark(rec.benchmark);
    setSection("compiler");
    showToast("success", `Loaded session #${rec.id} (${rec.program_name}) into workspace.`);
    // Recompile immediately to populate AST/Tokens/IR tabs
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: rec.original_code,
          language: rec.language,
          program_name: rec.program_name,
          passes: selectedPasses,
          save: false,
        }),
      });
      const data = (await res.json()) as OptimizeResponse;
      if (data.success) {
        setCompileResult(data.compile);
        setOptimization(data.optimization);
        setRecommendations(data.recommendations);
      }
    } catch {
      // handled gracefully
    }
  };

  if (section === "landing") {
    return (
      <LandingPage
        onLaunch={(target) => {
          setSection(target ?? "compiler");
        }}
      />
    );
  }

  const currentNavLabel =
    NAV_ITEMS.find((n) => n.id === section)?.label ?? "Workspace";

  return (
    <div className="min-h-screen bg-[#080B12] text-slate-100 flex">
      {/* Desktop Sidebar (252px) */}
      <aside className="hidden lg:flex w-[252px] shrink-0 flex-col border-r border-slate-800/80 bg-[#0B0F1A]">
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSection("landing")}
            className="font-display text-base font-bold tracking-tight text-white hover:text-cyan-300 transition-colors cursor-pointer"
          >
            OptiForge-OS
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-[#101522] text-cyan-400 border border-slate-700/80"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setSection("landing")}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-[#101522] border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Landing Overview
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 bg-[#0B0F1A] border-r border-slate-800 flex flex-col z-10">
            <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
              <span className="font-display text-base font-bold text-white">
                OptiForge-OS
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium ${
                      active
                        ? "bg-[#101522] text-cyan-400 border border-slate-700/80"
                        : "text-slate-400 hover:text-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Breadcrumb Bar */}
        <header className="h-16 px-5 lg:px-8 border-b border-slate-800/80 bg-[#080B12]/90 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation"
              className="lg:hidden p-2 text-slate-300 hover:text-white bg-[#101522] border border-slate-800 rounded-lg"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
              <span className="font-medium text-slate-300">OptiForge-OS</span>
              <span>/</span>
              <span className="text-white font-semibold">{currentNavLabel}</span>
              <span className="hidden sm:inline text-slate-600">·</span>
              <span className="hidden sm:inline font-mono text-cyan-400 truncate">
                {programName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleOptimize(selectedPasses)}
              disabled={optimizing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {optimizing ? "Optimizing..." : "Quick Optimize"}
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div className="px-5 lg:px-8 pt-4">
            <div
              className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                toast.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-200"
              }`}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-slate-400 hover:text-white ml-4 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Active View Viewport */}
        <main className="flex-1 p-5 lg:p-8 max-w-[1440px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              {section === "overview" && (
                <OverviewDashboard
                  overview={overview}
                  system={systemSnapshot}
                  monitorHistory={monitorHistory}
                  loading={overviewLoading}
                  includeDemoData={settings.includeDemoData}
                  onLoadDemo={handleLoadDemo}
                  onNavigate={(s) => setSection(s)}
                  onOpenRecord={handleOpenHistoryRecord}
                />
              )}

              {section === "compiler" && (
                <CodeCompilerView
                  code={code}
                  programName={programName}
                  language={language}
                  samples={samples}
                  languages={languages}
                  compileResult={compileResult}
                  compiling={compiling}
                  optimizing={optimizing}
                  onCodeChange={(val) => setCode(val)}
                  onProgramNameChange={(name) => setProgramName(name)}
                  onLanguageChange={(lang) => setLanguage(lang)}
                  onSelectSample={(sample) => {
                    setCode(sample.code);
                    setProgramName(sample.filename);
                    setLanguage(sample.language);
                    setCompileResult(null);
                    setOptimization(null);
                    setRecommendations(null);
                    setBenchmark(null);
                    showToast("success", `Loaded sample: ${sample.name}`);
                  }}
                  onCompile={handleCompile}
                  onOptimizeAndOpen={() => handleOptimize(selectedPasses, "optimizer")}
                  onReset={() => {
                    setCode(DEFAULT_CODE);
                    setProgramName("loop_invariant.c");
                    setLanguage("c");
                    setCompileResult(null);
                    setOptimization(null);
                    setRecommendations(null);
                    setBenchmark(null);
                  }}
                  onClear={() => {
                    setCode("");
                    setCompileResult(null);
                    setOptimization(null);
                  }}
                />
              )}

              {section === "optimizer" && (
                <OptimizationEngineView
                  programName={programName}
                  originalCode={code}
                  selectedPasses={selectedPasses}
                  optimization={optimization}
                  recommendations={recommendations}
                  recommending={recommending}
                  optimizing={optimizing}
                  onTogglePass={(pid) =>
                    setSelectedPasses((prev) =>
                      prev.includes(pid)
                        ? prev.filter((x) => x !== pid)
                        : [...prev, pid]
                    )
                  }
                  onAnalyzeRecommendations={handleAnalyzeRecommendations}
                  onApplyRecommended={() => {
                    if (recommendations?.recommended_pass_ids) {
                      setSelectedPasses(recommendations.recommended_pass_ids);
                      handleOptimize(recommendations.recommended_pass_ids);
                    }
                  }}
                  onRunOptimization={() => handleOptimize(selectedPasses)}
                  onNavigate={(s) => setSection(s)}
                />
              )}

              {section === "ir-explorer" && (
                <IRExplorerView
                  programName={programName}
                  code={code}
                  compileResult={compileResult}
                  optimization={optimization}
                  onRunCompileAndOptimize={() => handleOptimize(selectedPasses)}
                />
              )}

              {section === "monitor" && (
                <ResourceMonitorView
                  system={systemSnapshot}
                  monitorHistory={monitorHistory}
                  latestBenchmark={benchmark}
                  pollingEnabled={pollingEnabled}
                  onTogglePolling={() => setPollingEnabled((p) => !p)}
                  onRefreshNow={fetchMonitorSnapshot}
                />
              )}

              {section === "benchmark" && (
                <BenchmarkAnalysisView
                  programName={programName}
                  originalCode={code}
                  optimizedCode={optimization?.optimized_code ?? null}
                  benchmark={benchmark}
                  running={benchmarking}
                  runsCount={settings.benchmarkRuns}
                  compilerFlag={settings.compilerFlag}
                  onRunBenchmark={handleRunBenchmark}
                  onExportCSV={() => {
                    if (activeHistoryId) handleDownloadCSV(activeHistoryId);
                    else showToast("error", "Run benchmark to persist a reportable session first.");
                  }}
                  onExportPDF={() => {
                    if (activeHistoryId) handleDownloadPDF(activeHistoryId);
                    else showToast("error", "Run benchmark to persist a reportable session first.");
                  }}
                  onExportJSON={handleExportBenchmarkJSON}
                />
              )}

              {section === "history" && (
                <OptimizationHistoryView
                  items={historyItems}
                  loading={historyLoading}
                  onOpenRecord={handleOpenHistoryRecord}
                  onDeleteRecord={handleDeleteRecord}
                  onDownloadPDF={handleDownloadPDF}
                  onDownloadCSV={handleDownloadCSV}
                  onLoadDemo={handleLoadDemo}
                />
              )}

              {section === "settings" && (
                <SettingsView
                  settings={settings}
                  onUpdateSettings={(patch) =>
                    setSettings((prev) => ({ ...prev, ...patch }))
                  }
                  onLoadDemo={handleLoadDemo}
                  onClearUserHistory={handleClearUserHistory}
                  statusMessage={settingsMsg}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
