"""Lexical analyzer for OptiForge-OS compiler front-end."""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any
import re

C_KEYWORDS = {
    "auto", "break", "case", "char", "const", "continue", "default", "do",
    "double", "else", "enum", "extern", "float", "for", "goto", "if",
    "inline", "int", "long", "register", "restrict", "return", "short",
    "signed", "sizeof", "static", "struct", "switch", "typedef", "union",
    "unsigned", "void", "volatile", "while"
}

MULTI_CHAR_OPS = (
    "++", "--", "==", "!=", "<=", ">=", "&&", "||",
    "+=", "-=", "*=", "/=", "%=", "<<", ">>", "->"
)

SINGLE_CHAR_OPS = set("+-*/%=<>!&|^~?:")
PUNCTUATORS = set("(){}[];,.")


@dataclass
class Token:
    id: int
    type: str
    value: str
    line: int
    column: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class LexerError(Exception):
    def __init__(self, message: str, line: int, column: int):
        super().__init__(message)
        self.message = message
        self.line = line
        self.column = column


def tokenize(source: str, language: str = "c") -> Dict[str, Any]:
    """Tokenize C source code into structured tokens with positions."""
    if language != "c":
        return {
            "tokens": [],
            "errors": [{
                "stage": "lexer",
                "message": f"Language '{language}' front-end adapter is queued for future release. Currently executing C front-end.",
                "line": 1,
                "column": 1,
                "severity": "error"
            }]
        }

    tokens: List[Token] = []
    errors: List[Dict[str, Any]] = []
    n = len(source)
    i = 0
    line = 1
    col = 1
    tid = 1

    while i < n:
        ch = source[i]

        # Whitespace
        if ch in " \t\r":
            i += 1
            col += 1
            continue
        if ch == "\n":
            i += 1
            line += 1
            col = 1
            continue

        # Single-line comment
        if source.startswith("//", i):
            start_col = col
            end = source.find("\n", i)
            if end == -1:
                end = n
            text = source[i:end]
            tokens.append(Token(tid, "COMMENT", text, line, start_col))
            tid += 1
            col += end - i
            i = end
            continue

        # Multi-line comment
        if source.startswith("/*", i):
            start_line, start_col = line, col
            end = source.find("*/", i + 2)
            if end == -1:
                errors.append({
                    "stage": "lexer",
                    "message": "Unterminated block comment",
                    "line": start_line,
                    "column": start_col,
                    "severity": "error"
                })
                break
            text = source[i:end + 2]
            tokens.append(Token(tid, "COMMENT", text, start_line, start_col))
            tid += 1
            for c in text:
                if c == "\n":
                    line += 1
                    col = 1
                else:
                    col += 1
            i = end + 2
            continue

        # Preprocessor directive
        if ch == "#":
            start_col = col
            end = source.find("\n", i)
            if end == -1:
                end = n
            text = source[i:end].strip()
            tokens.append(Token(tid, "PREPROCESSOR", text, line, start_col))
            tid += 1
            col += end - i
            i = end
            continue

        # String literal
        if ch == '"':
            start_line, start_col = line, col
            j = i + 1
            escaped = False
            closed = False
            while j < n:
                c = source[j]
                if escaped:
                    escaped = False
                elif c == "\\":
                    escaped = True
                elif c == '"':
                    closed = True
                    j += 1
                    break
                elif c == "\n":
                    break
                j += 1
            if not closed:
                errors.append({
                    "stage": "lexer",
                    "message": "Unterminated string literal",
                    "line": start_line,
                    "column": start_col,
                    "severity": "error"
                })
                i = j
                continue
            val = source[i:j]
            tokens.append(Token(tid, "STRING_LITERAL", val, start_line, start_col))
            tid += 1
            col += j - i
            i = j
            continue

        # Char literal
        if ch == "'":
            start_line, start_col = line, col
            j = i + 1
            escaped = False
            closed = False
            while j < n:
                c = source[j]
                if escaped:
                    escaped = False
                elif c == "\\":
                    escaped = True
                elif c == "'":
                    closed = True
                    j += 1
                    break
                elif c == "\n":
                    break
                j += 1
            if not closed:
                errors.append({
                    "stage": "lexer",
                    "message": "Unterminated character literal",
                    "line": start_line,
                    "column": start_col,
                    "severity": "error"
                })
                i = j
                continue
            val = source[i:j]
            tokens.append(Token(tid, "CHAR_LITERAL", val, start_line, start_col))
            tid += 1
            col += j - i
            i = j
            continue

        # Number literal (int or float)
        if ch.isdigit():
            start_col = col
            m = re.match(r"0[xX][0-9a-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?[fFlLuU]*", source[i:])
            val = m.group(0) if m else ch
            tok_type = "FLOAT_LITERAL" if ("." in val or "e" in val.lower()) and not val.lower().startswith("0x") else "INT_LITERAL"
            tokens.append(Token(tid, tok_type, val, line, start_col))
            tid += 1
            i += len(val)
            col += len(val)
            continue

        # Identifier or keyword
        if ch.isalpha() or ch == "_":
            start_col = col
            m = re.match(r"[A-Za-z_][A-Za-z0-9_]*", source[i:])
            val = m.group(0) if m else ch
            tok_type = "KEYWORD" if val in C_KEYWORDS else "IDENTIFIER"
            tokens.append(Token(tid, tok_type, val, line, start_col))
            tid += 1
            i += len(val)
            col += len(val)
            continue

        # Multi-char operators
        matched_multi = None
        for op in MULTI_CHAR_OPS:
            if source.startswith(op, i):
                matched_multi = op
                break
        if matched_multi:
            tokens.append(Token(tid, "OPERATOR", matched_multi, line, col))
            tid += 1
            i += len(matched_multi)
            col += len(matched_multi)
            continue

        # Single-char operators
        if ch in SINGLE_CHAR_OPS:
            tokens.append(Token(tid, "OPERATOR", ch, line, col))
            tid += 1
            i += 1
            col += 1
            continue

        # Punctuators
        if ch in PUNCTUATORS:
            tokens.append(Token(tid, "PUNCTUATOR", ch, line, col))
            tid += 1
            i += 1
            col += 1
            continue

        errors.append({
            "stage": "lexer",
            "message": f"Unexpected character '{ch}'",
            "line": line,
            "column": col,
            "severity": "error"
        })
        i += 1
        col += 1

    return {
        "tokens": [t.to_dict() for t in tokens],
        "errors": errors
    }
