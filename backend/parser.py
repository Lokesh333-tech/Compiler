"""Recursive-descent parser for C source code in OptiForge-OS."""

from typing import Any, Dict, List, Optional
from ast_generator import make_node, ast_stats

TYPE_KEYWORDS = {"int", "float", "double", "char", "void", "long", "short", "unsigned", "signed"}
QUALIFIERS = {"const", "static", "volatile", "inline"}


class ParseError(Exception):
    def __init__(self, message: str, line: int, column: int):
        super().__init__(message)
        self.message = message
        self.line = line
        self.column = column


class Parser:
    def __init__(self, raw_tokens: List[Dict[str, Any]]):
        self.includes: List[str] = []
        self.tokens: List[Dict[str, Any]] = []
        for t in raw_tokens:
            if t["type"] == "COMMENT":
                continue
            if t["type"] == "PREPROCESSOR":
                self.includes.append(t["value"])
                continue
            self.tokens.append(t)
        self.pos = 0
        self.errors: List[Dict[str, Any]] = []

    def current(self) -> Optional[Dict[str, Any]]:
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def peek(self, offset: int = 1) -> Optional[Dict[str, Any]]:
        idx = self.pos + offset
        if idx < len(self.tokens):
            return self.tokens[idx]
        return None

    def advance(self) -> Dict[str, Any]:
        tok = self.tokens[self.pos]
        self.pos += 1
        return tok

    def match_val(self, val: str) -> bool:
        tok = self.current()
        if tok and tok["value"] == val:
            self.pos += 1
            return True
        return False

    def expect_val(self, val: str, msg: Optional[str] = None) -> Dict[str, Any]:
        tok = self.current()
        if not tok:
            last_line = self.tokens[-1]["line"] if self.tokens else 1
            last_col = self.tokens[-1]["column"] if self.tokens else 1
            raise ParseError(msg or f"Expected '{val}' before end of file", last_line, last_col)
        if tok["value"] != val:
            raise ParseError(msg or f"Expected '{val}', got '{tok['value']}'", tok["line"], tok["column"])
        self.pos += 1
        return tok

    def expect_type(self, ttype: str, msg: Optional[str] = None) -> Dict[str, Any]:
        tok = self.current()
        if not tok:
            last_line = self.tokens[-1]["line"] if self.tokens else 1
            last_col = self.tokens[-1]["column"] if self.tokens else 1
            raise ParseError(msg or f"Expected {ttype} before end of file", last_line, last_col)
        if tok["type"] != ttype:
            raise ParseError(msg or f"Expected {ttype}, got '{tok['value']}'", tok["line"], tok["column"])
        self.pos += 1
        return tok

    def is_type_start(self, tok: Optional[Dict[str, Any]]) -> bool:
        if not tok:
            return False
        return tok["type"] == "KEYWORD" and (tok["value"] in TYPE_KEYWORDS or tok["value"] in QUALIFIERS)

    def parse_type_specifier(self) -> str:
        parts: List[str] = []
        while self.current() and self.is_type_start(self.current()):
            parts.append(self.advance()["value"])
        while self.current() and self.current()["value"] == "*":
            parts.append(self.advance()["value"])
        if not parts:
            tok = self.current()
            line = tok["line"] if tok else 1
            col = tok["column"] if tok else 1
            raise ParseError("Expected type specifier", line, col)
        return " ".join(parts)

    def parse_program(self) -> Dict[str, Any]:
        declarations: List[Dict[str, Any]] = []
        while self.current() is not None:
            try:
                if self.is_type_start(self.current()):
                    declarations.append(self.parse_top_level_decl())
                else:
                    tok = self.current()
                    raise ParseError(
                        f"Unexpected token '{tok['value']}' at top level",
                        tok["line"],
                        tok["column"],
                    )
            except ParseError as err:
                self.errors.append({
                    "stage": "parser",
                    "message": err.message,
                    "line": err.line,
                    "column": err.column,
                    "severity": "error"
                })
                # Synchronize to next semicolon or closing brace
                while self.current() and self.current()["value"] not in (";", "}"):
                    self.advance()
                if self.current():
                    self.advance()

        program = make_node(
            "Program",
            line=1,
            includes=self.includes,
            declarations=declarations
        )
        return program

    def parse_top_level_decl(self) -> Dict[str, Any]:
        start_tok = self.current()
        line = start_tok["line"] if start_tok else 1
        vtype = self.parse_type_specifier()
        ident = self.expect_type("IDENTIFIER", "Expected identifier name in declaration")

        if self.current() and self.current()["value"] == "(":
            self.advance()
            params: List[Dict[str, Any]] = []
            if self.current() and self.current()["value"] != ")":
                # Handle (void)
                if (
                    self.current()["value"] == "void"
                    and self.peek()
                    and self.peek()["value"] == ")"
                ):
                    self.advance()
                else:
                    while True:
                        p_tok = self.current()
                        p_type = self.parse_type_specifier()
                        p_name = self.expect_type("IDENTIFIER", "Expected parameter name")
                        params.append({
                            "nodeType": "Param",
                            "varType": p_type,
                            "name": p_name["value"],
                            "line": p_tok["line"] if p_tok else line,
                        })
                        if not self.match_val(","):
                            break
            self.expect_val(")", "Expected ')' after function parameter list")
            body = self.parse_block()
            return make_node(
                "FunctionDecl",
                line=line,
                returnType=vtype,
                name=ident["value"],
                params=params,
                body=body,
            )

        # Global variable
        return self._finish_var_decl(vtype, ident, line)

    def _finish_var_decl(self, vtype: str, ident: Dict[str, Any], line: int) -> Dict[str, Any]:
        array_size = None
        if self.match_val("["):
            if self.current() and self.current()["value"] != "]":
                sz_tok = self.advance()
                array_size = sz_tok["value"]
            self.expect_val("]", "Expected ']' after array size")
        init_expr = None
        if self.match_val("="):
            if self.current() and self.current()["value"] == "{":
                init_expr = self.parse_array_init()
            else:
                init_expr = self.parse_expression()
        self.expect_val(";", "Expected ';' after variable declaration")
        return make_node(
            "VarDecl",
            line=line,
            varType=vtype,
            name=ident["value"],
            arraySize=array_size,
            init=init_expr,
        )

    def parse_array_init(self) -> Dict[str, Any]:
        tok = self.expect_val("{")
        elements: List[Dict[str, Any]] = []
        if self.current() and self.current()["value"] != "}":
            while True:
                elements.append(self.parse_expression())
                if not self.match_val(","):
                    break
        self.expect_val("}")
        return make_node("ArrayInit", line=tok["line"], elements=elements)

    def parse_block(self) -> Dict[str, Any]:
        open_tok = self.expect_val("{", "Expected '{' to open block")
        statements: List[Dict[str, Any]] = []
        while self.current() and self.current()["value"] != "}":
            statements.append(self.parse_statement())
        self.expect_val("}", "Expected '}' to close block")
        return make_node("Block", line=open_tok["line"], statements=statements)

    def parse_statement(self) -> Dict[str, Any]:
        tok = self.current()
        if not tok:
            raise ParseError("Unexpected end of input while parsing statement", 1, 1)
        line = tok["line"]

        if tok["value"] == "{":
            return self.parse_block()

        if tok["value"] == "return":
            self.advance()
            val = None
            if self.current() and self.current()["value"] != ";":
                val = self.parse_expression()
            self.expect_val(";", "Expected ';' after return statement")
            return make_node("ReturnStmt", line=line, value=val)

        if tok["value"] == "if":
            self.advance()
            self.expect_val("(", "Expected '(' after 'if'")
            cond = self.parse_expression()
            self.expect_val(")", "Expected ')' after if condition")
            then_b = self.parse_statement()
            else_b = None
            if self.match_val("else"):
                else_b = self.parse_statement()
            return make_node("IfStmt", line=line, condition=cond, thenBranch=then_b, elseBranch=else_b)

        if tok["value"] == "while":
            self.advance()
            self.expect_val("(", "Expected '(' after 'while'")
            cond = self.parse_expression()
            self.expect_val(")", "Expected ')' after while condition")
            body = self.parse_statement()
            return make_node("WhileStmt", line=line, condition=cond, body=body)

        if tok["value"] == "for":
            return self.parse_for_statement()

        if tok["value"] == "break":
            self.advance()
            self.expect_val(";", "Expected ';' after break")
            return make_node("BreakStmt", line=line)

        if tok["value"] == "continue":
            self.advance()
            self.expect_val(";", "Expected ';' after continue")
            return make_node("ContinueStmt", line=line)

        if self.is_type_start(tok):
            vtype = self.parse_type_specifier()
            ident = self.expect_type("IDENTIFIER", "Expected variable name")
            return self._finish_var_decl(vtype, ident, line)

        # Expression or assignment statement
        expr = self.parse_expression()
        self.expect_val(";", "Expected ';' after expression")
        if expr.get("nodeType") == "AssignExpr":
            return make_node(
                "AssignStmt",
                line=line,
                target=expr["target"],
                operator=expr["operator"],
                value=expr["value"],
            )
        return make_node("ExprStmt", line=line, expression=expr)

    def parse_for_statement(self) -> Dict[str, Any]:
        for_tok = self.expect_val("for")
        line = for_tok["line"]
        self.expect_val("(", "Expected '(' after 'for'")

        init_node = None
        if self.current() and self.current()["value"] != ";":
            if self.is_type_start(self.current()):
                vtype = self.parse_type_specifier()
                ident = self.expect_type("IDENTIFIER", "Expected loop variable name")
                init_expr = None
                if self.match_val("="):
                    init_expr = self.parse_expression()
                init_node = make_node("VarDecl", line=line, varType=vtype, name=ident["value"], arraySize=None, init=init_expr)
            else:
                expr = self.parse_expression()
                if expr.get("nodeType") == "AssignExpr":
                    init_node = make_node("AssignStmt", line=line, target=expr["target"], operator=expr["operator"], value=expr["value"])
                else:
                    init_node = make_node("ExprStmt", line=line, expression=expr)
        self.expect_val(";", "Expected ';' after for-loop initializer")

        cond_node = None
        if self.current() and self.current()["value"] != ";":
            cond_node = self.parse_expression()
        self.expect_val(";", "Expected ';' after for-loop condition")

        update_node = None
        if self.current() and self.current()["value"] != ")":
            update_node = self.parse_expression()
        self.expect_val(")", "Expected ')' after for-loop header")

        body = self.parse_statement()
        return make_node("ForStmt", line=line, init=init_node, condition=cond_node, update=update_node, body=body)

    def parse_expression(self) -> Dict[str, Any]:
        return self.parse_assignment()

    def parse_assignment(self) -> Dict[str, Any]:
        left = self.parse_logical_or()
        tok = self.current()
        if tok and tok["value"] in ("=", "+=", "-=", "*=", "/=", "%="):
            op = self.advance()["value"]
            right = self.parse_assignment()
            return make_node(
                "AssignExpr",
                line=tok["line"],
                target=left,
                operator=op,
                value=right,
            )
        return left

    def parse_logical_or(self) -> Dict[str, Any]:
        node = self.parse_logical_and()
        while self.current() and self.current()["value"] == "||":
            op_tok = self.advance()
            right = self.parse_logical_and()
            node = make_node("BinaryExpr", line=op_tok["line"], operator="||", left=node, right=right)
        return node

    def parse_logical_and(self) -> Dict[str, Any]:
        node = self.parse_equality()
        while self.current() and self.current()["value"] == "&&":
            op_tok = self.advance()
            right = self.parse_equality()
            node = make_node("BinaryExpr", line=op_tok["line"], operator="&&", left=node, right=right)
        return node

    def parse_equality(self) -> Dict[str, Any]:
        node = self.parse_relational()
        while self.current() and self.current()["value"] in ("==", "!="):
            op_tok = self.advance()
            right = self.parse_relational()
            node = make_node("BinaryExpr", line=op_tok["line"], operator=op_tok["value"], left=node, right=right)
        return node

    def parse_relational(self) -> Dict[str, Any]:
        node = self.parse_additive()
        while self.current() and self.current()["value"] in ("<", "<=", ">", ">="):
            op_tok = self.advance()
            right = self.parse_additive()
            node = make_node("BinaryExpr", line=op_tok["line"], operator=op_tok["value"], left=node, right=right)
        return node

    def parse_additive(self) -> Dict[str, Any]:
        node = self.parse_multiplicative()
        while self.current() and self.current()["value"] in ("+", "-"):
            op_tok = self.advance()
            right = self.parse_multiplicative()
            node = make_node("BinaryExpr", line=op_tok["line"], operator=op_tok["value"], left=node, right=right)
        return node

    def parse_multiplicative(self) -> Dict[str, Any]:
        node = self.parse_unary()
        while self.current() and self.current()["value"] in ("*", "/", "%"):
            op_tok = self.advance()
            right = self.parse_unary()
            node = make_node("BinaryExpr", line=op_tok["line"], operator=op_tok["value"], left=node, right=right)
        return node

    def parse_unary(self) -> Dict[str, Any]:
        tok = self.current()
        if tok and tok["value"] in ("-", "+", "!", "++", "--", "&", "*"):
            op_tok = self.advance()
            operand = self.parse_unary()
            return make_node("UnaryExpr", line=op_tok["line"], operator=op_tok["value"], operand=operand, prefix=True)
        return self.parse_postfix()

    def parse_postfix(self) -> Dict[str, Any]:
        node = self.parse_primary()
        while self.current():
            tok = self.current()
            if tok["value"] in ("++", "--"):
                op_tok = self.advance()
                node = make_node("UnaryExpr", line=op_tok["line"], operator=op_tok["value"], operand=node, prefix=False)
            elif tok["value"] == "[":
                self.advance()
                idx = self.parse_expression()
                self.expect_val("]", "Expected ']' in array access")
                if node.get("nodeType") == "Identifier":
                    node = make_node("ArrayAccess", line=tok["line"], name=node["name"], index=idx)
            else:
                break
        return node

    def parse_primary(self) -> Dict[str, Any]:
        tok = self.current()
        if not tok:
            raise ParseError("Unexpected end of expression", 1, 1)

        if tok["type"] in ("INT_LITERAL", "FLOAT_LITERAL", "STRING_LITERAL", "CHAR_LITERAL"):
            self.advance()
            val: Any = tok["value"]
            lit_type = "string"
            if tok["type"] == "INT_LITERAL":
                clean = val.rstrip("uUlL")
                val = int(clean, 16) if clean.lower().startswith("0x") else int(clean)
                lit_type = "int"
            elif tok["type"] == "FLOAT_LITERAL":
                clean = val.rstrip("fFlL")
                val = float(clean)
                lit_type = "float"
            return make_node("Literal", line=tok["line"], value=val, literalType=lit_type)

        if tok["type"] == "IDENTIFIER":
            self.advance()
            if self.current() and self.current()["value"] == "(":
                self.advance()
                args: List[Dict[str, Any]] = []
                if self.current() and self.current()["value"] != ")":
                    while True:
                        args.append(self.parse_expression())
                        if not self.match_val(","):
                            break
                self.expect_val(")", "Expected ')' after function arguments")
                return make_node("CallExpr", line=tok["line"], callee=tok["value"], arguments=args)
            return make_node("Identifier", line=tok["line"], name=tok["value"])

        if tok["value"] == "(":
            self.advance()
            expr = self.parse_expression()
            self.expect_val(")", "Expected ')' after grouped expression")
            return expr

        raise ParseError(f"Unexpected token '{tok['value']}' in expression", tok["line"], tok["column"])


def parse(tokens: List[Dict[str, Any]]) -> Dict[str, Any]:
    parser = Parser(tokens)
    ast = parser.parse_program()
    return {
        "ast": ast,
        "stats": ast_stats(ast),
        "errors": parser.errors,
    }
