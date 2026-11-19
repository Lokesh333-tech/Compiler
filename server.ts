import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const PYTHON_SERVICE = path.join(__dirname, "backend", "compiler_service.py");

function runPythonBackend<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [PYTHON_SERVICE], {
      cwd: path.join(__dirname, "backend"),
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn Python compiler service: ${err.message}`));
    });

    child.on("close", (code) => {
      try {
        const parsed = JSON.parse(stdout.trim() || "{}") as T;
        if (code !== 0 && !stdout.trim()) {
          reject(new Error(stderr || `Python service exited with code ${code}`));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error(`Invalid JSON from compiler backend: ${stderr || stdout}`));
      }
    });

    child.stdin.write(JSON.stringify({ action, payload }));
    child.stdin.end();
  });
}

async function enrichRecommendationsWithGemini(
  code: string,
  ruleOutput: {
    features: Record<string, unknown>;
    recommendations: Array<{
      pass_id: string;
      pass_name: string;
      confidence: number;
      priority: string;
      reason: string;
    }>;
  }
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `Analyze this C program and the extracted compiler AST/IR structural features. Provide concise, accurate optimization advice for the 5 supported compiler passes (constant_folding, constant_propagation, dead_code_elimination, common_subexpression_elimination, loop_optimization).

C Source Code:
\`\`\`c
${code.slice(0, 4000)}
\`\`\`

Extracted AST/IR Features:
${JSON.stringify(ruleOutput.features, null, 2)}`;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        systemInstruction:
          "You are a senior LLVM/GCC compiler architect. Only recommend passes justified by the provided C source code and AST/IR features. Be precise and concise.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "A 1-2 sentence technical architectural summary of optimization opportunities.",
            },
            pass_insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pass_id: { type: Type.STRING },
                  insight: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const rawText = (response.text ?? "{}").trim();
    return JSON.parse(rawText) as {
      summary?: string;
      pass_insights?: Array<{ pass_id: string; insight: string }>;
    };
  } catch (err) {
    console.warn("Gemini recommendation fallback triggered:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  // Samples & language capabilities
  app.get("/api/samples", async (_req: Request, res: Response) => {
    try {
      const data = await runPythonBackend("samples");
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load samples" });
    }
  });

  // Compile endpoint: Lexer -> Parser -> AST -> Semantic Analysis -> TAC IR
  app.post("/api/compile", async (req: Request, res: Response) => {
    try {
      const { code, language = "c" } = req.body as { code?: string; language?: string };
      if (typeof code !== "string") {
        res.status(400).json({ error: "Field 'code' must be a string." });
        return;
      }
      const result = await runPythonBackend("compile", { code, language });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Compilation failed" });
    }
  });

  // AI Recommendation endpoint (Rule-based AST/IR engine + optional Gemini 4 Hydrogen enrichment)
  app.post("/api/recommend", async (req: Request, res: Response) => {
    try {
      const { code, language = "c" } = req.body as { code?: string; language?: string };
      if (typeof code !== "string") {
        res.status(400).json({ error: "Field 'code' must be a string." });
        return;
      }
      const ruleResult = await runPythonBackend<{
        success: boolean;
        error?: string;
        engine?: string;
        features?: Record<string, unknown>;
        detected_patterns?: Array<Record<string, unknown>>;
        recommendations?: Array<{
          pass_id: string;
          pass_name: string;
          confidence: number;
          priority: string;
          reason: string;
        }>;
        recommended_pass_ids?: string[];
      }>("recommend", { code, language });

      if (!ruleResult.success) {
        res.json(ruleResult);
        return;
      }

      const geminiEnrichment = await enrichRecommendationsWithGemini(code, {
        features: ruleResult.features ?? {},
        recommendations: ruleResult.recommendations ?? [],
      });

      if (geminiEnrichment && ruleResult.recommendations) {
        const insightMap = new Map(
          (geminiEnrichment.pass_insights ?? []).map((p) => [p.pass_id, p.insight])
        );
        const mergedRecs = ruleResult.recommendations.map((rec) => ({
          ...rec,
          ai_note: insightMap.get(rec.pass_id) ?? undefined,
        }));
        res.json({
          ...ruleResult,
          engine: "Gemini 4 Hydrogen + AST/IR Analyzer",
          ai_summary: geminiEnrichment.summary ?? null,
          recommendations: mergedRecs,
        });
        return;
      }

      res.json(ruleResult);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Recommendation failed" });
    }
  });

  // Optimize endpoint: Applies selected passes, transforms AST & IR, persists history
  app.post("/api/optimize", async (req: Request, res: Response) => {
    try {
      const {
        code,
        language = "c",
        program_name = "program.c",
        passes,
        save = true,
      } = req.body as {
        code?: string;
        language?: string;
        program_name?: string;
        passes?: string[];
        save?: boolean;
      };
      if (typeof code !== "string") {
        res.status(400).json({ error: "Field 'code' must be a string." });
        return;
      }
      const result = await runPythonBackend("optimize", {
        code,
        language,
        program_name,
        passes,
        save,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Optimization failed" });
    }
  });

  // Benchmark endpoint: Sandboxed gcc compile & isolated rlimit execution comparison
  app.post("/api/benchmark", async (req: Request, res: Response) => {
    try {
      const {
        original_code,
        optimized_code,
        runs = 5,
        compiler_flag = "-O0",
        program_name = "benchmark.c",
        applied_passes = [],
        recommendations = [],
        original_ir_text = "",
        optimized_ir_text = "",
        save = true,
      } = req.body as Record<string, unknown>;

      if (typeof original_code !== "string" || typeof optimized_code !== "string") {
        res.status(400).json({ error: "Fields 'original_code' and 'optimized_code' are required." });
        return;
      }

      const result = await runPythonBackend("benchmark", {
        original_code,
        optimized_code,
        runs,
        compiler_flag,
        program_name,
        applied_passes,
        recommendations,
        original_ir_text,
        optimized_ir_text,
        save,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Benchmark failed" });
    }
  });

  // Real OS Linux /proc monitor snapshot
  app.get("/api/monitor", async (_req: Request, res: Response) => {
    try {
      const snapshot = await runPythonBackend("monitor");
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Monitor read failed" });
    }
  });

  // Dashboard Overview summary
  app.get("/api/overview", async (req: Request, res: Response) => {
    try {
      const includeDemo = req.query.include_demo !== "false";
      const data = await runPythonBackend("overview", { include_demo: includeDemo });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Overview fetch failed" });
    }
  });

  // History endpoints
  app.get("/api/history", async (req: Request, res: Response) => {
    try {
      const includeDemo = req.query.include_demo !== "false";
      const data = await runPythonBackend("history_list", { include_demo: includeDemo });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "History list failed" });
    }
  });

  app.get("/api/history/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "Invalid history ID." });
        return;
      }
      const data = await runPythonBackend<{ item?: unknown; error?: string }>("history_get", { id });
      if (data.error) {
        res.status(404).json(data);
        return;
      }
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "History fetch failed" });
    }
  });

  app.delete("/api/history/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "Invalid history ID." });
        return;
      }
      const data = await runPythonBackend("history_delete", { id });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Delete failed" });
    }
  });

  app.post("/api/history/clear", async (_req: Request, res: Response) => {
    try {
      const data = await runPythonBackend("history_clear");
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Clear failed" });
    }
  });

  // Explicitly labeled Demonstration Mode loader
  app.post("/api/demo/load", async (_req: Request, res: Response) => {
    try {
      const data = await runPythonBackend("load_demo");
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load demo data" });
    }
  });

  // Report generation endpoint (JSON or CSV)
  app.get("/api/reports/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const format = String(req.query.format || "json").toLowerCase();
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "Invalid report ID." });
        return;
      }
      const data = await runPythonBackend<{
        report?: Record<string, unknown>;
        csv?: string;
        filename?: string;
        error?: string;
      }>("report", { id, format });

      if (data.error) {
        res.status(404).json(data);
        return;
      }

      if (format === "csv" && data.csv) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${data.filename || `optiforge_report_${id}.csv`}"`);
        res.send(data.csv);
        return;
      }

      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Report generation failed" });
    }
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, "dist");
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get("*", (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OptiForge-OS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server startup error:", err);
  process.exit(1);
});
