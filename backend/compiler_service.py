"""Unified compiler backend dispatcher for OptiForge-OS."""

import json
import sys
from typing import Any, Dict

from lexer import tokenize
from parser import parse
from semantic_analyzer import analyze_semantics
from ir_generator import generate_ir
from optimizer import optimize_program, PASS_CATALOG
from ai_recommender import generate_recommendations
from resource_monitor import get_system_snapshot
from benchmark_service import run_benchmark, validate_code_safety
from report_service import (
    SAMPLE_PROGRAMS,
    LANGUAGE_CATALOG,
    save_history_record,
    list_history,
    get_history_by_id,
    delete_history_by_id,
    clear_non_demo_history,
    get_overview_summary,
    build_report_payload,
    build_report_csv,
)


def compile_pipeline(source_code: str, language: str = "c") -> Dict[str, Any]:
    if not source_code or not source_code.strip():
        return {
            "success": False,
            "errors": [{"stage": "validator", "message": "Source code cannot be empty.", "line": 1, "column": 1, "severity": "error"}],
            "warnings": [],
            "tokens": [],
            "ast": None,
            "symbols": [],
            "ir": None,
            "output": "Compilation aborted: empty source input.",
        }

    lex_res = tokenize(source_code, language)
    if lex_res["errors"]:
        return {
            "success": False,
            "errors": lex_res["errors"],
            "warnings": [],
            "tokens": lex_res["tokens"],
            "ast": None,
            "symbols": [],
            "ir": None,
            "output": f"Lexical analysis failed with {len(lex_res['errors'])} error(s).",
        }

    parse_res = parse(lex_res["tokens"])
    if parse_res["errors"]:
        return {
            "success": False,
            "errors": parse_res["errors"],
            "warnings": [],
            "tokens": lex_res["tokens"],
            "ast": parse_res["ast"],
            "ast_stats": parse_res["stats"],
            "symbols": [],
            "ir": None,
            "output": f"Syntax analysis failed with {len(parse_res['errors'])} error(s).",
        }

    sem_res = analyze_semantics(parse_res["ast"])
    ir_res = generate_ir(parse_res["ast"])

    has_errors = len(sem_res["errors"]) > 0
    diag_lines = [
        f"Compilation {'failed' if has_errors else 'succeeded'}: "
        f"{len(lex_res['tokens'])} tokens, {parse_res['stats']['total_nodes']} AST nodes, "
        f"{len(sem_res['symbols'])} symbol(s), {ir_res['instruction_count']} IR instruction(s)."
    ]
    for d in sem_res["diagnostics"]:
        diag_lines.append(f"[{d['severity'].upper()}] Line {d['line']}: {d['message']}")

    return {
        "success": not has_errors,
        "errors": sem_res["errors"],
        "warnings": sem_res["warnings"],
        "tokens": lex_res["tokens"],
        "ast": parse_res["ast"],
        "ast_stats": parse_res["stats"],
        "symbols": sem_res["symbols"],
        "ir": ir_res,
        "output": "\n".join(diag_lines),
    }


def handle_action(action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    if action == "samples":
        return {"samples": SAMPLE_PROGRAMS, "languages": LANGUAGE_CATALOG, "passes": list(PASS_CATALOG.values())}

    if action == "compile":
        code = payload.get("code", "")
        lang = payload.get("language", "c")
        return compile_pipeline(code, lang)

    if action == "recommend":
        code = payload.get("code", "")
        lang = payload.get("language", "c")
        comp = compile_pipeline(code, lang)
        if not comp["success"]:
            return {"success": False, "error": "Fix compilation errors before generating recommendations.", "compile": comp}
        rec = generate_recommendations(comp["ast"], comp["symbols"], comp["ir"])
        return {"success": True, **rec}

    if action == "optimize":
        code = payload.get("code", "")
        lang = payload.get("language", "c")
        program_name = payload.get("program_name", "untitled.c")
        passes = payload.get("passes")
        save_flag = payload.get("save", True)
        is_demo = bool(payload.get("is_demo", False))

        comp = compile_pipeline(code, lang)
        if not comp["success"]:
            return {"success": False, "error": "Source code contains compilation errors.", "compile": comp}

        opt = optimize_program(code, comp["ast"], comp["ir"], passes)
        rec = generate_recommendations(comp["ast"], comp["symbols"], comp["ir"])

        history_id = None
        if save_flag:
            applied_names = [p["name"] for p in opt["pass_results"] if p["applied"]]
            history_id = save_history_record(
                program_name=program_name,
                language=lang,
                original_code=code,
                optimized_code=opt["optimized_code"],
                applied_passes=applied_names,
                recommendations=rec["recommendations"],
                original_ir_text=comp["ir"]["text"],
                optimized_ir_text=opt["optimized_ir"]["text"],
                benchmark=None,
                status="Optimized",
                is_demo=is_demo,
            )

        return {
            "success": True,
            "history_id": history_id,
            "compile": comp,
            "optimization": opt,
            "recommendations": rec,
        }

    if action == "benchmark":
        orig_code = payload.get("original_code", "")
        opt_code = payload.get("optimized_code", "")
        runs = int(payload.get("runs", 5))
        compiler_flag = payload.get("compiler_flag", "-O0")
        program_name = payload.get("program_name", "benchmark.c")
        applied_passes = payload.get("applied_passes", [])
        recommendations = payload.get("recommendations", [])
        original_ir_text = payload.get("original_ir_text", "")
        optimized_ir_text = payload.get("optimized_ir_text", "")
        save_flag = payload.get("save", True)
        is_demo = bool(payload.get("is_demo", False))

        bench = run_benchmark(orig_code, opt_code, runs=runs, compiler_flag=compiler_flag)
        history_id = None
        if bench.get("success") and save_flag:
            history_id = save_history_record(
                program_name=program_name,
                language="c",
                original_code=orig_code,
                optimized_code=opt_code,
                applied_passes=applied_passes,
                recommendations=recommendations,
                original_ir_text=original_ir_text,
                optimized_ir_text=optimized_ir_text,
                benchmark=bench,
                status="Benchmarked",
                is_demo=is_demo,
            )
        return {**bench, "history_id": history_id}

    if action == "monitor":
        return get_system_snapshot()

    if action == "overview":
        include_demo = bool(payload.get("include_demo", True))
        return {
            "overview": get_overview_summary(include_demo=include_demo),
            "system": get_system_snapshot(),
        }

    if action == "history_list":
        include_demo = bool(payload.get("include_demo", True))
        return {"items": list_history(include_demo=include_demo)}

    if action == "history_get":
        rid = int(payload.get("id", 0))
        item = get_history_by_id(rid)
        if not item:
            return {"error": f"History record #{rid} not found."}
        return {"item": item}

    if action == "history_delete":
        rid = int(payload.get("id", 0))
        ok = delete_history_by_id(rid)
        return {"deleted": ok}

    if action == "history_clear":
        count = clear_non_demo_history()
        return {"cleared": count}

    if action == "report":
        rid = int(payload.get("id", 0))
        fmt = payload.get("format", "json")
        report = build_report_payload(rid)
        if not report:
            return {"error": f"Report #{rid} not found."}
        if fmt == "csv":
            return {"csv": build_report_csv(report), "filename": f"optiforge_report_{rid}.csv"}
        return {"report": report}

    if action == "load_demo":
        # Runs real compilation, optimization, and benchmark on 2 sample programs marked is_demo=True
        existing = [h for h in list_history(include_demo=True) if h["is_demo"]]
        if existing:
            return {"loaded": len(existing), "items": existing}
        created = []
        for sample in (SAMPLE_PROGRAMS[4], SAMPLE_PROGRAMS[1]):
            comp = compile_pipeline(sample["code"], "c")
            if comp["success"]:
                opt = optimize_program(sample["code"], comp["ast"], comp["ir"])
                rec = generate_recommendations(comp["ast"], comp["symbols"], comp["ir"])
                bench = run_benchmark(sample["code"], opt["optimized_code"], runs=3, compiler_flag="-O0")
                applied = [p["name"] for p in opt["pass_results"] if p["applied"]]
                hid = save_history_record(
                    program_name=sample["filename"],
                    language="c",
                    original_code=sample["code"],
                    optimized_code=opt["optimized_code"],
                    applied_passes=applied,
                    recommendations=rec["recommendations"],
                    original_ir_text=comp["ir"]["text"],
                    optimized_ir_text=opt["optimized_ir"]["text"],
                    benchmark=bench if bench.get("success") else None,
                    status="Benchmarked" if bench.get("success") else "Optimized",
                    is_demo=True,
                )
                created.append(hid)
        return {"loaded": len(created), "ids": created}

    return {"error": f"Unknown action: {action}"}


def main() -> None:
    try:
        raw = sys.stdin.read()
        req = json.loads(raw) if raw.strip() else {}
        action = req.get("action", "")
        payload = req.get("payload", {})
        result = handle_action(action, payload)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
