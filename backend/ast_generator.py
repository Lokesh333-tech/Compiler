"""AST node representations and structural helpers for OptiForge-OS."""

from typing import Any, Dict, List, Optional


def make_node(node_type: str, line: int = 0, **kwargs: Any) -> Dict[str, Any]:
    node: Dict[str, Any] = {
        "nodeType": node_type,
        "line": line,
    }
    for key, val in kwargs.items():
        node[key] = val
    return node


def ast_stats(ast: Dict[str, Any]) -> Dict[str, int]:
    """Compute structural counts across an AST tree for telemetry and analysis."""
    counts = {
        "total_nodes": 0,
        "functions": 0,
        "variables": 0,
        "loops": 0,
        "conditionals": 0,
        "binary_ops": 0,
        "calls": 0,
        "returns": 0,
    }

    def visit(node: Any) -> None:
        if isinstance(node, dict) and "nodeType" in node:
            counts["total_nodes"] += 1
            nt = node["nodeType"]
            if nt == "FunctionDecl":
                counts["functions"] += 1
            elif nt == "VarDecl":
                counts["variables"] += 1
            elif nt in ("ForStmt", "WhileStmt"):
                counts["loops"] += 1
            elif nt == "IfStmt":
                counts["conditionals"] += 1
            elif nt == "BinaryExpr":
                counts["binary_ops"] += 1
            elif nt == "CallExpr":
                counts["calls"] += 1
            elif nt == "ReturnStmt":
                counts["returns"] += 1

            for v in node.values():
                if isinstance(v, (dict, list)):
                    visit(v)
        elif isinstance(node, list):
            for item in node:
                visit(item)

    visit(ast)
    return counts


def ast_to_c(node: Dict[str, Any], indent: int = 0) -> str:
    """Pretty-print an AST back to clean C source code."""
    pad = "    " * indent
    nt = node.get("nodeType")

    if nt == "Program":
        parts: List[str] = []
        for inc in node.get("includes", []):
            parts.append(inc)
        if node.get("includes"):
            parts.append("")
        for decl in node.get("declarations", []):
            parts.append(ast_to_c(decl, 0))
            parts.append("")
        return "\n".join(parts).strip() + "\n"

    if nt == "FunctionDecl":
        params = ", ".join(
            f"{p['varType']} {p['name']}" for p in node.get("params", [])
        )
        body = ast_to_c(node["body"], indent)
        return f"{node['returnType']} {node['name']}({params}) {body}"

    if nt == "Block":
        lines = ["{"]
        for stmt in node.get("statements", []):
            rendered = ast_to_c(stmt, indent + 1)
            if rendered:
                lines.append(rendered)
        lines.append(f"{pad}}}")
        return "\n".join(lines)

    if nt == "VarDecl":
        vtype = node["varType"]
        name = node["name"]
        arr = f"[{node['arraySize']}]" if node.get("arraySize") is not None else ""
        if node.get("init") is not None:
            return f"{pad}{vtype} {name}{arr} = {expr_to_c(node['init'])};"
        return f"{pad}{vtype} {name}{arr};"

    if nt == "AssignStmt":
        target = expr_to_c(node["target"])
        op = node.get("operator", "=")
        val = expr_to_c(node["value"])
        return f"{pad}{target} {op} {val};"

    if nt == "ReturnStmt":
        if node.get("value") is not None:
            return f"{pad}return {expr_to_c(node['value'])};"
        return f"{pad}return;"

    if nt == "IfStmt":
        cond = expr_to_c(node["condition"])
        then_b = ast_to_c(node["thenBranch"], indent)
        out = f"{pad}if ({cond}) {then_b}"
        if node.get("elseBranch") is not None:
            else_b = ast_to_c(node["elseBranch"], indent)
            out += f" else {else_b}"
        return out

    if nt == "WhileStmt":
        cond = expr_to_c(node["condition"])
        body = ast_to_c(node["body"], indent)
        return f"{pad}while ({cond}) {body}"

    if nt == "ForStmt":
        init_s = ""
        if node.get("init"):
            init_rendered = ast_to_c(node["init"], 0).strip()
            init_s = init_rendered[:-1] if init_rendered.endswith(";") else init_rendered
        cond_s = expr_to_c(node["condition"]) if node.get("condition") else ""
        upd_s = expr_to_c(node["update"]) if node.get("update") else ""
        body = ast_to_c(node["body"], indent)
        return f"{pad}for ({init_s}; {cond_s}; {upd_s}) {body}"

    if nt == "ExprStmt":
        return f"{pad}{expr_to_c(node['expression'])};"

    if nt == "BreakStmt":
        return f"{pad}break;"

    if nt == "ContinueStmt":
        return f"{pad}continue;"

    return ""


def expr_to_c(node: Optional[Dict[str, Any]]) -> str:
    if node is None:
        return ""
    nt = node.get("nodeType")
    if nt == "Literal":
        return str(node["value"])
    if nt == "Identifier":
        return str(node["name"])
    if nt == "ArrayAccess":
        return f"{node['name']}[{expr_to_c(node['index'])}]"
    if nt == "BinaryExpr":
        left = expr_to_c(node["left"])
        right = expr_to_c(node["right"])
        op = node["operator"]
        # Preserve parens for clarity when nested
        if node["left"].get("nodeType") == "BinaryExpr":
            left_op = node["left"].get("operator")
            if _prec(left_op) < _prec(op):
                left = f"({left})"
        if node["right"].get("nodeType") == "BinaryExpr":
            right_op = node["right"].get("operator")
            if _prec(right_op) <= _prec(op):
                right = f"({right})"
        return f"{left} {op} {right}"
    if nt == "UnaryExpr":
        op = node["operator"]
        operand = expr_to_c(node["operand"])
        if node.get("prefix", True):
            return f"{op}{operand}"
        return f"{operand}{op}"
    if nt == "AssignExpr":
        return f"{expr_to_c(node['target'])} {node.get('operator', '=')} {expr_to_c(node['value'])}"
    if nt == "CallExpr":
        args = ", ".join(expr_to_c(a) for a in node.get("arguments", []))
        return f"{node['callee']}({args})"
    if nt == "ArrayInit":
        elems = ", ".join(expr_to_c(e) for e in node.get("elements", []))
        return f"{{{elems}}}"
    return ""


def _prec(op: Optional[str]) -> int:
    if op in ("||",):
        return 1
    if op in ("&&",):
        return 2
    if op in ("==", "!="):
        return 3
    if op in ("<", "<=", ">", ">="):
        return 4
    if op in ("+", "-"):
        return 5
    if op in ("*", "/", "%"):
        return 6
    return 10
