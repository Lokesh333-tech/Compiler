import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ASTNode } from "../types/compiler";

interface ASTTreeViewerProps {
  node: ASTNode;
  depth?: number;
  defaultExpandedDepth?: number;
}

function summarizeNode(node: ASTNode): string {
  const parts: string[] = [];
  if (typeof node.name === "string") parts.push(node.name);
  if (typeof node.callee === "string") parts.push(`${node.callee}()`);
  if (typeof node.operator === "string") parts.push(`op="${node.operator}"`);
  if (typeof node.varType === "string") parts.push(node.varType);
  if (typeof node.returnType === "string") parts.push(`-> ${node.returnType}`);
  if (node.value !== undefined && typeof node.value !== "object") {
    parts.push(`val=${String(node.value)}`);
  }
  return parts.join(" · ");
}

export default function ASTTreeViewer({
  node,
  depth = 0,
  defaultExpandedDepth = 3,
}: ASTTreeViewerProps) {
  const [expanded, setExpanded] = useState(depth < defaultExpandedDepth);

  if (!node || typeof node !== "object") return null;

  const childEntries: Array<{ key: string; items: ASTNode[] }> = [];
  for (const [k, v] of Object.entries(node)) {
    if (k === "nodeType" || k === "line") continue;
    if (Array.isArray(v)) {
      const astChildren = v.filter(
        (el): el is ASTNode => Boolean(el && typeof el === "object" && "nodeType" in el)
      );
      if (astChildren.length > 0) {
        childEntries.push({ key: k, items: astChildren });
      }
    } else if (v && typeof v === "object" && "nodeType" in v) {
      childEntries.push({ key: k, items: [v as ASTNode] });
    }
  }

  const hasChildren = childEntries.length > 0;
  const summary = summarizeNode(node);

  return (
    <div className="font-mono text-xs select-text">
      <div
        className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-800/60 transition-colors ${
          hasChildren ? "cursor-pointer" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setExpanded((prev) => !prev)}
      >
        <span className="w-4 h-4 flex items-center justify-center text-slate-500 shrink-0">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
          )}
        </span>

        <span className="text-cyan-400 font-semibold">{node.nodeType}</span>

        {summary && <span className="text-slate-300 truncate">{summary}</span>}

        {typeof node.line === "number" && node.line > 0 && (
          <span className="ml-auto text-[11px] text-slate-500 tabular-nums shrink-0">
            L{node.line}
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {childEntries.map((entry) => (
            <div key={entry.key}>
              <div
                className="text-[11px] text-slate-500 py-0.5"
                style={{ paddingLeft: `${(depth + 1) * 16 + 10}px` }}
              >
                {entry.key}:
              </div>
              {entry.items.map((child, idx) => (
                <ASTTreeViewer
                  key={`${entry.key}-${idx}-${child.nodeType}`}
                  node={child}
                  depth={depth + 1}
                  defaultExpandedDepth={defaultExpandedDepth}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
