"""AI-assisted optimization recommendation engine with deterministic AST/IR analysis."""

from typing import Any, Dict, List, Optional, Set
from ast_generator import expr_to_c


def _inspect_program(ast: Dict[str, Any], symbols: List[Dict[str, Any]], ir: Dict[str, Any]) -> Dict[str, Any]:
    const_exprs: List[str] = []
    const_vars: List[str] = []
    unused_vars: List[str] = [s["name"] for s in symbols if s["kind"] == "variable" and s["reads"] == 0]
    dead_branches: List[str] = []
    repeated_subexprs: List[str] = []
    loop_invariants: List[str] = []
    loop_count = 0

    # Track binary expression occurrences per block
    expr_seen: Dict[str, int] = {}

    def is_num_lit(n: Optional[Dict[str, Any]]) -> bool:
        return bool(n and n.get("nodeType") == "Literal" and n.get("literalType") in ("int", "float"))

    def collect_ids(node: Any, out: Optional[Set[str]] = None) -> Set[str]:
        if out is None:
            out = set()
        if isinstance(node, dict):
            if node.get("nodeType") == "Identifier":
                out.add(node["name"])
            for v in node.values():
                if isinstance(v, (dict, list)):
                    collect_ids(v, out)
        elif isinstance(node, list):
            for i in node:
                collect_ids(i, out)
        return out

    def collect_mod(node: Any, out: Optional[Set[str]] = None) -> Set[str]:
        if out is None:
            out = set()
        if isinstance(node, dict):
            nt = node.get("nodeType")
            if nt in ("AssignStmt", "AssignExpr"):
                tgt = node.get("target", {})
                if tgt.get("nodeType") == "Identifier":
                    out.add(tgt["name"])
            elif nt == "UnaryExpr" and node.get("operator") in ("++", "--"):
                opd = node.get("operand", {})
                if opd.get("nodeType") == "Identifier":
                    out.add(opd["name"])
            elif nt == "VarDecl":
                out.add(node["name"])
            for v in node.values():
                if isinstance(v, (dict, list)):
                    collect_mod(v, out)
        elif isinstance(node, list):
            for i in node:
                collect_mod(i, out)
        return out

    def scan_expr(node: Optional[Dict[str, Any]], loop_mod: Optional[Set[str]] = None) -> None:
        if not node:
            return
        nt = node.get("nodeType")
        if nt == "BinaryExpr":
            if is_num_lit(node.get("left")) and is_num_lit(node.get("right")):
                const_exprs.append(expr_to_c(node))
            txt = expr_to_c(node)
            ids = collect_ids(node)
            if ids and node.get("operator") in ("+", "-", "*", "/"):
                expr_seen[txt] = expr_seen.get(txt, 0) + 1
                if expr_seen[txt] == 2:
                    repeated_subexprs.append(txt)
                if loop_mod is not None and not (ids & loop_mod):
                    loop_invariants.append(txt)
            scan_expr(node.get("left"), loop_mod)
            scan_expr(node.get("right"), loop_mod)
        elif nt == "UnaryExpr":
            scan_expr(node.get("operand"), loop_mod)
        elif nt == "CallExpr":
            for a in node.get("arguments", []):
                scan_expr(a, loop_mod)

    const_assigned_names: Set[str] = set()

    def scan_stmt(stmt: Dict[str, Any], loop_mod: Optional[Set[str]] = None) -> None:
        nonlocal loop_count
        nt = stmt.get("nodeType")
        if nt == "Block":
            returned = False
            for s in stmt.get("statements", []):
                if returned:
                    dead_branches.append(f"Unreachable code at line {s.get('line', '?')}")
                scan_stmt(s, loop_mod)
                if s.get("nodeType") == "ReturnStmt":
                    returned = True
        elif nt == "VarDecl":
            if stmt.get("init") is not None:
                scan_expr(stmt["init"], loop_mod)
                if is_num_lit(stmt["init"]) and stmt["name"] not in const_assigned_names:
                    const_assigned_names.add(stmt["name"])
        elif nt == "AssignStmt":
            scan_expr(stmt.get("value"), loop_mod)
        elif nt == "ReturnStmt":
            scan_expr(stmt.get("value"), loop_mod)
        elif nt == "IfStmt":
            cond = stmt.get("condition")
            scan_expr(cond, loop_mod)
            if is_num_lit(cond):
                dead_branches.append(f"Constant condition if ({expr_to_c(cond)}) at line {stmt.get('line', '?')}")
            scan_stmt(stmt["thenBranch"], loop_mod)
            if stmt.get("elseBranch"):
                scan_stmt(stmt["elseBranch"], loop_mod)
        elif nt in ("ForStmt", "WhileStmt"):
            loop_count += 1
            mod = collect_mod(stmt)
            if stmt.get("body"):
                scan_stmt(stmt["body"], mod)
        elif nt == "ExprStmt":
            scan_expr(stmt.get("expression"), loop_mod)

    for decl in ast.get("declarations", []):
        if decl["nodeType"] == "FunctionDecl":
            scan_stmt(decl["body"])

    # Check which constant-initialized variables are actually referenced in expressions
    for s in symbols:
        if s["name"] in const_assigned_names and s["reads"] > 0 and s["writes"] == 1:
            const_vars.append(s["name"])

    return {
        "constant_expressions": const_exprs,
        "propagable_constants": const_vars,
        "unused_variables": unused_vars,
        "dead_branches": dead_branches,
        "repeated_subexpressions": repeated_subexprs,
        "loop_invariants": loop_invariants,
        "loop_count": loop_count,
        "ir_instructions": ir.get("instruction_count", 0),
    }


def generate_recommendations(ast: Dict[str, Any], symbols: List[Dict[str, Any]], ir: Dict[str, Any]) -> Dict[str, Any]:
    features = _inspect_program(ast, symbols, ir)
    detected_patterns: List[Dict[str, Any]] = []
    recommendations: List[Dict[str, Any]] = []

    if features["constant_expressions"]:
        count = len(features["constant_expressions"])
        confidence = round(min(0.99, 0.82 + count * 0.04), 2)
        detected_patterns.append({
            "pattern": "Constant expressions",
            "count": count,
            "examples": features["constant_expressions"][:4],
        })
        recommendations.append({
            "pass_id": "constant_folding",
            "pass_name": "Constant Folding",
            "confidence": confidence,
            "priority": "high",
            "reason": f"Detected {count} literal arithmetic expression(s) such as '{features['constant_expressions'][0]}' that can be evaluated at compile time.",
        })

    if features["propagable_constants"]:
        count = len(features["propagable_constants"])
        confidence = round(min(0.97, 0.78 + count * 0.05), 2)
        detected_patterns.append({
            "pattern": "Single-assignment constant variables",
            "count": count,
            "examples": features["propagable_constants"][:4],
        })
        recommendations.append({
            "pass_id": "constant_propagation",
            "pass_name": "Constant Propagation",
            "confidence": confidence,
            "priority": "high",
            "reason": f"Detected {count} read-only constant variable(s) ({', '.join(features['propagable_constants'][:3])}) whose values can be inlined.",
        })

    dce_total = len(features["unused_variables"]) + len(features["dead_branches"])
    if dce_total > 0:
        confidence = round(min(0.98, 0.80 + dce_total * 0.04), 2)
        examples = features["unused_variables"][:2] + features["dead_branches"][:2]
        detected_patterns.append({
            "pattern": "Unused variables & dead branches",
            "count": dce_total,
            "examples": examples,
        })
        recommendations.append({
            "pass_id": "dead_code_elimination",
            "pass_name": "Dead Code Elimination",
            "confidence": confidence,
            "priority": "high" if dce_total >= 2 else "medium",
            "reason": f"Detected {len(features['unused_variables'])} unused variable(s) and {len(features['dead_branches'])} unreachable/constant branch(es).",
        })

    if features["repeated_subexpressions"]:
        count = len(features["repeated_subexpressions"])
        confidence = round(min(0.96, 0.79 + count * 0.06), 2)
        detected_patterns.append({
            "pattern": "Repeated arithmetic subexpressions",
            "count": count,
            "examples": features["repeated_subexpressions"][:4],
        })
        recommendations.append({
            "pass_id": "common_subexpression_elimination",
            "pass_name": "Common Subexpression Elimination",
            "confidence": confidence,
            "priority": "high",
            "reason": f"Detected {count} repeated expression(s) such as '{features['repeated_subexpressions'][0]}' eligible for value reuse.",
        })

    if features["loop_invariants"]:
        count = len(features["loop_invariants"])
        confidence = round(min(0.97, 0.81 + count * 0.05), 2)
        detected_patterns.append({
            "pattern": "Loop-invariant calculations",
            "count": count,
            "examples": features["loop_invariants"][:4],
        })
        recommendations.append({
            "pass_id": "loop_optimization",
            "pass_name": "Loop Optimization (LICM)",
            "confidence": confidence,
            "priority": "high",
            "reason": f"Detected {count} loop-invariant computation(s) such as '{features['loop_invariants'][0]}' that can be hoisted pre-loop.",
        })

    recommendations.sort(key=lambda r: r["confidence"], reverse=True)

    return {
        "engine": "Rule-Based AST/IR Analyzer",
        "features": features,
        "detected_patterns": detected_patterns,
        "recommendations": recommendations,
        "recommended_pass_ids": [r["pass_id"] for r in recommendations],
    }
