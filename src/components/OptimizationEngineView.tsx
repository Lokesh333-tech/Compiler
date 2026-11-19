import {
  Sparkles,
  Play,
  CheckCircle2,
  Circle,
  ArrowRight,
  Cpu,
  Wand2,
} from "lucide-react";
import type {
  OptimizationData,
  RecommendResult,
  NavSection,
} from "../types/compiler";

interface OptimizationEngineViewProps {
  programName: string;
  originalCode: string;
  selectedPasses: string[];
  optimization: OptimizationData | null;
  recommendations: RecommendResult | null;
  recommending: boolean;
  optimizing: boolean;
  onTogglePass: (passId: string) => void;
  onAnalyzeRecommendations: () => void;
  onApplyRecommended: () => void;
  onRunOptimization: () => void;
  onNavigate: (section: NavSection) => void;
}

const PASS_LIST = [
  {
    id: "constant_folding",
    name: "Constant Folding",
    summary: "Evaluates constant arithmetic expressions at compile time.",
  },
  {
    id: "constant_propagation",
    name: "Constant Propagation",
    summary: "Substitutes known constant variables into downstream expressions.",
  },
  {
    id: "dead_code_elimination",
    name: "Dead Code Elimination",
    summary: "Removes unreachable branches and unused assignments.",
  },
  {
    id: "common_subexpression_elimination",
    name: "Common Subexpression Elimination",
    summary: "Reuses previously evaluated identical subexpressions.",
  },
  {
    id: "loop_optimization",
    name: "Loop Optimization (LICM)",
    summary: "Hoists loop-invariant computations outside loop boundaries.",
  },
];

export default function OptimizationEngineView({
  programName,
  originalCode,
  selectedPasses,
  optimization,
  recommendations,
  recommending,
  optimizing,
  onTogglePass,
  onAnalyzeRecommendations,
  onApplyRecommended,
  onRunOptimization,
  onNavigate,
}: OptimizationEngineViewProps) {
  const passResults = optimization?.pass_results ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            AI Optimization Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspect AST/IR patterns on <span className="font-mono text-slate-200">{programName}</span>, review pass recommendations, and apply compiler transformations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={recommending}
            onClick={onAnalyzeRecommendations}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-purple-200 bg-[#101522] hover:bg-slate-800 border border-purple-500/40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            {recommending ? "Analyzing AST/IR..." : "Analyze & Recommend"}
          </button>

          <button
            type="button"
            disabled={optimizing}
            onClick={onRunOptimization}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {optimizing ? "Optimizing..." : "Run Selected Passes"}
          </button>

          {optimization && (
            <button
              type="button"
              onClick={() => onNavigate("benchmark")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Benchmark Result
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* AI Recommendation Panel */}
      <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-white inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              AI Recommendation Engine
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Engine: <span className="font-mono text-cyan-400">{recommendations?.engine ?? "Rule-Based AST/IR Analyzer + Optional Gemini"}</span>
            </p>
          </div>

          {recommendations && recommendations.recommended_pass_ids.length > 0 && (
            <button
              type="button"
              onClick={onApplyRecommended}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-purple-400 hover:bg-purple-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Apply Recommended Passes ({recommendations.recommended_pass_ids.length})
            </button>
          )}
        </div>

        {!recommendations ? (
          <div className="p-5 rounded-lg bg-[#080B12] border border-slate-800/80 text-xs text-slate-400">
            Click <strong className="text-slate-200">Analyze & Recommend</strong> to inspect constant expressions, unused variables, common subexpressions, and loop invariants in the current program.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Detected Structural Patterns */}
            <div className="lg:col-span-5 p-4 rounded-lg bg-[#080B12] border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-200">
                Detected Program Characteristics
              </div>
              {recommendations.ai_summary && (
                <p className="text-xs text-purple-200/90 leading-relaxed pb-2 border-b border-slate-800">
                  {recommendations.ai_summary}
                </p>
              )}
              {recommendations.detected_patterns.length > 0 ? (
                <ul className="space-y-2.5 text-xs">
                  {recommendations.detected_patterns.map((pat, idx) => (
                    <li key={idx} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 font-medium">{pat.pattern}</span>
                        <span className="font-mono text-cyan-400 tabular-nums">
                          {pat.count} site(s)
                        </span>
                      </div>
                      {pat.examples.length > 0 && (
                        <div className="font-mono text-[11px] text-slate-400 truncate">
                          {pat.examples.join(" · ")}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  No redundant expressions, unused variables, or loop-invariant patterns detected.
                </p>
              )}
            </div>

            {/* Recommended Optimization Passes */}
            <div className="lg:col-span-7 space-y-2.5">
              {recommendations.recommendations.length > 0 ? (
                recommendations.recommendations.map((rec) => (
                  <div
                    key={rec.pass_id}
                    className="p-3.5 rounded-lg bg-[#080B12] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 text-xs">
                        <span className="font-semibold text-white">{rec.pass_name}</span>
                        <span className="text-slate-500">·</span>
                        <span className="font-mono text-slate-400 capitalize">
                          Priority: {rec.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{rec.reason}</p>
                      {rec.ai_note && (
                        <p className="text-xs text-purple-300/90 mt-1">
                          Gemini insight: {rec.ai_note}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-semibold text-cyan-400 tabular-nums">
                        {Math.round(rec.confidence * 100)}%
                      </div>
                      <div className="text-[11px] text-slate-500">Confidence</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-lg bg-[#080B12] border border-slate-800 text-xs text-slate-400">
                  Current code already appears clean under supported static passes.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual Pass Selection & Per-Pass Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 p-5 rounded-xl bg-[#101522] border border-slate-800/90 space-y-3">
          <h2 className="font-display text-sm font-semibold text-white">
            Optimization Passes
          </h2>
          <p className="text-xs text-slate-400">
            Toggle passes manually or apply the AI recommendation set.
          </p>

          <div className="space-y-2 pt-1">
            {PASS_LIST.map((pass) => {
              const active = selectedPasses.includes(pass.id);
              const res = passResults.find((p) => p.id === pass.id);
              return (
                <button
                  key={pass.id}
                  type="button"
                  onClick={() => onTogglePass(pass.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? "bg-[#080B12] border-cyan-500/60"
                      : "bg-[#080B12]/50 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                      {active ? (
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                      )}
                      {pass.name}
                    </span>
                    {res && (
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          res.applied ? "text-emerald-400" : "text-slate-500"
                        }`}
                      >
                        {res.applied ? `${res.changes_count} applied` : "0 changes"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 pl-6">
                    {pass.summary}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Side-by-Side Original vs Optimized Code + Pass Details */}
        <div className="lg:col-span-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[#101522] border border-slate-800/90 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800 bg-[#0B0F1A] flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">Original Source Code</span>
                <span className="font-mono text-slate-500 tabular-nums">
                  {optimization?.original_ir.instruction_count ?? "—"} IR ops
                </span>
              </div>
              <pre className="p-4 font-mono text-xs text-slate-300 overflow-auto max-h-72 leading-relaxed">
                {optimization?.original_code ?? originalCode}
              </pre>
            </div>

            <div className="rounded-xl bg-[#101522] border border-cyan-500/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800 bg-[#0B0F1A] flex items-center justify-between text-xs">
                <span className="font-medium text-cyan-300">Optimized Source Code</span>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {optimization
                    ? `${optimization.optimized_ir.instruction_count} IR ops (${optimization.ir_instruction_delta.reduction_percent}% delta)`
                    : "Run optimization"}
                </span>
              </div>
              <pre className="p-4 font-mono text-xs text-cyan-100 overflow-auto max-h-72 leading-relaxed">
                {optimization
                  ? optimization.optimized_code
                  : "// Click 'Run Selected Passes' to generate transformed C source code."}
              </pre>
            </div>
          </div>

          {/* Detailed Pass Cards */}
          {passResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display text-sm font-semibold text-white">
                Pass Transformation Breakdown
              </h3>
              <div className="space-y-3">
                {passResults.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-[#101522] border border-slate-800/90 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="font-semibold text-white">{p.name}</span>
                        <span className="text-slate-600">·</span>
                        <span
                          className={
                            p.applied
                              ? "text-emerald-400 font-medium"
                              : "text-slate-400"
                          }
                        >
                          {p.applied ? `Applied (${p.changes_count} transformations)` : p.enabled ? "No match in source" : "Disabled"}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {p.estimated_benefit}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">{p.explanation}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                      <div className="p-2.5 rounded bg-[#080B12] border border-slate-800 text-slate-400 overflow-x-auto">
                        <div className="text-[10px] text-slate-500 mb-1">Before</div>
                        {p.before_snippet}
                      </div>
                      <div className="p-2.5 rounded bg-[#080B12] border border-slate-800 text-cyan-300 overflow-x-auto">
                        <div className="text-[10px] text-slate-500 mb-1">After</div>
                        {p.after_snippet}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
