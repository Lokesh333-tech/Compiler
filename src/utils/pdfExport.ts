import { jsPDF } from "jspdf";
import type { ReportPayload } from "../types/compiler";

export function downloadReportPDF(report: ReportPayload): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxLineWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 52;
    }
  };

  const addHeading = (title: string) => {
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(14, 116, 144);
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  };

  const addBody = (text: string, mono = false) => {
    doc.setFont(mono ? "courier" : "helvetica", "normal");
    doc.setFontSize(mono ? 8.5 : 9.5);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(text || "(none)", maxLineWidth) as string[];
    for (const line of lines) {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += mono ? 11.5 : 13.5;
    }
    y += 6;
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text("OptiForge-OS Optimization Report", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  const dateStr = new Date(report.generated_at * 1000).toLocaleString();
  doc.text(
    `Report #${report.report_id}  |  Program: ${report.program_name} (${report.language})  |  Generated: ${dateStr}`,
    margin,
    y
  );
  y += 22;

  // 1. Program Information
  addHeading("1. Program & Session Overview");
  addBody(
    `Project: ${report.project_title}\nProgram Name: ${report.program_name}\nLanguage: ${report.language}\nMode: ${
      report.is_demo ? "Demonstration Sample" : "User Compilation Session"
    }`
  );

  // 2. Applied Optimizations
  addHeading("2. Optimization Techniques Applied");
  addBody(
    report.applied_optimizations.length > 0
      ? report.applied_optimizations.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "No optimization transformations were applied."
  );

  // 3. AI Recommendations
  addHeading("3. AI Optimization Recommendations");
  if (report.ai_recommendations.length > 0) {
    const recText = report.ai_recommendations
      .map(
        (r) =>
          `- ${r.pass_name} (Confidence: ${Math.round(r.confidence * 100)}%, Priority: ${r.priority}): ${r.reason}`
      )
      .join("\n");
    addBody(recText);
  } else {
    addBody("No additional optimization recommendations generated.");
  }

  // 4. Performance Measurements & Graphical Bar Comparison
  addHeading("4. Original vs Optimized Performance Measurements");
  if (report.original_performance && report.optimized_performance && report.performance_deltas) {
    const orig = report.original_performance;
    const opt = report.optimized_performance;
    const d = report.performance_deltas;
    const tableLines = [
      `Execution Time:   Original ${orig.execution_time_ms} ms  |  Optimized ${opt.execution_time_ms} ms  |  Delta ${d.execution_time_improvement_pct}%`,
      `CPU Utilization:  Original ${orig.cpu_utilization_percent}%   |  Optimized ${opt.cpu_utilization_percent}%   |  Delta ${d.cpu_improvement_pct}%`,
      `Peak Memory RSS:  Original ${orig.memory_rss_kb} KB   |  Optimized ${opt.memory_rss_kb} KB   |  Delta ${d.memory_improvement_pct}%`,
      `Binary Size:      Original ${orig.binary_size_bytes} B   |  Optimized ${opt.binary_size_bytes} B   |  Delta ${d.binary_size_improvement_pct}%`,
      `Page Faults:      Original ${orig.minor_page_faults}      |  Optimized ${opt.minor_page_faults}`,
    ].join("\n");
    addBody(tableLines, true);

    // Simple visual bar comparison in PDF
    ensureSpace(64);
    const barMaxW = 240;
    const maxExec = Math.max(orig.execution_time_ms, opt.execution_time_ms, 0.001);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text("Execution Time Comparison (ms)", margin, y);
    y += 10;

    doc.setFillColor(100, 116, 139);
    doc.rect(margin, y, Math.max(4, (orig.execution_time_ms / maxExec) * barMaxW), 10, "F");
    doc.setFont("helvetica", "normal");
    doc.text(`Original: ${orig.execution_time_ms} ms`, margin + barMaxW + 10, y + 8);
    y += 16;

    doc.setFillColor(6, 182, 212);
    doc.rect(margin, y, Math.max(4, (opt.execution_time_ms / maxExec) * barMaxW), 10, "F");
    doc.text(`Optimized: ${opt.execution_time_ms} ms`, margin + barMaxW + 10, y + 8);
    y += 22;
  } else {
    addBody("Benchmark execution measurements have not been recorded for this session.");
  }

  // 5. Original Source Code
  addHeading("5. Original Source Code");
  addBody(report.original_source_code, true);

  // 6. Optimized Source Code
  addHeading("6. Optimized Source Code");
  addBody(report.optimized_source_code, true);

  // 7. Intermediate Representation
  addHeading("7. Three-Address Code (Original vs Optimized IR)");
  addBody("--- Original IR ---\n" + report.original_ir + "\n\n--- Optimized IR ---\n" + report.optimized_ir, true);

  // 8. Final Analysis
  addHeading("8. Final Optimization Analysis");
  addBody(report.final_analysis);

  doc.save(`optiforge_report_${report.report_id}.pdf`);
}
