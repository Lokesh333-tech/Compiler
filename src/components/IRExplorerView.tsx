import { useState } from "react";
import { ArrowRight, GitBranch, Play } from "lucide-react";
import ASTTreeViewer from "./ASTTreeViewer";
import type { CompileResult, OptimizationData } from "../types/compiler";

interface IRExplorerViewProps {
  programName: string;
  code: string;
  compileResult: CompileResult | null;
  optimization: OptimizationData | null;
  onRunCompileAndOptimize: () => void;
}

type ExplorerPanel = "ir-diff" | "ast" | "tokens" | "symbols" | "source";

export default function IRExplorerView({
  programName,
  code,
  compileResult,
  optimization,
  onRunCompileAndOptimize,
}: IRExplorerViewProps) {
  const [panel, setPanel] = useState<ExplorerPanel>("ir-diff");
  const [expandAllDepth, setExpandAllDepth] = useState(3);

  const origIR = optimization?.original_ir ?? compileResult?.ir;
  const optIR = optimization?.optimized_ir;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Intermediate Representation Explorer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspect lexical tokens, hierarchical AST nodes, symbol usage, and Three-Address Code IR transformations for{" "}
            <span className="font-mono text-slate-200">{programName}</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={onRunCompileAndOptimize}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          Compile & Refresh IR
        </button>
      </div>

      {/* Visual Compiler Pipeline Bar */}
      <div className="p-4 rounded-xl bg-[#101522] border border-slate-800/90">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { id: "source", label: "Source Code", stat: `${code.split("\n").length} lines` },
            { id: "tokens", label: "Tokens", stat: `${compileResult?.tokens.length ?? 0} lexemes` },
            { id: "ast", label: "AST", stat: `${compileResult?.ast_stats?.total_nodes ?? 0} nodes` },
            { id: "symbols", label: "Symbol Table", stat: `${compileResult?.symbols.length ?? 0} entries` },
            {
              id: "ir-diff",
              label: "Three-Address IR",
              stat: origIR
                ? optIR
                  ? `${origIR.instruction_count} → ${optIR.instruction_count} ops`
                  : `${origIR.instruction_count} ops`
                : "Not generated",
            },
          ].map((step, idx, arr) => (
            <div key={step.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPanel(step.id as ExplorerPanel)}
                className={`px-3.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                  panel === step.id
                    ? "bg-[#080B12] border-cyan-500/70 text-white"
                    : "bg-[#080B12]/60 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="font-medium">{step.label}</div>
                <div className="font-mono text-[11px] text-cyan-400 tabular-nums mt-0.5">
                  {step.stat}
                </div>
              </button>
              {idx < arr.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-600 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Active Explorer Content */}
      {!compileResult ? (
        <div className="p-10 rounded-xl bg-[#101522] border border-slate-800 text-center space-y-3">
          <GitBranch className="w-8 h-8 text-cyan-400 mx-auto" />
          <p className="text-sm text-slate-300 font-medium">
            No IR generated yet for this workspace session
          </p>
          <p className="text-xs text-slate-400">
            Click Compile & Refresh IR to generate tokens, AST, symbol table, and before/after Three-Address Code.
          </p>
        </div>
      ) : panel === "ir-diff" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Original Three-Address Code */}
            <div className="rounded-xl bg-[#101522] border border-slate-800/90 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 bg-[#0B0F1A] flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  Original Three-Address Code (Pre-Optimization)
                </span>
                <span className="font-mono text-slate-400 tabular-nums">
                  {origIR?.instruction_count ?? 0} instructions
                </span>
              </div>
              <div className="p-4 font-mono text-xs space-y-1 max-h-[520px] overflow-auto">
                {origIR?.instructions.map((inst) => (
                  <div
                    key={inst.index}
                    className="flex items-center gap-3 px-2 py-1 rounded hover:bg-slate-800/40"
                  >
                    <span className="w-6 text-right text-slate-600 tabular-nums select-none">
                      {inst.index}
                    </span>
                    <span className="w-24 truncate text-slate-500 shrink-0">
                      {inst.block}
                    </span>
                    <span className="text-slate-200">{inst.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Optimized Three-Address Code */}
            <div className="rounded-xl bg-[#101522] border border-cyan-500/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 bg-[#0B0F1A] flex items-center justify-between text-xs">
                <span className="font-semibold text-cyan-300">
                  Optimized Three-Address Code (Post-Optimization)
                </span>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {optIR
                    ? `${optIR.instruction_count} instructions (${optimization?.ir_instruction_delta.reduction_percent}% reduction)`
                    : "Run optimization"}
                </span>
              </div>
              <div className="p-4 font-mono text-xs space-y-1 max-h-[520px] overflow-auto">
                {optIR ? (
                  optIR.instructions.map((inst) => (
                    <div
                      key={inst.index}
                      className="flex items-center gap-3 px-2 py-1 rounded hover:bg-slate-800/40"
                    >
                      <span className="w-6 text-right text-slate-600 tabular-nums select-none">
                        {inst.index}
                      </span>
                      <span className="w-24 truncate text-purple-400 shrink-0">
                        {inst.block}
                      </span>
                      <span className="text-cyan-200">{inst.text}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 py-8 text-center">
                    Click Compile & Refresh IR to view post-optimization Three-Address Code.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : panel === "ast" ? (
        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-white">
              Interactive Abstract Syntax Tree
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpandAllDepth((d) => (d >= 12 ? 2 : 15))}
                className="px-3 py-1 text-xs font-medium text-slate-200 bg-[#080B12] hover:bg-slate-800 border border-slate-700 rounded cursor-pointer"
              >
                {expandAllDepth >= 12 ? "Collapse Deep Nodes" : "Expand All Nodes"}
              </button>
            </div>
          </div>
          {compileResult.ast ? (
            <div className="p-4 rounded-lg bg-[#080B12] border border-slate-800 overflow-auto max-h-[540px]">
              <ASTTreeViewer
                key={expandAllDepth}
                node={compileResult.ast}
                defaultExpandedDepth={expandAllDepth}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-400">AST not available.</p>
          )}
        </div>
      ) : panel === "tokens" ? (
        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90 overflow-auto max-h-[560px]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Token Type</th>
                <th className="py-2 pr-4">Value</th>
                <th className="py-2 text-right">Line : Col</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {compileResult.tokens.map((tok) => (
                <tr key={tok.id}>
                  <td className="py-1.5 pr-4 text-slate-500 tabular-nums">{tok.id}</td>
                  <td className="py-1.5 pr-4 text-cyan-400">{tok.type}</td>
                  <td className="py-1.5 pr-4 text-slate-100">{tok.value}</td>
                  <td className="py-1.5 text-right text-slate-500 tabular-nums">
                    {tok.line}:{tok.column}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : panel === "symbols" ? (
        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90 overflow-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 pr-4">Identifier</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Kind</th>
                <th className="py-2 pr-4">Scope</th>
                <th className="py-2 pr-4">Line</th>
                <th className="py-2 text-right">Reads / Writes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {compileResult.symbols.map((s, idx) => (
                <tr key={`${s.name}-${idx}`}>
                  <td className="py-2 pr-4 text-white font-semibold">{s.name}</td>
                  <td className="py-2 pr-4 text-cyan-400">{s.dataType}</td>
                  <td className="py-2 pr-4 text-slate-300">{s.kind}</td>
                  <td className="py-2 pr-4 text-slate-400">{s.scope}</td>
                  <td className="py-2 pr-4 text-slate-400 tabular-nums">{s.line}</td>
                  <td className="py-2 text-right text-slate-200 tabular-nums">
                    {s.reads} / {s.writes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5 rounded-xl bg-[#101522] border border-slate-800/90">
          <pre className="p-4 rounded-lg bg-[#080B12] border border-slate-800 font-mono text-xs text-slate-200 overflow-auto max-h-[520px] leading-relaxed">
            {code}
          </pre>
        </div>
      )}
    </div>
  );
}
