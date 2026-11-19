"""Three-Address Code (TAC) Intermediate Representation generator for OptiForge-OS."""

from typing import Any, Dict, List, Optional


class IRGenerator:
    def __init__(self) -> None:
        self.instructions: List[Dict[str, Any]] = []
        self.temp_counter = 0
        self.label_counter = 0
        self.current_block = "entry"

    def new_temp(self) -> str:
        self.temp_counter += 1
        return f"t{self.temp_counter}"

    def new_label(self, prefix: str = "L") -> str:
        self.label_counter += 1
        return f"{prefix}{self.label_counter}"

    def emit(
        self,
        op: str,
        dest: Optional[str] = None,
        arg1: Optional[str] = None,
        arg2: Optional[str] = None,
        text: str = "",
        line: int = 0,
    ) -> None:
        self.instructions.append({
            "index": len(self.instructions) + 1,
            "block": self.current_block,
            "op": op,
            "dest": dest,
            "arg1": arg1,
            "arg2": arg2,
            "text": text,
            "line": line,
        })

    def generate(self, ast: Dict[str, Any]) -> Dict[str, Any]:
        for decl in ast.get("declarations", []):
            if decl["nodeType"] == "FunctionDecl":
                self.current_block = f"fn_{decl['name']}"
                self.emit("FUNC_BEGIN", dest=decl["name"], text=f"func {decl['name']}:", line=decl.get("line", 0))
                for p in decl.get("params", []):
                    self.emit("PARAM_DECL", dest=p["name"], arg1=p["varType"], text=f"param {p['name']} : {p['varType']}", line=p.get("line", 0))
                self.gen_block(decl["body"])
                self.emit("FUNC_END", dest=decl["name"], text=f"end func {decl['name']}", line=decl.get("line", 0))
            elif decl["nodeType"] == "VarDecl":
                self.gen_var_decl(decl)

        blocks: Dict[str, List[Dict[str, Any]]] = {}
        for inst in self.instructions:
            blocks.setdefault(inst["block"], []).append(inst)

        return {
            "instructions": self.instructions,
            "text": "\n".join(inst["text"] for inst in self.instructions),
            "basic_blocks": [
                {"name": bname, "instructions": binsts}
                for bname, binsts in blocks.items()
            ],
            "temp_count": self.temp_counter,
            "instruction_count": len(self.instructions),
        }

    def gen_block(self, block: Dict[str, Any]) -> None:
        for stmt in block.get("statements", []):
            self.gen_stmt(stmt)

    def gen_var_decl(self, node: Dict[str, Any]) -> None:
        line = node.get("line", 0)
        name = node["name"]
        if node.get("init") is not None:
            if node["init"].get("nodeType") == "ArrayInit":
                vals = [self.gen_expr(e) for e in node["init"].get("elements", [])]
                self.emit("ARRAY_INIT", dest=name, arg1=", ".join(vals), text=f"{name} = {{{', '.join(vals)}}}", line=line)
            else:
                val = self.gen_expr(node["init"])
                self.emit("ASSIGN", dest=name, arg1=val, text=f"{name} = {val}", line=line)
        else:
            self.emit("ALLOC", dest=name, arg1=node["varType"], text=f"alloc {name} : {node['varType']}", line=line)

    def gen_stmt(self, node: Dict[str, Any]) -> None:
        nt = node.get("nodeType")
        line = node.get("line", 0)

        if nt == "Block":
            self.gen_block(node)

        elif nt == "VarDecl":
            self.gen_var_decl(node)

        elif nt == "AssignStmt":
            target = self.gen_lvalue(node["target"])
            op = node.get("operator", "=")
            rhs = self.gen_expr(node["value"])
            if op == "=":
                self.emit("ASSIGN", dest=target, arg1=rhs, text=f"{target} = {rhs}", line=line)
            else:
                base_op = op[0]
                t = self.new_temp()
                self.emit(base_op, dest=t, arg1=target, arg2=rhs, text=f"{t} = {target} {base_op} {rhs}", line=line)
                self.emit("ASSIGN", dest=target, arg1=t, text=f"{target} = {t}", line=line)

        elif nt == "ReturnStmt":
            if node.get("value") is not None:
                val = self.gen_expr(node["value"])
                self.emit("RET", arg1=val, text=f"return {val}", line=line)
            else:
                self.emit("RET", text="return", line=line)

        elif nt == "ExprStmt":
            self.gen_expr(node["expression"])

        elif nt == "IfStmt":
            cond = self.gen_expr(node["condition"])
            else_lbl = self.new_label("L_ELSE_")
            end_lbl = self.new_label("L_ENDIF_")
            if node.get("elseBranch"):
                self.emit("JZ", arg1=cond, dest=else_lbl, text=f"ifFalse {cond} goto {else_lbl}", line=line)
                self.current_block = self.new_label("then_")
                self.gen_stmt(node["thenBranch"])
                self.emit("JMP", dest=end_lbl, text=f"goto {end_lbl}", line=line)
                self.current_block = else_lbl
                self.emit("LABEL", dest=else_lbl, text=f"{else_lbl}:", line=line)
                self.gen_stmt(node["elseBranch"])
                self.current_block = end_lbl
                self.emit("LABEL", dest=end_lbl, text=f"{end_lbl}:", line=line)
            else:
                self.emit("JZ", arg1=cond, dest=end_lbl, text=f"ifFalse {cond} goto {end_lbl}", line=line)
                self.current_block = self.new_label("then_")
                self.gen_stmt(node["thenBranch"])
                self.current_block = end_lbl
                self.emit("LABEL", dest=end_lbl, text=f"{end_lbl}:", line=line)

        elif nt == "WhileStmt":
            cond_lbl = self.new_label("L_WHILE_")
            end_lbl = self.new_label("L_ENDWHILE_")
            self.current_block = cond_lbl
            self.emit("LABEL", dest=cond_lbl, text=f"{cond_lbl}:", line=line)
            cond = self.gen_expr(node["condition"])
            self.emit("JZ", arg1=cond, dest=end_lbl, text=f"ifFalse {cond} goto {end_lbl}", line=line)
            self.current_block = self.new_label("while_body_")
            self.gen_stmt(node["body"])
            self.emit("JMP", dest=cond_lbl, text=f"goto {cond_lbl}", line=line)
            self.current_block = end_lbl
            self.emit("LABEL", dest=end_lbl, text=f"{end_lbl}:", line=line)

        elif nt == "ForStmt":
            if node.get("init"):
                self.gen_stmt(node["init"])
            cond_lbl = self.new_label("L_FOR_")
            end_lbl = self.new_label("L_ENDFOR_")
            self.current_block = cond_lbl
            self.emit("LABEL", dest=cond_lbl, text=f"{cond_lbl}:", line=line)
            if node.get("condition"):
                cond = self.gen_expr(node["condition"])
                self.emit("JZ", arg1=cond, dest=end_lbl, text=f"ifFalse {cond} goto {end_lbl}", line=line)
            self.current_block = self.new_label("for_body_")
            self.gen_stmt(node["body"])
            if node.get("update"):
                self.gen_expr(node["update"])
            self.emit("JMP", dest=cond_lbl, text=f"goto {cond_lbl}", line=line)
            self.current_block = end_lbl
            self.emit("LABEL", dest=end_lbl, text=f"{end_lbl}:", line=line)

    def gen_lvalue(self, node: Dict[str, Any]) -> str:
        if node.get("nodeType") == "Identifier":
            return str(node["name"])
        if node.get("nodeType") == "ArrayAccess":
            idx = self.gen_expr(node["index"])
            return f"{node['name']}[{idx}]"
        return "tmp"

    def gen_expr(self, node: Optional[Dict[str, Any]]) -> str:
        if not node:
            return "0"
        nt = node.get("nodeType")
        line = node.get("line", 0)

        if nt == "Literal":
            return str(node["value"])
        if nt == "Identifier":
            return str(node["name"])
        if nt == "ArrayAccess":
            idx = self.gen_expr(node["index"])
            t = self.new_temp()
            self.emit("LOAD_IDX", dest=t, arg1=node["name"], arg2=idx, text=f"{t} = {node['name']}[{idx}]", line=line)
            return t
        if nt == "BinaryExpr":
            l = self.gen_expr(node["left"])
            r = self.gen_expr(node["right"])
            op = node["operator"]
            t = self.new_temp()
            self.emit(op, dest=t, arg1=l, arg2=r, text=f"{t} = {l} {op} {r}", line=line)
            return t
        if nt == "UnaryExpr":
            op = node["operator"]
            operand = self.gen_lvalue(node["operand"]) if op in ("++", "--") else self.gen_expr(node["operand"])
            if op in ("++", "--"):
                delta_op = "+" if op == "++" else "-"
                t = self.new_temp()
                self.emit(delta_op, dest=t, arg1=operand, arg2="1", text=f"{t} = {operand} {delta_op} 1", line=line)
                self.emit("ASSIGN", dest=operand, arg1=t, text=f"{operand} = {t}", line=line)
                return operand
            t = self.new_temp()
            self.emit(f"UNARY_{op}", dest=t, arg1=operand, text=f"{t} = {op}{operand}", line=line)
            return t
        if nt == "AssignExpr":
            target = self.gen_lvalue(node["target"])
            rhs = self.gen_expr(node["value"])
            self.emit("ASSIGN", dest=target, arg1=rhs, text=f"{target} = {rhs}", line=line)
            return target
        if nt == "CallExpr":
            args = [self.gen_expr(a) for a in node.get("arguments", [])]
            for a in args:
                self.emit("PARAM", arg1=a, text=f"param {a}", line=line)
            t = self.new_temp()
            self.emit("CALL", dest=t, arg1=node["callee"], arg2=str(len(args)), text=f"{t} = call {node['callee']}, {len(args)}", line=line)
            return t
        return "0"


def generate_ir(ast: Dict[str, Any]) -> Dict[str, Any]:
    return IRGenerator().generate(ast)
