"""AST and Three-Address Code (TAC) optimization passes for OptiForge-OS."""

import copy
from typing import Any, Dict, List, Optional, Set, Tuple
from ast_generator import ast_to_c, expr_to_c, make_node
from ir_generator import generate_ir


PASS_CATALOG = {
    "constant_folding": {
        "id": "constant_folding",
        "name": "Constant Folding",
        "description": "Evaluates constant arithmetic and boolean expressions at compile time rather than runtime.",
        "estimated_benefit": "Eliminates runtime ALU instructions for literal expressions.",
    },
    "constant_propagation": {
        "id": "constant_propagation",
        "name": "Constant Propagation",
        "description": "Substitutes known constant values of variables directly into downstream expressions.",
        "estimated_benefit": "Unlocks secondary constant folding and reduces register pressure.",
    },
    "dead_code_elimination": {
        "id": "dead_code_elimination",
        "name": "Dead Code Elimination",
        "description": "Removes unreachable statements after return/false branches and side-effect-free unused assignments.",
        "estimated_benefit": "Shrinks binary footprint and eliminates wasted CPU cycles.",
    },
    "common_subexpression_elimination": {
        "id": "common_subexpression_elimination",
        "name": "Common Subexpression Elimination",
        "description": "Caches repeated identical expressions whose operands have not been modified and reuses the result.",
        "estimated_benefit": "Avoids redundant arithmetic evaluations inside hot paths.",
    },
    "loop_optimization": {
        "id": "loop_optimization",
        "name": "Loop Optimization (LICM)",
        "description": "Hoists loop-invariant computations outside loop boundaries and simplifies invariant loop expressions.",
        "estimated_benefit": "Reduces O(N) repeated calculations to O(1) pre-loop execution.",
    },
}


def _is_num_lit(node: Optional[Dict[str, Any]]) -> bool:
    return bool(node and node.get("nodeType") == "Literal" and node.get("literalType") in ("int", "float"))


def _eval_binary(op: str, lval: Any, rval: Any) -> Optional[Tuple[Any, str]]:
    try:
        if op == "+":
            res = lval + rval
        elif op == "-":
            res = lval - rval
        elif op == "*":
            res = lval * rval
        elif op == "/":
            if rval == 0:
                return None
            if isinstance(lval, int) and isinstance(rval, int):
                res = int(lval / rval)
            else:
                res = lval / rval
        elif op == "%":
            if rval == 0 or isinstance(lval, float) or isinstance(rval, float):
                return None
            res = lval % rval
        elif op == "==":
            res = 1 if lval == rval else 0
        elif op == "!=":
            res = 1 if lval != rval else 0
        elif op == "<":
            res = 1 if lval < rval else 0
        elif op == "<=":
            res = 1 if lval <= rval else 0
        elif op == ">":
            res = 1 if lval > rval else 0
        elif op == ">=":
            res = 1 if lval >= rval else 0
        elif op == "&&":
            res = 1 if (lval and rval) else 0
        elif op == "||":
            res = 1 if (lval or rval) else 0
        else:
            return None
        ltype = "float" if isinstance(res, float) else "int"
        return (res, ltype)
    except Exception:
        return None


def _collect_identifiers(node: Any, out: Optional[Set[str]] = None) -> Set[str]:
    if out is None:
        out = set()
    if isinstance(node, dict):
        if node.get("nodeType") == "Identifier":
            out.add(node["name"])
        elif node.get("nodeType") == "ArrayAccess":
            out.add(node["name"])
        for v in node.values():
            if isinstance(v, (dict, list)):
                _collect_identifiers(v, out)
    elif isinstance(node, list):
        for item in node:
            _collect_identifiers(item, out)
    return out


def _collect_modified_vars(node: Any, out: Optional[Set[str]] = None) -> Set[str]:
    if out is None:
        out = set()
    if isinstance(node, dict):
        nt = node.get("nodeType")
        if nt in ("AssignStmt", "AssignExpr"):
            tgt = node.get("target", {})
            if tgt.get("nodeType") in ("Identifier", "ArrayAccess"):
                out.add(tgt["name"])
        elif nt == "UnaryExpr" and node.get("operator") in ("++", "--"):
            opd = node.get("operand", {})
            if opd.get("nodeType") in ("Identifier", "ArrayAccess"):
                out.add(opd["name"])
        elif nt == "VarDecl":
            out.add(node["name"])
        for v in node.values():
            if isinstance(v, (dict, list)):
                _collect_modified_vars(v, out)
    elif isinstance(node, list):
        for item in node:
            _collect_modified_vars(item, out)
    return out


def _has_side_effects(node: Any) -> bool:
    if isinstance(node, dict):
        nt = node.get("nodeType")
        if nt == "CallExpr":
            return True
        if nt == "UnaryExpr" and node.get("operator") in ("++", "--"):
            return True
        if nt == "AssignExpr":
            return True
        return any(_has_side_effects(v) for v in node.values() if isinstance(v, (dict, list)))
    if isinstance(node, list):
        return any(_has_side_effects(i) for i in node)
    return False


def _fold_expr(node: Optional[Dict[str, Any]], changes: List[Tuple[str, str]]) -> Optional[Dict[str, Any]]:
    if not node:
        return node
    nt = node.get("nodeType")
    if nt == "BinaryExpr":
        before = expr_to_c(node)
        node["left"] = _fold_expr(node["left"], changes)
        node["right"] = _fold_expr(node["right"], changes)
        if _is_num_lit(node["left"]) and _is_num_lit(node["right"]):
            eval_res = _eval_binary(node["operator"], node["left"]["value"], node["right"]["value"])
            if eval_res is not None:
                val, ltype = eval_res
                folded = make_node("Literal", line=node.get("line", 0), value=val, literalType=ltype)
                changes.append((before, expr_to_c(folded)))
                return folded
        # Algebraic identities
        op = node["operator"]
        if op == "+" and _is_num_lit(node["right"]) and node["right"]["value"] == 0:
            changes.append((before, expr_to_c(node["left"])))
            return node["left"]
        if op == "*" and _is_num_lit(node["right"]) and node["right"]["value"] == 1:
            changes.append((before, expr_to_c(node["left"])))
            return node["left"]
        if op == "*" and _is_num_lit(node["right"]) and node["right"]["value"] == 0:
            folded = make_node("Literal", line=node.get("line", 0), value=0, literalType="int")
            changes.append((before, "0"))
            return folded
    elif nt == "UnaryExpr":
        node["operand"] = _fold_expr(node["operand"], changes)
        if node["operator"] == "-" and _is_num_lit(node["operand"]):
            before = expr_to_c(node)
            folded = make_node("Literal", line=node.get("line", 0), value=-node["operand"]["value"], literalType=node["operand"]["literalType"])
            changes.append((before, expr_to_c(folded)))
            return folded
    elif nt == "CallExpr":
        node["arguments"] = [_fold_expr(a, changes) for a in node.get("arguments", [])]
    elif nt == "ArrayAccess":
        node["index"] = _fold_expr(node["index"], changes)
    return node


def _apply_constant_folding(ast: Dict[str, Any]) -> Dict[str, Any]:
    changes: List[Tuple[str, str]] = []

    def visit_stmt(stmt: Dict[str, Any]) -> None:
        nt = stmt.get("nodeType")
        if nt == "Block":
            for s in stmt.get("statements", []):
                visit_stmt(s)
        elif nt == "VarDecl" and stmt.get("init") is not None:
            if stmt["init"].get("nodeType") == "ArrayInit":
                stmt["init"]["elements"] = [_fold_expr(e, changes) for e in stmt["init"].get("elements", [])]
            else:
                stmt["init"] = _fold_expr(stmt["init"], changes)
        elif nt == "AssignStmt":
            stmt["value"] = _fold_expr(stmt["value"], changes)
        elif nt == "ReturnStmt" and stmt.get("value") is not None:
            stmt["value"] = _fold_expr(stmt["value"], changes)
        elif nt == "IfStmt":
            stmt["condition"] = _fold_expr(stmt["condition"], changes)
            visit_stmt(stmt["thenBranch"])
            if stmt.get("elseBranch"):
                visit_stmt(stmt["elseBranch"])
        elif nt == "WhileStmt":
            stmt["condition"] = _fold_expr(stmt["condition"], changes)
            visit_stmt(stmt["body"])
        elif nt == "ForStmt":
            if stmt.get("init"):
                visit_stmt(stmt["init"])
            if stmt.get("condition"):
                stmt["condition"] = _fold_expr(stmt["condition"], changes)
            visit_stmt(stmt["body"])
        elif nt == "ExprStmt":
            stmt["expression"] = _fold_expr(stmt["expression"], changes)

    for decl in ast.get("declarations", []):
        if decl["nodeType"] == "FunctionDecl":
            visit_stmt(decl["body"])
        elif decl["nodeType"] == "VarDecl":
            visit_stmt(decl)

    return {
        "applied": len(changes) > 0,
        "changes_count": len(changes),
        "before_snippet": changes[0][0] if changes else "No constant binary expressions detected",
        "after_snippet": changes[0][1] if changes else "No change",
        "explanation": (
            f"Folded {len(changes)} constant expression(s) directly into literal values at compile time."
            if changes else "No foldable constant literal expressions found in AST."
        ),
    }


def _apply_constant_propagation(ast: Dict[str, Any]) -> Dict[str, Any]:
    changes: List[Tuple[str, str]] = []

    def subst_expr(node: Optional[Dict[str, Any]], env: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not node:
            return node
        nt = node.get("nodeType")
        if nt == "Identifier" and node["name"] in env:
            lit = copy.deepcopy(env[node["name"]])
            lit["line"] = node.get("line", 0)
            changes.append((node["name"], expr_to_c(lit)))
            return lit
        if nt == "BinaryExpr":
            node["left"] = subst_expr(node["left"], env)
            node["right"] = subst_expr(node["right"], env)
        elif nt == "UnaryExpr" and node.get("operator") not in ("++", "--"):
            node["operand"] = subst_expr(node["operand"], env)
        elif nt == "CallExpr":
            node["arguments"] = [subst_expr(a, env) for a in node.get("arguments", [])]
        elif nt == "ArrayAccess":
            node["index"] = subst_expr(node["index"], env)
        return node

    def propagate_block(stmts: List[Dict[str, Any]], env: Dict[str, Dict[str, Any]]) -> None:
        for stmt in stmts:
            nt = stmt.get("nodeType")
            if nt == "VarDecl":
                if stmt.get("init") is not None:
                    stmt["init"] = subst_expr(stmt["init"], env)
                    stmt["init"] = _fold_expr(stmt["init"], [])
                    if _is_num_lit(stmt["init"]):
                        env[stmt["name"]] = copy.deepcopy(stmt["init"])
                    else:
                        env.pop(stmt["name"], None)
                else:
                    env.pop(stmt["name"], None)
            elif nt == "AssignStmt":
                stmt["value"] = subst_expr(stmt["value"], env)
                stmt["value"] = _fold_expr(stmt["value"], [])
                tgt = stmt.get("target", {})
                if tgt.get("nodeType") == "Identifier":
                    if stmt.get("operator") == "=" and _is_num_lit(stmt["value"]):
                        env[tgt["name"]] = copy.deepcopy(stmt["value"])
                    else:
                        env.pop(tgt["name"], None)
            elif nt == "ReturnStmt" and stmt.get("value") is not None:
                stmt["value"] = subst_expr(stmt["value"], env)
                stmt["value"] = _fold_expr(stmt["value"], [])
            elif nt == "ExprStmt":
                stmt["expression"] = subst_expr(stmt["expression"], env)
                # Invalidate variables mutated inside expressions
                for mv in _collect_modified_vars(stmt["expression"]):
                    env.pop(mv, None)
            elif nt == "IfStmt":
                stmt["condition"] = subst_expr(stmt["condition"], env)
                stmt["condition"] = _fold_expr(stmt["condition"], [])
                modified = _collect_modified_vars(stmt)
                for mv in modified:
                    env.pop(mv, None)
            elif nt in ("WhileStmt", "ForStmt"):
                modified = _collect_modified_vars(stmt)
                for mv in modified:
                    env.pop(mv, None)
                # Propagate read-only constants inside loop body
                inner_env = dict(env)
                if nt == "ForStmt":
                    if stmt.get("condition"):
                        stmt["condition"] = subst_expr(stmt["condition"], inner_env)
                    if stmt.get("body", {}).get("nodeType") == "Block":
                        propagate_block(stmt["body"]["statements"], inner_env)
                elif nt == "WhileStmt":
                    stmt["condition"] = subst_expr(stmt["condition"], inner_env)
                    if stmt.get("body", {}).get("nodeType") == "Block":
                        propagate_block(stmt["body"]["statements"], inner_env)
            elif nt == "Block":
                propagate_block(stmt.get("statements", []), dict(env))

    for decl in ast.get("declarations", []):
        if decl["nodeType"] == "FunctionDecl":
            env: Dict[str, Dict[str, Any]] = {}
            propagate_block(decl["body"].get("statements", []), env)

    return {
        "applied": len(changes) > 0,
        "changes_count": len(changes),
        "before_snippet": f"{changes[0][0]} (variable reference)" if changes else "No constant propagation opportunities",
        "after_snippet": f"{changes[0][1]} (propagated constant)" if changes else "No change",
        "explanation": (
            f"Propagated known constant values across {len(changes)} variable reference(s) and re-folded expressions."
            if changes else "No statically determinable constant variable chains found."
        ),
    }


def _apply_dead_code_elimination(ast: Dict[str, Any]) -> Dict[str, Any]:
    removed_snippets: List[str] = []

    def dce_block(block: Dict[str, Any], return_names: Set[str]) -> None:
        stmts = block.get("statements", [])
        # 1. Remove unreachable statements after return and eliminate false if(0) branches
        cleaned: List[Dict[str, Any]] = []
        reached_return = False
        for stmt in stmts:
            if reached_return:
                removed_snippets.append(ast_to_c(stmt, 0).strip())
                continue
            nt = stmt.get("nodeType")
            if nt == "IfStmt":
                cond = stmt.get("condition")
                if _is_num_lit(cond):
                    if cond["value"] == 0:
                        removed_snippets.append(f"if ({expr_to_c(cond)}) {{ ... }}")
                        if stmt.get("elseBranch"):
                            if stmt["elseBranch"].get("nodeType") == "Block":
                                cleaned.extend(stmt["elseBranch"].get("statements", []))
                            else:
                                cleaned.append(stmt["elseBranch"])
                        continue
                    else:
                        removed_snippets.append("Dead else branch eliminated")
                        if stmt["thenBranch"].get("nodeType") == "Block":
                            cleaned.extend(stmt["thenBranch"].get("statements", []))
                        else:
                            cleaned.append(stmt["thenBranch"])
                        continue
                else:
                    if stmt["thenBranch"].get("nodeType") == "Block":
                        dce_block(stmt["thenBranch"], return_names)
                    if stmt.get("elseBranch") and stmt["elseBranch"].get("nodeType") == "Block":
                        dce_block(stmt["elseBranch"], return_names)
            elif nt in ("WhileStmt", "ForStmt"):
                cond = stmt.get("condition")
                if nt == "WhileStmt" and _is_num_lit(cond) and cond["value"] == 0:
                    removed_snippets.append("while (0) { ... }")
                    continue
                if stmt.get("body", {}).get("nodeType") == "Block":
                    dce_block(stmt["body"], return_names)
            elif nt == "Block":
                dce_block(stmt, return_names)

            cleaned.append(stmt)
            if nt == "ReturnStmt":
                reached_return = True

        # 2. Compute variables read anywhere in remaining statements (excluding pure LHS assignment targets)
        def reads_in_stmts(stmt_list: List[Dict[str, Any]]) -> Set[str]:
            read_vars: Set[str] = set()

            def visit_read(node: Any) -> None:
                if isinstance(node, dict):
                    nt_inner = node.get("nodeType")
                    if nt_inner == "VarDecl":
                        if node.get("init") is not None:
                            visit_read(node["init"])
                        return
                    if nt_inner in ("AssignStmt", "AssignExpr"):
                        visit_read(node.get("value"))
                        tgt = node.get("target", {})
                        if tgt.get("nodeType") == "ArrayAccess":
                            read_vars.add(tgt["name"])
                            visit_read(tgt.get("index"))
                        return
                    if nt_inner == "Identifier":
                        read_vars.add(node["name"])
                        return
                    for v in node.values():
                        if isinstance(v, (dict, list)):
                            visit_read(v)
                elif isinstance(node, list):
                    for item in node:
                        visit_read(item)

            visit_read(stmt_list)
            return read_vars

        # Iteratively prune unused local declarations/assignments with no side effects
        changed = True
        while changed:
            changed = False
            used = reads_in_stmts(cleaned) | return_names
            next_cleaned: List[Dict[str, Any]] = []
            for stmt in cleaned:
                nt = stmt.get("nodeType")
                if nt == "VarDecl" and stmt["name"] not in used:
                    if not _has_side_effects(stmt.get("init")):
                        removed_snippets.append(ast_to_c(stmt, 0).strip())
                        changed = True
                        continue
                elif nt == "AssignStmt":
                    tgt = stmt.get("target", {})
                    if tgt.get("nodeType") == "Identifier" and tgt["name"] not in used:
                        if not _has_side_effects(stmt.get("value")):
                            removed_snippets.append(ast_to_c(stmt, 0).strip())
                            changed = True
                            continue
                next_cleaned.append(stmt)
            cleaned = next_cleaned

        block["statements"] = cleaned

    for decl in ast.get("declarations", []):
        if decl["nodeType"] == "FunctionDecl":
            dce_block(decl["body"], set())

    return {
        "applied": len(removed_snippets) > 0,
        "changes_count": len(removed_snippets),
        "before_snippet": removed_snippets[0] if removed_snippets else "No dead or unreachable statements",
        "after_snippet": "/* removed unreachable / unused statement */" if removed_snippets else "No change",
        "explanation": (
            f"Eliminated {len(removed_snippets)} dead statement(s), unused assignment(s), or unreachable branch(es)."
            if removed_snippets else "No unreachable code or unused side-effect-free assignments found."
        ),
    }


def _apply_cse(ast: Dict[str, Any]) -> Dict[str, Any]:
    replacements: List[Tuple[str, str]] = []
    cse_counter = 0

    def cse_block(block: Dict[str, Any]) -> None:
        nonlocal cse_counter
        # Maps canonical expr string -> (holder variable name, set of operand identifiers)
        avail: Dict[str, Tuple[str, Set[str]]] = {}
        new_stmts: List[Dict[str, Any]] = []

        def replace_subexpr(expr: Optional[Dict[str, Any]], current_target: Optional[str]) -> Optional[Dict[str, Any]]:
            nonlocal cse_counter
            if not expr:
                return expr
            nt = expr.get("nodeType")
            if nt == "BinaryExpr" and expr.get("operator") in ("+", "-", "*", "/", "%"):
                expr["left"] = replace_subexpr(expr["left"], current_target)
                expr["right"] = replace_subexpr(expr["right"], current_target)
                # Only cache non-trivial binary expressions (containing at least one identifier)
                deps = _collect_identifiers(expr)
                if deps:
                    key = expr_to_c(expr)
                    if key in avail:
                        holder, _ = avail[key]
                        if holder != current_target:
                            replacements.append((key, holder))
                            return make_node("Identifier", line=expr.get("line", 0), name=holder)
            elif nt == "CallExpr":
                expr["arguments"] = [replace_subexpr(a, current_target) for a in expr.get("arguments", [])]
            return expr

        def invalidate(var_name: str) -> None:
            to_del = [k for k, (holder, deps) in avail.items() if holder == var_name or var_name in deps]
            for k in to_del:
                del avail[k]

        for stmt in block.get("statements", []):
            nt = stmt.get("nodeType")
            if nt == "VarDecl" and stmt.get("init") is not None:
                stmt["init"] = replace_subexpr(stmt["init"], stmt["name"])
                invalidate(stmt["name"])
                init = stmt["init"]
                if init and init.get("nodeType") == "BinaryExpr" and init.get("operator") in ("+", "-", "*", "/", "%"):
                    deps = _collect_identifiers(init)
                    if deps and stmt["name"] not in deps:
                        avail[expr_to_c(init)] = (stmt["name"], deps)
            elif nt == "AssignStmt":
                tgt = stmt.get("target", {})
                tgt_name = tgt.get("name") if tgt.get("nodeType") == "Identifier" else None
                stmt["value"] = replace_subexpr(stmt["value"], tgt_name)
                if tgt_name:
                    invalidate(tgt_name)
                    val = stmt["value"]
                    if stmt.get("operator") == "=" and val and val.get("nodeType") == "BinaryExpr" and val.get("operator") in ("+", "-", "*", "/", "%"):
                        deps = _collect_identifiers(val)
                        if deps and tgt_name not in deps:
                            avail[expr_to_c(val)] = (tgt_name, deps)
            elif nt == "ReturnStmt" and stmt.get("value") is not None:
                stmt["value"] = replace_subexpr(stmt["value"], None)
            elif nt == "ExprStmt":
                stmt["expression"] = replace_subexpr(stmt["expression"], None)
                for mv in _collect_modified_vars(stmt["expression"]):
                    invalidate(mv)
            elif nt in ("IfStmt", "WhileStmt", "ForStmt"):
                for mv in _collect_modified_vars(stmt):
                    invalidate(mv)
                if nt == "IfStmt":
                    if stmt["thenBranch"].get("nodeType") == "Block":
                        cse_block(stmt["thenBranch"])
                    if stmt.get("elseBranch") and stmt["elseBranch"].get("nodeType") == "Block":
                        cse_block(stmt["elseBranch"])
                elif nt in ("WhileStmt", "ForStmt"):
                    if stmt.get("body", {}).get("nodeType") == "Block":
                        cse_block(stmt["body"])
            new_stmts.append(stmt)

        block["statements"] = new_stmts

    for decl in ast.get("declarations", []):
        if decl["nodeType"] == "FunctionDecl":
            cse_block(decl["body"])

    return {
        "applied": len(replacements) > 0,
        "changes_count": len(replacements),
        "before_snippet": replacements[0][0] if replacements else "No duplicate subexpressions detected",
        "after_snippet": f"{replacements[0][1]} (reused cached value)" if replacements else "No change",
        "explanation": (
            f"Reused {len(replacements)} previously computed subexpression(s) instead of recalculating."
            if replacements else "No redundant common subexpressions across unmodified operands."
        ),
    }


def _apply_loop_optimization(ast: Dict[str, Any]) -> Dict[str, Any]:
    hoisted_examples: List[Tuple[str, str]] = []
    hoist_counter = 0

    def optimize_block(block: Dict[str, Any]) -> None:
        nonlocal hoist_counter
        new_stmts: List[Dict[str, Any]] = []

        for stmt in block.get("statements", []):
            nt = stmt.get("nodeType")
            if nt in ("ForStmt", "WhileStmt"):
                body = stmt.get("body")
                if body and body.get("nodeType") == "Block":
                    optimize_block(body)
                    # Identify variables modified inside loop
                    loop_modified = _collect_modified_vars(stmt)
                    hoisted_decls: List[Dict[str, Any]] = []

                    def hoist_invariant_in_expr(expr: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
                        nonlocal hoist_counter
                        if not expr:
                            return expr
                        if expr.get("nodeType") == "BinaryExpr" and expr.get("operator") in ("+", "-", "*", "/"):
                            deps = _collect_identifiers(expr)
                            if deps and not (deps & loop_modified) and not _has_side_effects(expr):
                                hoist_counter += 1
                                temp_name = f"_licm_{hoist_counter}"
                                orig_text = expr_to_c(expr)
                                hoisted_decls.append(
                                    make_node(
                                        "VarDecl",
                                        line=expr.get("line", 0),
                                        varType="int",
                                        name=temp_name,
                                        arraySize=None,
                                        init=copy.deepcopy(expr),
                                    )
                                )
                                hoisted_examples.append((orig_text, f"int {temp_name} = {orig_text}; (hoisted pre-loop)"))
                                return make_node("Identifier", line=expr.get("line", 0), name=temp_name)
                            expr["left"] = hoist_invariant_in_expr(expr["left"])
                            expr["right"] = hoist_invariant_in_expr(expr["right"])
                        return expr

                    for bstmt in body.get("statements", []):
                        bnt = bstmt.get("nodeType")
                        if bnt == "AssignStmt":
                            bstmt["value"] = hoist_invariant_in_expr(bstmt["value"])
                        elif bnt == "VarDecl" and bstmt.get("init") is not None:
                            bstmt["init"] = hoist_invariant_in_expr(bstmt["init"])

                    for hd in hoisted_decls:
                        new_stmts.append(hd)

            elif nt == "IfStmt":
                if stmt["thenBranch"].get("nodeType") == "Block":
                    optimize_block(stmt["thenBranch"])
                if stmt.get("elseBranch") and stmt["elseBranch"].get("nodeType") == "Block":
                    optimize_block(stmt["elseBranch"])
            elif nt == "Block":
                optimize_block(stmt)

            new_stmts.append(stmt)

        block["statements"] = new_stmts

    for decl in ast.get("declarations", []):
        if decl["nodeType"] == "FunctionDecl":
            optimize_block(decl["body"])

    return {
        "applied": len(hoisted_examples) > 0,
        "changes_count": len(hoisted_examples),
        "before_snippet": hoisted_examples[0][0] if hoisted_examples else "No loop-invariant subexpressions detected",
        "after_snippet": hoisted_examples[0][1] if hoisted_examples else "No change",
        "explanation": (
            f"Hoisted {len(hoisted_examples)} loop-invariant expression(s) outside loop headers via LICM."
            if hoisted_examples else "No loop-invariant expressions eligible for pre-loop hoisting."
        ),
    }


def optimize_program(
    source_code: str,
    ast: Dict[str, Any],
    original_ir: Dict[str, Any],
    selected_passes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    if selected_passes is None:
        selected_passes = list(PASS_CATALOG.keys())

    working_ast = copy.deepcopy(ast)
    pass_results: List[Dict[str, Any]] = []

    pass_order = [
        ("constant_folding", _apply_constant_folding),
        ("constant_propagation", _apply_constant_propagation),
        ("common_subexpression_elimination", _apply_cse),
        ("loop_optimization", _apply_loop_optimization),
        ("dead_code_elimination", _apply_dead_code_elimination),
    ]

    for pid, fn in pass_order:
        meta = PASS_CATALOG[pid]
        if pid in selected_passes:
            res = fn(working_ast)
            pass_results.append({
                "id": pid,
                "name": meta["name"],
                "description": meta["description"],
                "estimated_benefit": meta["estimated_benefit"],
                "enabled": True,
                **res,
            })
        else:
            pass_results.append({
                "id": pid,
                "name": meta["name"],
                "description": meta["description"],
                "estimated_benefit": meta["estimated_benefit"],
                "enabled": False,
                "applied": False,
                "changes_count": 0,
                "before_snippet": "Pass disabled",
                "after_snippet": "Pass disabled",
                "explanation": "Pass was not selected for this optimization run.",
            })

    optimized_code = ast_to_c(working_ast)
    optimized_ir = generate_ir(working_ast)

    # Compute IR instruction reduction
    orig_count = original_ir.get("instruction_count", 0)
    opt_count = optimized_ir.get("instruction_count", 0)
    reduction_pct = round(((orig_count - opt_count) / orig_count) * 100, 1) if orig_count > 0 else 0.0

    return {
        "original_code": source_code,
        "optimized_code": optimized_code,
        "optimized_ast": working_ast,
        "original_ir": original_ir,
        "optimized_ir": optimized_ir,
        "pass_results": pass_results,
        "total_transformations": sum(p["changes_count"] for p in pass_results),
        "ir_instruction_delta": {
            "original": orig_count,
            "optimized": opt_count,
            "reduction_percent": reduction_pct,
        },
    }
