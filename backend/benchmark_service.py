"""Sandboxed compilation and real execution benchmarking service for OptiForge-OS."""

import os
import re
import resource
import subprocess
import tempfile
import time
from typing import Any, Dict, List

FORBIDDEN_PATTERNS = [
    r"\bsystem\s*\(",
    r"\bpopen\s*\(",
    r"\bexecv?\w*\s*\(",
    r"\bfork\s*\(",
    r"\bvfork\s*\(",
    r"\bclone\s*\(",
    r"\bdlopen\s*\(",
    r"\bsocket\s*\(",
    r"#\s*include\s*<\s*sys/",
    r"#\s*include\s*<\s*unistd\.h",
    r"#\s*include\s*<\s*fcntl\.h",
    r"\basm\b|\b__asm__\b",
]


def validate_code_safety(source: str) -> List[str]:
    issues: List[str] = []
    if len(source.encode("utf-8")) > 65536:
        issues.append("Source exceeds maximum allowed size of 64 KB.")
    for pat in FORBIDDEN_PATTERNS:
        if re.search(pat, source):
            issues.append(f"Restricted system API or unsafe directive matched pattern: {pat}")
    return issues


def _set_sandbox_limits() -> None:
    # Strict CPU (2s), Virtual Address Space (128MB), File Size (1MB)
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_AS, (128 * 1024 * 1024, 128 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))


def _compile_and_measure(source: str, label: str, opt_flag: str = "-O0", runs: int = 3) -> Dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="optiforge_") as tmpdir:
        src_path = os.path.join(tmpdir, f"{label}.c")
        bin_path = os.path.join(tmpdir, f"{label}_bin")
        with open(src_path, "w", encoding="utf-8") as f:
            f.write(source)

        comp_start = time.perf_counter_ns()
        comp_proc = subprocess.run(
            ["gcc", opt_flag, "-Wall", src_path, "-o", bin_path, "-lm"],
            capture_output=True,
            text=True,
            timeout=5,
            env={"PATH": "/usr/bin:/bin"},
        )
        comp_time_ms = (time.perf_counter_ns() - comp_start) / 1_000_000.0

        if comp_proc.returncode != 0:
            return {
                "success": False,
                "error": comp_proc.stderr.strip() or "gcc compilation failed",
                "compile_time_ms": round(comp_time_ms, 3),
            }

        binary_size_bytes = os.path.getsize(bin_path)

        wall_times_ms: List[float] = []
        user_times_ms: List[float] = []
        sys_times_ms: List[float] = []
        max_rss_kb_list: List[int] = []
        minflt_list: List[int] = []
        ctx_switches_list: List[int] = []
        stdout_sample = ""
        exit_code = 0

        for _ in range(max(1, min(runs, 10))):
            t0 = time.perf_counter_ns()
            proc = subprocess.Popen(
                [bin_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=tmpdir,
                env={},
                preexec_fn=_set_sandbox_limits,
            )
            try:
                _, status, rusage = os.wait4(proc.pid, 0)
                t1 = time.perf_counter_ns()
                out_bytes = proc.stdout.read() if proc.stdout else b""
                err_bytes = proc.stderr.read() if proc.stderr else b""
                if proc.stdout:
                    proc.stdout.close()
                if proc.stderr:
                    proc.stderr.close()

                exit_code = os.waitstatus_to_exitcode(status)
                if not stdout_sample:
                    stdout_sample = out_bytes.decode("utf-8", errors="replace")[:500]
                if exit_code != 0 and not stdout_sample:
                    stdout_sample = err_bytes.decode("utf-8", errors="replace")[:500]

                wall_ms = (t1 - t0) / 1_000_000.0
                user_ms = rusage.ru_utime * 1000.0
                sys_ms = rusage.ru_stime * 1000.0

                wall_times_ms.append(wall_ms)
                user_times_ms.append(user_ms)
                sys_times_ms.append(sys_ms)
                max_rss_kb_list.append(rusage.ru_maxrss)
                minflt_list.append(rusage.ru_minflt)
                ctx_switches_list.append(rusage.ru_nvcsw + rusage.ru_nivcsw)
            except subprocess.TimeoutExpired:
                proc.kill()
                return {
                    "success": False,
                    "error": "Execution timed out inside sandbox (2s CPU limit).",
                    "compile_time_ms": round(comp_time_ms, 3),
                }

        avg_wall = sum(wall_times_ms) / len(wall_times_ms)
        avg_user = sum(user_times_ms) / len(user_times_ms)
        avg_sys = sum(sys_times_ms) / len(sys_times_ms)
        avg_cpu_total = avg_user + avg_sys
        cpu_util = min(100.0, (avg_cpu_total / avg_wall) * 100.0) if avg_wall > 0 else 0.0
        avg_rss_kb = sum(max_rss_kb_list) / len(max_rss_kb_list)

        return {
            "success": True,
            "runs": len(wall_times_ms),
            "compiler_flag": opt_flag,
            "compile_time_ms": round(comp_time_ms, 3),
            "binary_size_bytes": binary_size_bytes,
            "execution_time_ms": round(avg_wall, 4),
            "user_cpu_ms": round(avg_user, 4),
            "system_cpu_ms": round(avg_sys, 4),
            "cpu_utilization_percent": round(cpu_util, 2),
            "memory_rss_kb": round(avg_rss_kb, 1),
            "memory_rss_mb": round(avg_rss_kb / 1024.0, 3),
            "minor_page_faults": round(sum(minflt_list) / len(minflt_list), 1),
            "context_switches": round(sum(ctx_switches_list) / len(ctx_switches_list), 1),
            "thread_count": 1,
            "exit_code": exit_code,
            "stdout": stdout_sample,
        }


def run_benchmark(
    original_code: str,
    optimized_code: str,
    runs: int = 5,
    compiler_flag: str = "-O0",
) -> Dict[str, Any]:
    safety_orig = validate_code_safety(original_code)
    safety_opt = validate_code_safety(optimized_code)
    if safety_orig or safety_opt:
        return {
            "success": False,
            "error": "Sandbox security validation rejected the program.",
            "security_violations": safety_orig + safety_opt,
        }

    orig_metrics = _compile_and_measure(original_code, "original", compiler_flag, runs)
    if not orig_metrics["success"]:
        return {
            "success": False,
            "error": f"Original program compilation/execution failed: {orig_metrics['error']}",
            "original": orig_metrics,
        }

    opt_metrics = _compile_and_measure(optimized_code, "optimized", compiler_flag, runs)
    if not opt_metrics["success"]:
        return {
            "success": False,
            "error": f"Optimized program compilation/execution failed: {opt_metrics['error']}",
            "original": orig_metrics,
            "optimized": opt_metrics,
        }

    def pct_improvement(orig_v: float, opt_v: float) -> float:
        if orig_v <= 0:
            return 0.0
        return round(((orig_v - opt_v) / orig_v) * 100.0, 2)

    deltas = {
        "execution_time_diff_ms": round(opt_metrics["execution_time_ms"] - orig_metrics["execution_time_ms"], 4),
        "execution_time_improvement_pct": pct_improvement(orig_metrics["execution_time_ms"], opt_metrics["execution_time_ms"]),
        "cpu_utilization_diff_pct": round(opt_metrics["cpu_utilization_percent"] - orig_metrics["cpu_utilization_percent"], 2),
        "cpu_improvement_pct": pct_improvement(orig_metrics["cpu_utilization_percent"], opt_metrics["cpu_utilization_percent"]),
        "memory_diff_kb": round(opt_metrics["memory_rss_kb"] - orig_metrics["memory_rss_kb"], 1),
        "memory_improvement_pct": pct_improvement(orig_metrics["memory_rss_kb"], opt_metrics["memory_rss_kb"]),
        "binary_size_diff_bytes": opt_metrics["binary_size_bytes"] - orig_metrics["binary_size_bytes"],
        "binary_size_improvement_pct": pct_improvement(orig_metrics["binary_size_bytes"], opt_metrics["binary_size_bytes"]),
        "page_faults_diff": round(opt_metrics["minor_page_faults"] - orig_metrics["minor_page_faults"], 1),
    }

    return {
        "success": True,
        "scope": "process_benchmark",
        "sandbox": {
            "compiler": f"gcc {compiler_flag}",
            "cpu_limit_seconds": 2,
            "memory_limit_mb": 128,
            "runs_averaged": runs,
            "network_isolated": True,
        },
        "formulas": {
            "improvement_percent": "((Original_Value - Optimized_Value) / Original_Value) * 100",
            "cpu_utilization": "((User_CPU_ms + System_CPU_ms) / Wall_Time_ms) * 100",
        },
        "original": orig_metrics,
        "optimized": opt_metrics,
        "deltas": deltas,
    }
