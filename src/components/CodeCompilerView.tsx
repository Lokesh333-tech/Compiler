import { useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  Play,
  Sparkles,
  Upload,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import ASTTreeViewer from "./ASTTreeViewer";
import type {
  CompileResult,
  LanguageOption,
  SampleProgram,
} from "../types/compiler";

interface CodeCompilerViewProps {
  code: string;
  programName: string;
  language: string;
  samples: SampleProgram[];
  languages: LanguageOption[];
  compileResult: CompileResult | null;
  compiling: boolean;
  optimizing: boolean;
  onCodeChange: (newCode: string) => void;
  onProgramNameChange: (name: string) => void;
  onLanguageChange: (lang: string) => void;
  onSelectSample: (sample: SampleProgram) => void;
  onCompile: () => void;
  onOptimizeAndOpen: () => void;
  onReset: () => void;
  onClear: () => void;
}

type CompilerTab = "tokens" | "ast" | "symbols" | "ir" | "output";

export default function CodeCompilerView({
  code,
  programName,
  language,
  samples,
  languages,
  compileResult,
  compiling,
  optimizing,
  onCodeChange,
  onProgramNameChange,
  onLanguageChange,
  onSelectSample,
  onCompile,
  onOptimizeAndOpen,
  onReset,
  onClear,
}: CodeCompilerViewProps) {
  const [activeTab, setActiveTab] = useState<CompilerTab>("output");
  const [tokenFilter, setTokenFilter] = useState("ALL");
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 64 * 1024) {
      setUploadNotice("File rejected: maximum allowed source file size is 64 KB.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["c", "h", "txt"].includes(ext)) {
      setUploadNotice("Unsupported file type. Please upload a .c, .h, or .txt source file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onCodeChange(reader.result);
        onProgramNameChange(file.name);
        setUploadNotice(null);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const tokens = compileResult?.tokens ?? [];
  const filteredTokens =
    tokenFilter === "ALL" ? tokens : tokens.filter((t) => t.type === tokenFilter);
  const tokenTypes = ["ALL", ...Array.from(new Set(tokens.map((t) => t.type)))];

  const selectedLangObj = languages.find((l) => l.id === language);

  return (
    <div className="space-y-5">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Code Compiler
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Lexical analysis, recursive-descent AST generation, semantic checking, and Three-Address IR lowering.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Language Selector */}
          <select
            aria-label="Programming Language"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-[#101522] border border-slate-700/80 text-slate-200 rounded-lg focus:outline-none focus:border-cyan-400"
          >
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name} {!lang.supported ? `(${lang.status})` : ""}
              </option>
            ))}
          </select>

          {/* Sample Programs Dropdown */}
          <select
            aria-label="Load Sample Program"
            defaultValue=""
            onChange={(e) => {
              const found = samples.find((s) => s.id === e.target.value);
              if (found) onSelectSample(found);
              e.target.value = "";
            }}
            className="px-3 py-2 text-xs font-medium bg-[#101522] border border-slate-700/80 text-slate-200 rounded-lg focus:outline-none focus:border-cyan-400 max-w-[220px]"
          >
            <option value="" disabled>
              Load Sample Program...
            </option>
            {samples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.name}
              </option>
            ))}
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".c,.h,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#101522] hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>

          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#101522] hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#101522] hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          <button
            type="button"
            disabled={compiling}
            onClick={onCompile}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            {compiling ? "Compiling..." : "Compile"}
          </button>

          <button
            type="button"
            disabled={optimizing}
            onClick={onOptimizeAndOpen}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {optimizing ? "Optimizing..." : "Optimize"}
          </button>
        </div>
      </div>

      {uploadNotice && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
          {uploadNotice}
        </div>
      )}

      {selectedLangObj && !selectedLangObj.supported && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">
          {selectedLangObj.name} front-end adapter is in planned roadmap architecture. Switch to C (GCC / C11) for live compilation and benchmarking.
        </div>
      )}

      {/* Split Workspace: Monaco Editor + Tabbed Compiler Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left: Monaco Editor */}
        <div className="xl:col-span-6 rounded-xl bg-[#101522] border border-slate-800/90 overflow-hidden flex flex-col min-h-[540px]">
          <div className="px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between gap-4 bg-[#0B0F1A]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-slate-400">Source File:</span>
              <input
                type="text"
                value={programName}
                onChange={(e) => onProgramNameChange(e.target.value)}
                aria-label="Program Filename"
                className="bg-transparent font-mono text-xs text-white border-b border-transparent focus:border-cyan-400 focus:outline-none px-1 py-0.5 w-44"
              />
            </div>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {code.split("\n").length} lines · {code.length} chars
            </span>
          </div>

          <div className="flex-1 min-h-[490px]">
            <Editor
              height="500px"
              language={language === "cpp" ? "cpp" : language === "python" ? "python" : language === "java" ? "java" : "c"}
              theme="vs-dark"
              value={code}
              onChange={(val) => onCodeChange(val ?? "")}
              options={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                lineHeight: 20,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 14, bottom: 14 },
                automaticLayout: true,
                tabSize: 4,
              }}
            />
          </div>
        </div>

        {/* Right: 5 Compiler Inspection Tabs */}
        <div className="xl:col-span-6 rounded-xl bg-[#101522] border border-slate-800/90 overflow-hidden flex flex-col min-h-[540px]">
          <div className="px-3 py-2 border-b border-slate-800/80 bg-[#0B0F1A] flex items-center gap-1 overflow-x-auto">
            {(
              [
                { id: "output", label: "Compilation Output" },
                { id: "tokens", label: `Tokens (${tokens.length})` },
                { id: "ast", label: "AST" },
                { id: "symbols", label: `Symbol Table (${compileResult?.symbols.length ?? 0})` },
                { id: "ir", label: "Intermediate Representation" },
              ] as Array<{ id: CompilerTab; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[#101522] text-cyan-400 border border-slate-700/80"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-4 overflow-auto max-h-[500px]">
            {!compileResult ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <p className="text-sm text-slate-300 font-medium">
                  Ready to compile
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Click Compile to run lexical analysis, syntax parsing, semantic checks, and generate Three-Address IR.
                </p>
              </div>
            ) : activeTab === "output" ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-lg border flex items-start gap-3 ${
                    compileResult.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-200"
                  }`}
                >
                  {compileResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  )}
                  <div className="text-xs space-y-1">
                    <div className="font-semibold">
                      {compileResult.success
                        ? "Compilation Succeeded"
                        : "Compilation Failed"}
                    </div>
                    <pre className="font-mono text-[11px] whitespace-pre-wrap text-slate-300 leading-relaxed">
                      {compileResult.output}
                    </pre>
                  </div>
                </div>

                {compileResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-rose-400">
                      Errors ({compileResult.errors.length})
                    </h3>
                    {compileResult.errors.map((err, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-[#080B12] border border-rose-500/30 text-xs flex items-start gap-2.5"
                      >
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-mono text-rose-300">
                            [{err.stage}] Line {err.line}, Col {err.column}
                          </div>
                          <div className="text-slate-200 mt-0.5">{err.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {compileResult.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-amber-400">
                      Semantic Warnings ({compileResult.warnings.length})
                    </h3>
                    {compileResult.warnings.map((warn, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-[#080B12] border border-amber-500/30 text-xs flex items-start gap-2.5"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-mono text-amber-300">
                            Line {warn.line}
                          </div>
                          <div className="text-slate-200 mt-0.5">{warn.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === "tokens" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    Showing {filteredTokens.length} of {tokens.length} lexemes
                  </span>
                  <select
                    value={tokenFilter}
                    onChange={(e) => setTokenFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-[#080B12] border border-slate-700 text-slate-200 rounded"
                  >
                    {tokenTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <table className="w-full text-left text-xs font-mono">
                  <thead className="text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Lexeme</th>
                      <th className="py-2 text-right">Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTokens.map((tok) => (
                      <tr key={tok.id} className="hover:bg-slate-800/30">
                        <td className="py-1.5 pr-3 text-slate-500 tabular-nums">
                          {tok.id}
                        </td>
                        <td className="py-1.5 pr-3 text-cyan-400">{tok.type}</td>
                        <td className="py-1.5 pr-3 text-slate-100">{tok.value}</td>
                        <td className="py-1.5 text-right text-slate-500 tabular-nums">
                          {tok.line}:{tok.column}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : activeTab === "ast" ? (
              compileResult.ast ? (
                <div className="space-y-3">
                  {compileResult.ast_stats && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded bg-[#080B12] border border-slate-800">
                        <div className="text-[11px] text-slate-400">Nodes</div>
                        <div className="font-mono text-sm text-white tabular-nums">
                          {compileResult.ast_stats.total_nodes}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#080B12] border border-slate-800">
                        <div className="text-[11px] text-slate-400">Functions</div>
                        <div className="font-mono text-sm text-white tabular-nums">
                          {compileResult.ast_stats.functions}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#080B12] border border-slate-800">
                        <div className="text-[11px] text-slate-400">Loops</div>
                        <div className="font-mono text-sm text-white tabular-nums">
                          {compileResult.ast_stats.loops}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#080B12] border border-slate-800">
                        <div className="text-[11px] text-slate-400">Binary Ops</div>
                        <div className="font-mono text-sm text-white tabular-nums">
                          {compileResult.ast_stats.binary_ops}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-[#080B12] border border-slate-800">
                    <ASTTreeViewer node={compileResult.ast} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  AST unavailable due to syntax errors.
                </p>
              )
            ) : activeTab === "symbols" ? (
              compileResult.symbols.length > 0 ? (
                <table className="w-full text-left text-xs font-mono">
                  <thead className="text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Kind</th>
                      <th className="py-2 pr-3">Scope</th>
                      <th className="py-2 text-right">R / W</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {compileResult.symbols.map((sym, idx) => (
                      <tr key={`${sym.scope}-${sym.name}-${idx}`} className="hover:bg-slate-800/30">
                        <td className="py-2 pr-3 text-white font-semibold">{sym.name}</td>
                        <td className="py-2 pr-3 text-cyan-400">{sym.dataType}</td>
                        <td className="py-2 pr-3 text-slate-300">{sym.kind}</td>
                        <td className="py-2 pr-3 text-slate-400">{sym.scope}</td>
                        <td className="py-2 text-right tabular-nums text-slate-300">
                          {sym.reads} / {sym.writes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-slate-400">No symbols recorded.</p>
              )
            ) : compileResult.ir ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Three-Address Code ({compileResult.ir.instruction_count} instructions,{" "}
                    {compileResult.ir.temp_count} temporaries)
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#080B12] border border-slate-800 font-mono text-xs space-y-1">
                  {compileResult.ir.instructions.map((inst) => (
                    <div
                      key={inst.index}
                      className="flex items-center gap-3 py-0.5 hover:bg-slate-800/40 px-2 rounded"
                    >
                      <span className="text-slate-600 w-6 text-right tabular-nums select-none">
                        {inst.index}
                      </span>
                      <span className="text-purple-400 w-24 truncate shrink-0">
                        {inst.block}
                      </span>
                      <span className="text-cyan-300">{inst.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Intermediate Representation unavailable due to compilation errors.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
