"""Semantic analyzer and Symbol Table builder for OptiForge-OS."""

from typing import Any, Dict, List, Optional


BUILTIN_FUNCTIONS = {"printf", "scanf", "puts", "malloc", "free", "abs", "sqrt", "pow", "clock"}


def analyze_semantics(ast: Dict[str, Any]) -> Dict[str, Any]:
    symbols: List[Dict[str, Any]] = []
    diagnostics: List[Dict[str, Any]] = []
    scope_stack: List[Dict[str, Dict[str, Any]]] = [{}]
    scope_names: List[str] = ["global"]

    def current_scope_name() -> str:
        return ".".join(scope_names)

    def lookup(name: str) -> Optional[Dict[str, Any]]:
        for scope in reversed(scope_stack):
            if name in scope:
                return scope[name]
        return None

    def declare(name: str, sym_type: str, kind: str, line: int, initialized: bool = False) -> Dict[str, Any]:
        top = scope_stack[-1]
        if name in top:
            diagnostics.append({
                "stage": "semantic",
                "message": f"Redeclaration of '{name}' in scope '{current_scope_name()}'",
                "line": line,
                "column": 1,
                "severity": "error"
            })
        entry = {
            "name": name,
            "dataType": sym_type,
            "kind": kind,
            "scope": current_scope_name(),
            "line": line,
            "initialized": initialized,
            "reads": 0,
            "writes": 1 if initialized else 0,
        }
        top[name] = entry
        symbols.append(entry)
        return entry

    def eval_const(node: Optional[Dict[str, Any]]) -> Optional[Any]:
        if not node:
            return None
        nt = node.get("nodeType")
        if nt == "Literal" and node.get("literalType") in ("int", "float"):
            return node["value"]
        if nt == "BinaryExpr":
            l = eval_const(node.get("left"))
            r = eval_const(node.get("right"))
            if l is None or r is None:
                return None
            op = node["operator"]
            if op == "+":
                return l + r
            if op == "-":
                return l - r
            if op == "*":
                return l * r
            if op == "/":
                return l / r if r != 0 else None
        return None

    def visit_expr(node: Optional[Dict[str, Any]], is_write_target: bool = False) -> None:
        if not node:
            return
        nt = node.get("nodeType")

        if nt == "Identifier":
            sym = lookup(node["name"])
            if not sym:
                diagnostics.append({
                    "stage": "semantic",
                    "message": f"Undeclared identifier '{node['name']}'",
                    "line": node.get("line", 0),
                    "column": 1,
                    "severity": "error"
                })
            else:
                if is_write_target:
                    sym["writes"] += 1
                    sym["initialized"] = True
                else:
                    sym["reads"] += 1
                    if not sym["initialized"] and sym["kind"] == "variable":
                        diagnostics.append({
                            "stage": "semantic",
                            "message": f"Variable '{node['name']}' may be used uninitialized",
                            "line": node.get("line", 0),
                            "column": 1,
                            "severity": "warning"
                        })

        elif nt == "ArrayAccess":
            sym = lookup(node["name"])
            if not sym:
                diagnostics.append({
                    "stage": "semantic",
                    "message": f"Undeclared array '{node['name']}'",
                    "line": node.get("line", 0),
                    "column": 1,
                    "severity": "error"
                })
            else:
                if is_write_target:
                    sym["writes"] += 1
                else:
                    sym["reads"] += 1
            visit_expr(node.get("index"), False)

        elif nt == "BinaryExpr":
            visit_expr(node.get("left"), False)
            visit_expr(node.get("right"), False)
            if node.get("operator") in ("/", "%"):
                r_val = eval_const(node.get("right"))
                if r_val == 0:
                    diagnostics.append({
                        "stage": "semantic",
                        "message": "Division or modulo by constant zero detected",
                        "line": node.get("line", 0),
                        "column": 1,
                        "severity": "error"
                    })

        elif nt == "UnaryExpr":
            is_mut = node.get("operator") in ("++", "--")
            visit_expr(node.get("operand"), is_mut)

        elif nt == "AssignExpr":
            visit_expr(node.get("value"), False)
            visit_expr(node.get("target"), True)

        elif nt == "CallExpr":
            callee = node["callee"]
            sym = lookup(callee)
            if sym:
                sym["reads"] += 1
            elif callee not in BUILTIN_FUNCTIONS:
                diagnostics.append({
                    "stage": "semantic",
                    "message": f"Call to implicitly declared function '{callee}'",
                    "line": node.get("line", 0),
                    "column": 1,
                    "severity": "warning"
                })
            for arg in node.get("arguments", []):
                visit_expr(arg, False)

        elif nt == "ArrayInit":
            for el in node.get("elements", []):
                visit_expr(el, False)

    def visit_stmt(node: Dict[str, Any]) -> None:
        nt = node.get("nodeType")
        if nt == "Block":
            scope_stack.append({})
            scope_names.append(f"block@{node.get('line', 0)}")
            returned = False
            for stmt in node.get("statements", []):
                if returned:
                    diagnostics.append({
                        "stage": "semantic",
                        "message": "Unreachable statement detected after return",
                        "line": stmt.get("line", 0),
                        "column": 1,
                        "severity": "warning"
                    })
                visit_stmt(stmt)
                if stmt.get("nodeType") == "ReturnStmt":
                    returned = True
            scope_stack.pop()
            scope_names.pop()

        elif nt == "VarDecl":
            if node.get("init") is not None:
                visit_expr(node["init"], False)
            declare(
                node["name"],
                node["varType"],
                "variable",
                node.get("line", 0),
                initialized=node.get("init") is not None
            )

        elif nt == "AssignStmt":
            visit_expr(node.get("value"), False)
            visit_expr(node.get("target"), True)

        elif nt == "ReturnStmt":
            if node.get("value") is not None:
                visit_expr(node["value"], False)

        elif nt == "IfStmt":
            visit_expr(node.get("condition"), False)
            cond_val = eval_const(node.get("condition"))
            if cond_val == 0:
                diagnostics.append({
                    "stage": "semantic",
                    "message": "Constant false condition in 'if' statement (dead branch candidate)",
                    "line": node.get("line", 0),
                    "column": 1,
                    "severity": "warning"
                })
            visit_stmt(node["thenBranch"])
            if node.get("elseBranch"):
                visit_stmt(node["elseBranch"])

        elif nt == "WhileStmt":
            visit_expr(node.get("condition"), False)
            visit_stmt(node["body"])

        elif nt == "ForStmt":
            scope_stack.append({})
            scope_names.append(f"for@{node.get('line', 0)}")
            if node.get("init"):
                visit_stmt(node["init"])
            if node.get("condition"):
                visit_expr(node["condition"], False)
            if node.get("update"):
                visit_expr(node["update"], False)
            visit_stmt(node["body"])
            scope_stack.pop()
            scope_names.pop()

        elif nt == "ExprStmt":
            visit_expr(node.get("expression"), False)

    # Program pass
    for decl in ast.get("declarations", []):
        if decl["nodeType"] == "FunctionDecl":
            declare(decl["name"], decl["returnType"], "function", decl.get("line", 0), True)
            scope_stack.append({})
            scope_names.append(decl["name"])
            for p in decl.get("params", []):
                declare(p["name"], p["varType"], "parameter", p.get("line", 0), True)
            body = decl.get("body", {})
            returned = False
            for stmt in body.get("statements", []):
                if returned:
                    diagnostics.append({
                        "stage": "semantic",
                        "message": "Unreachable statement detected after return",
                        "line": stmt.get("line", 0),
                        "column": 1,
                        "severity": "warning"
                    })
                visit_stmt(stmt)
                if stmt.get("nodeType") == "ReturnStmt":
                    returned = True
            scope_stack.pop()
            scope_names.pop()
        elif decl["nodeType"] == "VarDecl":
            visit_stmt(decl)

    # Unused variable warnings
    for sym in symbols:
        if sym["kind"] == "variable" and sym["reads"] == 0:
            diagnostics.append({
                "stage": "semantic",
                "message": f"Variable '{sym['name']}' is assigned or declared but never read (dead code candidate)",
                "line": sym["line"],
                "column": 1,
                "severity": "warning"
            })

    errors = [d for d in diagnostics if d["severity"] == "error"]
    warnings = [d for d in diagnostics if d["severity"] == "warning"]

    return {
        "symbols": symbols,
        "errors": errors,
        "warnings": warnings,
        "diagnostics": diagnostics,
    }
