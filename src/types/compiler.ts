export type NavSection =
  | "landing"
  | "overview"
  | "compiler"
  | "optimizer"
  | "ir-explorer"
  | "monitor"
  | "benchmark"
  | "history"
  | "settings";

export interface Token {
  id: number;
  type: string;
  value: string;
  line: number;
  column: number;
}

export interface CompilerDiagnostic {
  stage: string;
  message: string;
  line: number;
  column: number;
  severity: "error" | "warning";
}

export interface ASTNode {
  nodeType: string;
  line?: number;
  [key: string]: unknown;
}

export interface ASTStats {
  total_nodes: number;
  functions: number;
  variables: number;
  loops: number;
  conditionals: number;
  binary_ops: number;
  calls: number;
  returns: number;
}

export interface SymbolEntry {
  name: string;
  dataType: string;
  kind: string;
  scope: string;
  line: number;
  initialized: boolean;
  reads: number;
  writes: number;
}

export interface IRInstruction {
  index: number;
  block: string;
  op: string;
  dest: string | null;
  arg1: string | null;
  arg2: string | null;
  text: string;
  line: number;
}

export interface IRBasicBlock {
  name: string;
  instructions: IRInstruction[];
}

export interface IRResult {
  instructions: IRInstruction[];
  text: string;
  basic_blocks: IRBasicBlock[];
  temp_count: number;
  instruction_count: number;
}

export interface CompileResult {
  success: boolean;
  errors: CompilerDiagnostic[];
  warnings: CompilerDiagnostic[];
  tokens: Token[];
  ast: ASTNode | null;
  ast_stats?: ASTStats;
  symbols: SymbolEntry[];
  ir: IRResult | null;
  output: string;
}

export interface PassResult {
  id: string;
  name: string;
  description: string;
  estimated_benefit: string;
  enabled: boolean;
  applied: boolean;
  changes_count: number;
  before_snippet: string;
  after_snippet: string;
  explanation: string;
}

export interface OptimizationData {
  original_code: string;
  optimized_code: string;
  optimized_ast: ASTNode;
  original_ir: IRResult;
  optimized_ir: IRResult;
  pass_results: PassResult[];
  total_transformations: number;
  ir_instruction_delta: {
    original: number;
    optimized: number;
    reduction_percent: number;
  };
}

export interface DetectedPattern {
  pattern: string;
  count: number;
  examples: string[];
}

export interface AIRecommendation {
  pass_id: string;
  pass_name: string;
  confidence: number;
  priority: string;
  reason: string;
  ai_note?: string;
}

export interface RecommendResult {
  success: boolean;
  error?: string;
  engine: string;
  ai_summary?: string | null;
  features: {
    constant_expressions: string[];
    propagable_constants: string[];
    unused_variables: string[];
    dead_branches: string[];
    repeated_subexpressions: string[];
    loop_invariants: string[];
    loop_count: number;
    ir_instructions: number;
  };
  detected_patterns: DetectedPattern[];
  recommendations: AIRecommendation[];
  recommended_pass_ids: string[];
}

export interface OptimizeResponse {
  success: boolean;
  error?: string;
  history_id: number | null;
  compile: CompileResult;
  optimization: OptimizationData;
  recommendations: RecommendResult;
}

export interface ProcessMetrics {
  success: boolean;
  error?: string;
  runs: number;
  compiler_flag: string;
  compile_time_ms: number;
  binary_size_bytes: number;
  execution_time_ms: number;
  user_cpu_ms: number;
  system_cpu_ms: number;
  cpu_utilization_percent: number;
  memory_rss_kb: number;
  memory_rss_mb: number;
  minor_page_faults: number;
  context_switches: number;
  thread_count: number;
  exit_code: number;
  stdout: string;
}

export interface BenchmarkResult {
  success: boolean;
  error?: string;
  security_violations?: string[];
  history_id?: number | null;
  scope?: string;
  sandbox?: {
    compiler: string;
    cpu_limit_seconds: number;
    memory_limit_mb: number;
    runs_averaged: number;
    network_isolated: boolean;
  };
  formulas?: {
    improvement_percent: string;
    cpu_utilization: string;
  };
  original?: ProcessMetrics;
  optimized?: ProcessMetrics;
  deltas?: {
    execution_time_diff_ms: number;
    execution_time_improvement_pct: number;
    cpu_utilization_diff_pct: number;
    cpu_improvement_pct: number;
    memory_diff_kb: number;
    memory_improvement_pct: number;
    binary_size_diff_bytes: number;
    binary_size_improvement_pct: number;
    page_faults_diff: number;
  };
}

export interface SystemSnapshot {
  timestamp: number;
  scope: string;
  os: {
    system: string;
    release: string;
    arch: string;
    cpu_model: string;
    cpu_cores: number;
    uptime_seconds: number;
  };
  cpu: {
    utilization_percent: number;
    user_percent: number;
    system_percent: number;
    iowait_percent: number;
    load_avg_1m: number;
    load_avg_5m: number;
    load_avg_15m: number;
  };
  memory: {
    total_mb: number;
    used_mb: number;
    available_mb: number;
    cached_mb: number;
    buffers_mb: number;
    utilization_percent: number;
  };
  process: {
    pid: number;
    threads: number;
    rss_mb: number;
    vms_mb: number;
    voluntary_ctx_switches: number;
    nonvoluntary_ctx_switches: number;
  };
  syscalls: {
    measured: boolean;
    note: string;
  };
}

export interface HistoryRecord {
  id: number;
  program_name: string;
  language: string;
  created_at: number;
  original_code: string;
  optimized_code: string;
  applied_passes: string[];
  recommendations: AIRecommendation[];
  original_ir_text: string;
  optimized_ir_text: string;
  benchmark: BenchmarkResult | null;
  execution_time_ms: number | null;
  memory_kb: number | null;
  improvement_pct: number | null;
  status: string;
  is_demo: boolean;
}

export interface OverviewSummary {
  total_programs_analyzed: number;
  successful_optimizations: number;
  average_execution_time_ms: number | null;
  average_memory_kb: number | null;
  recent_history: HistoryRecord[];
  latest_recommendations: AIRecommendation[];
  activity_series: Array<{
    id: number;
    name: string;
    passes: number;
    execution_ms: number;
    memory_kb: number;
    improvement_pct: number;
  }>;
}

export interface ReportPayload {
  project_title: string;
  report_id: number;
  program_name: string;
  language: string;
  generated_at: number;
  is_demo: boolean;
  original_source_code: string;
  optimized_source_code: string;
  original_ir: string;
  optimized_ir: string;
  applied_optimizations: string[];
  ai_recommendations: AIRecommendation[];
  original_performance: ProcessMetrics | null;
  optimized_performance: ProcessMetrics | null;
  performance_deltas: BenchmarkResult["deltas"] | null;
  final_analysis: string;
}

export interface SampleProgram {
  id: string;
  name: string;
  filename: string;
  language: string;
  description: string;
  code: string;
}

export interface LanguageOption {
  id: string;
  name: string;
  supported: boolean;
  status: string;
}

export interface AppSettings {
  compilerFlag: "-O0" | "-O1" | "-O2";
  benchmarkRuns: 3 | 5 | 10;
  monitorIntervalMs: 2000 | 5000 | 10000;
  includeDemoData: boolean;
}
