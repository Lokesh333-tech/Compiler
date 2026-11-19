"""SQLite persistence, history management, and report generation for OptiForge-OS."""

import csv
import io
import json
import os
import sqlite3
import time
from typing import Any, Dict, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "optiforge.db")

SAMPLE_PROGRAMS = [
    {
        "id": "basic_arithmetic",
        "name": "Basic Arithmetic Pipeline",
        "filename": "arithmetic_eval.c",
        "language": "c",
        "description": "Demonstrates multi-step integer arithmetic expressions with variable dependencies and return folding.",
        "code": """#include <stdio.h>

int main() {
    int base = 16;
    int offset = 8;
    int factor = 4;
    int result = (base + offset) * factor;
    int adjusted = result - 12;
    printf("Result: %d\\n", adjusted);
    return 0;
}
""",
    },
    {
        "id": "constant_expression",
        "name": "Constant Expression & Propagation",
        "filename": "constant_chain.c",
        "language": "c",
        "description": "Showcases nested compile-time constants and variable constant propagation chains.",
        "code": """#include <stdio.h>

int main() {
    int width = 4 * 8;
    int height = 10 + 20 * 2;
    int depth = 2 + 3;
    int volume = width * height * depth;
    int area = width * height;
    int checksum = volume + area + (64 / 4);
    printf("Volume: %d, Checksum: %d\\n", volume, checksum);
    return 0;
}
""",
    },
    {
        "id": "dead_code",
        "name": "Dead Code & Unreachable Branches",
        "filename": "dead_branches.c",
        "language": "c",
        "description": "Contains unused temporary computations, constant-false conditional branches, and unreachable statements.",
        "code": """#include <stdio.h>

int main() {
    int active = 25 + 15;
    int unused_temp = 100 * 50;
    int unused_flag = 999;

    if (0) {
        active = active + 500;
        printf("Never executed\\n");
    }

    int output = active * 2;
    printf("Output: %d\\n", output);
    return 0;

    int unreachable = output + 42;
    printf("Unreachable: %d\\n", unreachable);
}
""",
    },
    {
        "id": "common_subexpression",
        "name": "Common Subexpression Elimination",
        "filename": "cse_workload.c",
        "language": "c",
        "description": "Repeats identical arithmetic subexpressions across multiple statements and variables.",
        "code": """#include <stdio.h>

int compute(int a, int b) {
    int x = a * b + 16;
    int y = a * b + 16;
    int z = (a * b + 16) + x + y;
    return z;
}

int main() {
    int total = 0;
    for (int i = 1; i <= 100000; i++) {
        total += compute(i, 7);
    }
    printf("Total: %d\\n", total);
    return 0;
}
""",
    },
    {
        "id": "loop_optimization",
        "name": "Loop-Invariant Code Motion (LICM)",
        "filename": "loop_invariant.c",
        "language": "c",
        "description": "Performs repeated invariant arithmetic inside a 2,000,000-iteration loop, demonstrating measurable execution speedup after LICM hoisting and CSE.",
        "code": """#include <stdio.h>

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
""",
    },
]

LANGUAGE_CATALOG = [
    {"id": "c", "name": "C (GCC / C11)", "supported": True, "status": "Active"},
    {"id": "cpp", "name": "C++ (Clang / C++20)", "supported": False, "status": "Planned Adapter"},
    {"id": "python", "name": "Python (CPython AST)", "supported": False, "status": "Planned Adapter"},
    {"id": "java", "name": "Java (JVM Bytecode)", "supported": False, "status": "Planned Adapter"},
]


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = _get_conn()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS optimization_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                program_name TEXT NOT NULL,
                language TEXT NOT NULL DEFAULT 'c',
                created_at REAL NOT NULL,
                original_code TEXT NOT NULL,
                optimized_code TEXT NOT NULL,
                applied_passes_json TEXT NOT NULL,
                recommendations_json TEXT NOT NULL,
                original_ir_text TEXT NOT NULL,
                optimized_ir_text TEXT NOT NULL,
                benchmark_json TEXT,
                execution_time_ms REAL,
                memory_kb REAL,
                improvement_pct REAL,
                status TEXT NOT NULL,
                is_demo INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def save_history_record(
    program_name: str,
    language: str,
    original_code: str,
    optimized_code: str,
    applied_passes: List[str],
    recommendations: List[Dict[str, Any]],
    original_ir_text: str,
    optimized_ir_text: str,
    benchmark: Optional[Dict[str, Any]] = None,
    status: str = "Optimized",
    is_demo: bool = False,
) -> int:
    init_db()
    exec_ms = None
    mem_kb = None
    imp_pct = None
    if benchmark and benchmark.get("success"):
        exec_ms = benchmark["optimized"]["execution_time_ms"]
        mem_kb = benchmark["optimized"]["memory_rss_kb"]
        imp_pct = benchmark["deltas"]["execution_time_improvement_pct"]

    conn = _get_conn()
    try:
        cur = conn.execute(
            """
            INSERT INTO optimization_history (
                program_name, language, created_at, original_code, optimized_code,
                applied_passes_json, recommendations_json, original_ir_text, optimized_ir_text,
                benchmark_json, execution_time_ms, memory_kb, improvement_pct, status, is_demo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                program_name,
                language,
                time.time(),
                original_code,
                optimized_code,
                json.dumps(applied_passes),
                json.dumps(recommendations),
                original_ir_text,
                optimized_ir_text,
                json.dumps(benchmark) if benchmark else None,
                exec_ms,
                mem_kb,
                imp_pct,
                status,
                1 if is_demo else 0,
            ),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "program_name": row["program_name"],
        "language": row["language"],
        "created_at": row["created_at"],
        "original_code": row["original_code"],
        "optimized_code": row["optimized_code"],
        "applied_passes": json.loads(row["applied_passes_json"]),
        "recommendations": json.loads(row["recommendations_json"]),
        "original_ir_text": row["original_ir_text"],
        "optimized_ir_text": row["optimized_ir_text"],
        "benchmark": json.loads(row["benchmark_json"]) if row["benchmark_json"] else None,
        "execution_time_ms": row["execution_time_ms"],
        "memory_kb": row["memory_kb"],
        "improvement_pct": row["improvement_pct"],
        "status": row["status"],
        "is_demo": bool(row["is_demo"]),
    }


def list_history(limit: int = 50, include_demo: bool = True) -> List[Dict[str, Any]]:
    init_db()
    conn = _get_conn()
    try:
        if include_demo:
            rows = conn.execute(
                "SELECT * FROM optimization_history ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM optimization_history WHERE is_demo = 0 ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_history_by_id(record_id: int) -> Optional[Dict[str, Any]]:
    init_db()
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM optimization_history WHERE id = ?", (record_id,)
        ).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def delete_history_by_id(record_id: int) -> bool:
    init_db()
    conn = _get_conn()
    try:
        cur = conn.execute("DELETE FROM optimization_history WHERE id = ?", (record_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def clear_non_demo_history() -> int:
    init_db()
    conn = _get_conn()
    try:
        cur = conn.execute("DELETE FROM optimization_history WHERE is_demo = 0")
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def get_overview_summary(include_demo: bool = True) -> Dict[str, Any]:
    records = list_history(limit=100, include_demo=include_demo)
    total = len(records)
    successful = sum(1 for r in records if r["status"] in ("Optimized", "Benchmarked"))
    exec_vals = [r["execution_time_ms"] for r in records if r["execution_time_ms"] is not None]
    mem_vals = [r["memory_kb"] for r in records if r["memory_kb"] is not None]

    avg_exec = round(sum(exec_vals) / len(exec_vals), 3) if exec_vals else None
    avg_mem_kb = round(sum(mem_vals) / len(mem_vals), 1) if mem_vals else None

    latest_recs: List[Dict[str, Any]] = []
    for r in records:
        if r["recommendations"]:
            latest_recs = r["recommendations"]
            break

    activity_series = []
    for r in reversed(records[:12]):
        activity_series.append({
            "id": r["id"],
            "name": r["program_name"][:18],
            "passes": len(r["applied_passes"]),
            "execution_ms": r["execution_time_ms"] or 0,
            "memory_kb": r["memory_kb"] or 0,
            "improvement_pct": r["improvement_pct"] or 0,
        })

    return {
        "total_programs_analyzed": total,
        "successful_optimizations": successful,
        "average_execution_time_ms": avg_exec,
        "average_memory_kb": avg_mem_kb,
        "recent_history": records[:8],
        "latest_recommendations": latest_recs,
        "activity_series": activity_series,
    }


def build_report_payload(record_id: int) -> Optional[Dict[str, Any]]:
    rec = get_history_by_id(record_id)
    if not rec:
        return None
    bench = rec.get("benchmark")
    orig_perf = bench.get("original") if bench and bench.get("success") else None
    opt_perf = bench.get("optimized") if bench and bench.get("success") else None
    deltas = bench.get("deltas") if bench and bench.get("success") else None

    analysis = "Compilation and IR optimization completed."
    if deltas:
        t_imp = deltas["execution_time_improvement_pct"]
        m_imp = deltas["memory_improvement_pct"]
        analysis = (
            f"Applied {len(rec['applied_passes'])} optimization pass(es). "
            f"Measured execution time delta: {t_imp}% ({deltas['execution_time_diff_ms']} ms). "
            f"Measured peak RSS memory delta: {m_imp}% ({deltas['memory_diff_kb']} KB)."
        )

    return {
        "project_title": "OptiForge-OS — AI-Assisted Compiler Optimization Report",
        "report_id": rec["id"],
        "program_name": rec["program_name"],
        "language": rec["language"].upper(),
        "generated_at": rec["created_at"],
        "is_demo": rec["is_demo"],
        "original_source_code": rec["original_code"],
        "optimized_source_code": rec["optimized_code"],
        "original_ir": rec["original_ir_text"],
        "optimized_ir": rec["optimized_ir_text"],
        "applied_optimizations": rec["applied_passes"],
        "ai_recommendations": rec["recommendations"],
        "original_performance": orig_perf,
        "optimized_performance": opt_perf,
        "performance_deltas": deltas,
        "final_analysis": analysis,
    }


def build_report_csv(payload: Dict[str, Any]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Section", "Key", "Value"])
    writer.writerow(["Project", "Title", payload["project_title"]])
    writer.writerow(["Program", "Name", payload["program_name"]])
    writer.writerow(["Program", "Language", payload["language"]])
    writer.writerow(["Program", "Report ID", payload["report_id"]])
    writer.writerow(["Optimizations", "Applied Passes", ", ".join(payload["applied_optimizations"])])

    orig = payload.get("original_performance") or {}
    opt = payload.get("optimized_performance") or {}
    deltas = payload.get("performance_deltas") or {}

    writer.writerow(["Benchmark", "Original Execution Time (ms)", orig.get("execution_time_ms", "N/A")])
    writer.writerow(["Benchmark", "Optimized Execution Time (ms)", opt.get("execution_time_ms", "N/A")])
    writer.writerow(["Benchmark", "Execution Time Improvement (%)", deltas.get("execution_time_improvement_pct", "N/A")])
    writer.writerow(["Benchmark", "Original CPU Utilization (%)", orig.get("cpu_utilization_percent", "N/A")])
    writer.writerow(["Benchmark", "Optimized CPU Utilization (%)", opt.get("cpu_utilization_percent", "N/A")])
    writer.writerow(["Benchmark", "Original Memory RSS (KB)", orig.get("memory_rss_kb", "N/A")])
    writer.writerow(["Benchmark", "Optimized Memory RSS (KB)", opt.get("memory_rss_kb", "N/A")])
    writer.writerow(["Benchmark", "Original Binary Size (bytes)", orig.get("binary_size_bytes", "N/A")])
    writer.writerow(["Benchmark", "Optimized Binary Size (bytes)", opt.get("binary_size_bytes", "N/A")])
    writer.writerow(["Analysis", "Final Summary", payload["final_analysis"]])

    return output.getvalue()
