import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Cpu,
  FileCode2,
  GitBranch,
  Layers,
  Activity,
  BarChart3,
  FileText,
  Sparkles,
  Terminal,
  ChevronRight,
} from "lucide-react";
import type { NavSection } from "../types/compiler";

interface LandingPageProps {
  onLaunch: (target?: NavSection) => void;
}

const PIPELINE_STAGES = [
  {
    id: "source",
    title: "Source Code",
    subtitle: "C Program Input",
    detail: "Accepts C source code via Monaco Editor or file upload with syntax validation and safety checks.",
    example: "int x = 4 * 8;\nint y = x + a;",
  },
  {
    id: "frontend",
    title: "Compiler Front-End",
    subtitle: "Lexer, Parser & Semantics",
    detail: "Tokenizes source lexemes, builds a hierarchical AST, and populates a scoped Symbol Table with usage counts.",
    example: "FunctionDecl(main) -> VarDecl(x = 4 * 8)",
  },
  {
    id: "ir",
    title: "Intermediate Representation",
    subtitle: "Three-Address Code",
    detail: "Lowers nested AST expressions into flat Three-Address Code (TAC) blocks for machine-independent analysis.",
    example: "t1 = 4 * 8\nx = t1\nt2 = x + a",
  },
  {
    id: "ai",
    title: "AI Optimizer",
    subtitle: "Pattern Inspection & Passes",
    detail: "Extracts structural AST/IR features to score and apply Folding, Propagation, CSE, DCE, and Loop Hoisting.",
    example: "Folded 4*8 -> 32; Propagated x -> 32",
  },
  {
    id: "optimized",
    title: "Optimized Code",
    subtitle: "Transformed Source & IR",
    detail: "Reconstructs clean, compilable C source alongside reduced Three-Address Code with zero dead instructions.",
    example: "t2 = 32 + a\ny = t2",
  },
  {
    id: "monitor",
    title: "OS Monitoring",
    subtitle: "Sandboxed Execution",
    detail: "Compiles both variants via gcc in isolated rlimit containers and captures real CPU, RSS memory, and page faults.",
    example: "rusage: utime, stime, maxrss, minflt",
  },
  {
    id: "report",
    title: "Performance Report",
    subtitle: "Verified Analytics & Export",
    detail: "Calculates measured percentage deltas and exports multi-section PDF and CSV engineering reports.",
    example: "Delta: -28.4% exec time · Export PDF/CSV",
  },
];

const CAPABILITIES = [
  {
    num: "01",
    title: "Intelligent Code Optimization",
    description:
      "Applies constant folding, constant propagation, dead code elimination, common subexpression elimination, and loop-invariant code motion directly over parsed ASTs.",
    target: "optimizer" as NavSection,
    icon: Layers,
  },
  {
    num: "02",
    title: "Intermediate Representation Analysis",
    description:
      "Inspect lexical tokens, expandable AST nodes, symbol usage tables, and before-and-after Three-Address Code basic blocks.",
    target: "ir-explorer" as NavSection,
    icon: GitBranch,
  },
  {
    num: "03",
    title: "AI-Powered Recommendations",
    description:
      "Combines deterministic AST/IR structural feature counting with server-side Gemini reasoning to prioritize high-impact optimization passes.",
    target: "optimizer" as NavSection,
    icon: Sparkles,
  },
  {
    num: "04",
    title: "CPU and Memory Monitoring",
    description:
      "Reads live Linux /proc host utilization alongside per-process rusage telemetry for transparent hardware resource visibility.",
    target: "monitor" as NavSection,
    icon: Activity,
  },
  {
    num: "05",
    title: "Performance Benchmarking",
    description:
      "Executes original and optimized binaries under identical gcc flags and strict resource limits to quantify real speedup and memory deltas.",
    target: "benchmark" as NavSection,
    icon: BarChart3,
  },
  {
    num: "06",
    title: "Optimization Reports",
    description:
      "Persists session history in SQLite and generates downloadable PDF and CSV engineering reports with source diffs and benchmark charts.",
    target: "history" as NavSection,
    icon: FileText,
  },
];

export default function LandingPage({ onLaunch }: LandingPageProps) {
  const [activeStage, setActiveStage] = useState(0);
  const [imgError, setImgError] = useState(false);

  const stage = PIPELINE_STAGES[activeStage];

  return (
    <div className="min-h-screen bg-[#080B12] text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#080B12]/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            OptiForge-OS
          </a>

          {/* Zone 2: 4 concise single-line text links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
            <a href="#workflow" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Pipeline
            </a>
            <a href="#capabilities" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Capabilities
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Architecture
            </a>
            <button
              type="button"
              onClick={() => onLaunch("overview")}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Dashboard
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onLaunch("compiler")}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Launch Compiler
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Section */}
        <section className="max-w-[1440px] mx-auto px-6 lg:px-10 pt-14 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="lg:col-span-6 flex flex-col justify-center"
            >
              <p className="text-xs font-medium tracking-wide text-cyan-400 mb-4">
                Compiler Front-End · Three-Address IR · OS Resource Telemetry
              </p>
              <h1
                className="font-display font-bold tracking-tight text-white leading-[1.08] mb-5"
                style={{ fontSize: "clamp(2.25rem, 4vw, 3.65rem)", textWrap: "balance" }}
              >
                Write Smarter. Compile Faster. Optimize Everything.
              </h1>
              <p className="text-base lg:text-lg text-slate-400 leading-relaxed max-w-xl mb-8">
                An AI-assisted compiler optimization platform that transforms source code into
                efficient executables while analyzing CPU, memory, and system resource consumption.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onLaunch("compiler")}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Launch Compiler
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onLaunch("overview")}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-200 bg-[#101522] hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Explore Platform
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="lg:col-span-6 flex"
            >
              <div className="relative w-full rounded-xl overflow-hidden border border-slate-800/90 bg-[#101522] min-h-[280px] lg:min-h-[380px]">
                {!imgError ? (
                  <img
                    src="/src/assets/images/hero_compiler_engine_1795101079869.jpg"
                    alt="OptiForge-OS precision silicon microprocessor and optical compiler pipeline architecture"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#101522] via-[#0B1220] to-[#080B12]">
                    <Cpu className="w-14 h-14 text-cyan-400 mb-4" />
                    <p className="font-display text-lg font-semibold text-white">
                      OptiForge-OS Compiler Core
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      Deterministic AST/IR Optimization & Sandboxed Benchmarking
                    </p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080B12] via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-slate-300 font-mono">
                  <span>GCC C11 + Custom TAC IR Engine</span>
                  <span className="text-cyan-400">Sandboxed rlimit Execution</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Animated Compiler Pipeline Workflow */}
        <section id="workflow" className="border-y border-slate-800/80 bg-[#0B0F1A]">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div>
                <h2 className="font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  End-to-End Compiler Optimization Pipeline
                </h2>
                <p className="text-sm text-slate-400 mt-2 max-w-2xl">
                  Inspect each deterministic transformation stage from raw C source code to verified hardware benchmarks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onLaunch("ir-explorer")}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open IR Explorer
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Horizontal Pipeline Nodes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
              {PIPELINE_STAGES.map((item, idx) => {
                const isActive = idx === activeStage;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveStage(idx)}
                    className={`group relative text-left p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#101522] border-cyan-500/70 text-white"
                        : "bg-[#080B12] border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[11px] tabular-nums text-cyan-400">
                        0{idx + 1}
                      </span>
                      {idx < PIPELINE_STAGES.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden lg:block" />
                      )}
                    </div>
                    <div className="font-display text-xs font-semibold leading-snug">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 truncate">
                      {item.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Stage Inspector */}
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 rounded-xl bg-[#101522] border border-slate-800/90"
            >
              <div className="lg:col-span-7 flex flex-col justify-center">
                <div className="text-xs font-medium text-cyan-400 mb-1">
                  Stage 0{activeStage + 1} · {stage.subtitle}
                </div>
                <h3 className="font-display text-xl font-bold text-white mb-2">
                  {stage.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {stage.detail}
                </p>
              </div>
              <div className="lg:col-span-5 rounded-lg bg-[#080B12] border border-slate-800 p-4 font-mono text-xs text-cyan-300 overflow-x-auto flex items-center">
                <pre className="leading-relaxed whitespace-pre-wrap">{stage.example}</pre>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section id="capabilities" className="max-w-[1440px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <div className="mb-10">
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Core Engineering Capabilities
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl">
              Every module in OptiForge-OS runs on real compilation passes, isolated OS measurement, and persistent SQLite telemetry.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <button
                  key={cap.num}
                  type="button"
                  onClick={() => onLaunch(cap.target)}
                  className="text-left p-6 rounded-xl bg-[#101522]/80 hover:bg-[#101522] border border-slate-800/80 hover:border-slate-700 transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {cap.num}.
                      </span>
                      <Icon className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <h3 className="font-display text-base font-semibold text-white mb-2">
                      {cap.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {cap.description}
                    </p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-800/70 flex items-center justify-between text-xs font-medium text-slate-400 group-hover:text-cyan-400 transition-colors">
                    <span>Open module</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* How OptiForge-OS Works */}
        <section id="how-it-works" className="border-t border-slate-800/80 bg-[#0B0F1A]">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5">
                <h2 className="font-display text-2xl lg:text-3xl font-bold text-white tracking-tight mb-4">
                  How OptiForge-OS Works
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Instead of treating compiler optimization as an opaque black box, OptiForge-OS
                  couples a transparent front-end and Three-Address Code optimizer with isolated Linux
                  execution profiling.
                </p>
                <button
                  type="button"
                  onClick={() => onLaunch("compiler")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Terminal className="w-4 h-4" />
                  Start Compiling C Code
                </button>
              </div>

              <div className="lg:col-span-7 divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl bg-[#101522]/70">
                <div className="p-5 flex gap-4">
                  <span className="font-mono text-xs text-cyan-400 pt-0.5 tabular-nums">01</span>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-white">
                      Lexical, Syntax & Semantic Front-End
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Tokenizes source code, constructs an AST, verifies variable declarations and
                      read/write counts, and lowers statements into Three-Address Code.
                    </p>
                  </div>
                </div>
                <div className="p-5 flex gap-4">
                  <span className="font-mono text-xs text-cyan-400 pt-0.5 tabular-nums">02</span>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-white">
                      AST/IR Feature Extraction & AI Recommendation
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Analyzes constant expressions, dead branches, duplicate subexpressions, and
                      loop invariants to recommend targeted passes with optional Gemini architectural insights.
                    </p>
                  </div>
                </div>
                <div className="p-5 flex gap-4">
                  <span className="font-mono text-xs text-cyan-400 pt-0.5 tabular-nums">03</span>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-white">
                      Sandboxed Benchmarking & Resource Verification
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Compiles both original and transformed code via gcc in resource-limited
                      sandboxes, recording actual execution time, CPU utilization, RSS memory, and page faults.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 bg-[#080B12]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <FileCode2 className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-300">OptiForge-OS</span>
            <span>·</span>
            <span>AI-Assisted Compiler Optimization & Resource Efficiency Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onLaunch("compiler")}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Code Compiler
            </button>
            <button
              type="button"
              onClick={() => onLaunch("monitor")}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Resource Monitor
            </button>
            <button
              type="button"
              onClick={() => onLaunch("benchmark")}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Benchmarking
            </button>
            <button
              type="button"
              onClick={() => onLaunch("history")}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Reports
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
