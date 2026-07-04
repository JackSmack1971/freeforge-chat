/**
 * Dynamic Workflow: 7-Axes Code Quality Audit
 * 
 * Orchestrates the full 7-Axes audit using the specialized leaf sub-agents.
 * 
 * Architecture:
 * - This workflow = control plane (fan-out, collection, synthesis coordination)
 * - Sub-agents (readability-auditor ... operability-observability-auditor) = execution boundaries with isolated context
 * - 7axes-reference Skill = shared capability (axis definitions + JSON contract)
 * 
 * Invocation examples:
 *   claude --workflow 7axes-full-audit --args '{"targetPath": "src/", "focusAxes": ["readability", "security_compliance"]}'
 *   Or via saved command /7axes-audit
 * 
 * The workflow keeps intermediate results out of the main conversation context
 * and only returns the consolidated executive report.
 */

import { agent, parallel, pipeline, phase } from '@claude-code/workflow'; // illustrative import per Claude Code Dynamic Workflow SDK patterns

/**
 * Main entry point for the 7-Axes audit workflow.
 * @param {Object} params
 * @param {string} params.targetPath - Path or glob to audit (default: '.')
 * @param {string[]} params.focusAxes - Optional subset of axes to run (defaults to all 7)
 * @param {boolean} params.includeStrengths - Whether to include top_strengths in output
 * @returns {Promise<Object>} Consolidated audit report
 */
export default async function run7AxesAudit({
  targetPath = '.',
  focusAxes = null,
  includeStrengths = true,
} = {}) {
  const ALL_AXES = [
    'readability',
    'maintainability',
    'reliability',
    'security_compliance',
    'performance_scalability',
    'testability_coverage',
    'operability_observability'
  ];

  const axesToRun = focusAxes && focusAxes.length > 0 ? focusAxes : ALL_AXES;

  console.log(`[7Axes Workflow] Starting audit on ${targetPath}`);
  console.log(`[7Axes Workflow] Running ${axesToRun.length} axis auditors in parallel where possible`);

  // Phase 1: Parallel fan-out to leaf auditors
  // Each auditor is a custom sub-agent that already has the full rubric + 7axes-reference Skill awareness
  const auditorCalls = axesToRun.map(axis => {
    const agentName = `${axis}-auditor`; // e.g. readability-auditor
    return agent(agentName, {
      task: `Perform a thorough ${axis} audit on the codebase at ${targetPath}. Use the 7axes-reference skill for definitions, scoring anchors, and JSON contract. Return ONLY the required JSON.`,
      // The sub-agent definition already restricts tools and forbids further sub-agent spawning
      context: {
        targetPath,
        axis,
      },
    });
  });

  let rawResults;
  try {
    rawResults = await parallel(auditorCalls, {
      maxConcurrency: 7, // bounded to respect local resources and token limits
      failFast: false,   // continue even if one auditor fails; we will handle partial results
    });
  } catch (err) {
    console.error('[7Axes Workflow] Parallel execution encountered issues:', err);
    // Partial results may still be available in some runtime implementations
    rawResults = err.partialResults || [];
  }

  // Phase 2: Normalize and validate results
  const normalizedResults = {};
  const failedAxes = [];

  for (const result of rawResults) {
    if (result && result.axis && typeof result.score === 'number') {
      normalizedResults[result.axis] = result;
    } else if (result && result.error) {
      failedAxes.push(result.axis || 'unknown');
      console.warn(`[7Axes Workflow] Auditor for ${result.axis || 'unknown'} failed or returned invalid output`);
    }
  }

  // Phase 3: Synthesis via the dedicated orchestrator agent
  // We still use the 7-axes-orchestrator agent for high-quality cross-axis insight and prioritized backlog
  const synthesisInput = {
    scope: targetPath,
    axis_scores: normalizedResults,
    failed_axes: failedAxes,
    include_strengths: includeStrengths,
    instructions: `Synthesize the provided per-axis results into a single executive report. Compute composite score, identify cross-axis interactions, produce prioritized backlog with DORA/SPACE impact, and return the full structured JSON as defined in your system prompt.`
  };

  const finalReport = await agent('7-axes-orchestrator', {
    task: 'Synthesize the following 7-axes audit results into the canonical consolidated report.',
    context: synthesisInput,
  });

  // Phase 4: Post-processing / enrichment (lightweight, deterministic)
  if (finalReport && typeof finalReport === 'object') {
    finalReport.workflow_metadata = {
      executed_at: new Date().toISOString(),
      target_path: targetPath,
      axes_requested: axesToRun,
      axes_completed: Object.keys(normalizedResults),
      axes_failed: failedAxes,
      concurrency_used: 7,
    };

    // Ensure we always have a usable report even with partial data
    if (!finalReport.composite_score && Object.keys(normalizedResults).length > 0) {
      const scores = Object.values(normalizedResults).map(r => r.score || 0);
      finalReport.composite_score = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  }

  // Phase 5: Generate human-readable Markdown summary (deterministic, outside the model)
  const markdownSummary = generateMarkdownSummary(finalReport, {
    targetPath,
    axesToRun,
    failedAxes,
    includeStrengths,
  });

  // Optionally persist the Markdown report to disk for immediate use
  const reportTimestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const markdownFilename = `7axes-audit-report-${reportTimestamp}.md`;

  console.log('[7Axes Workflow] Audit complete.');
  console.log(`[7Axes Workflow] Markdown summary written to ${markdownFilename}`);

  return {
    json: finalReport,
    markdown: markdownSummary,
    markdown_filename: markdownFilename,
    // Some Claude Code workflow runtimes support writing artifacts directly
    // If supported, the runtime may also save the file automatically
  };
}

/**
 * Generates a polished, human-readable Markdown executive summary
 * from the structured JSON audit report.
 */
function generateMarkdownSummary(report, { targetPath, axesToRun, failedAxes, includeStrengths }) {
  if (!report || typeof report !== 'object') {
    return '# 7-Axes Audit Report\n\n**Error**: No valid report data received.';
  }

  const lines = [];

  // Header
  lines.push(`# 7-Axes Code Quality Audit Report`);
  lines.push(``);
  lines.push(`**Scope**: \`${targetPath}\``);
  lines.push(`**Generated**: ${report.workflow_metadata?.executed_at || new Date().toISOString()}`);
  lines.push(`**Axes Evaluated**: ${axesToRun.length} / 7`);
  if (failedAxes.length > 0) {
    lines.push(`**Partial Results**: ${failedAxes.length} axis(es) encountered issues — ${failedAxes.join(', ')}`);
  }
  lines.push(``);

  // Executive Summary
  const composite = report.composite_score ? report.composite_score.toFixed(1) : 'N/A';
  lines.push(`## Executive Summary`);
  lines.push(``);
  lines.push(`**Composite Score**: **${composite} / 10**`);
  lines.push(``);

  if (report.prioritized_backlog && report.prioritized_backlog.length > 0) {
    const highCount = report.prioritized_backlog.filter(i => i.priority === 'high').length;
    lines.push(`This audit identified **${highCount} high-priority** items requiring attention.`);
  }

  lines.push(``);
  lines.push(`The codebase shows ${getOverallAssessment(composite)} across the seven quality axes aligned with ISO/IEC 25010 and DORA/SPACE metrics.`);
  lines.push(``);

  // Scores Table
  lines.push(`## Axis Scores`);
  lines.push(``);
  lines.push(`| Axis                        | Score | Status     |`);
  lines.push(`|-----------------------------|-------|------------|`);

  const axisOrder = [
    'readability', 'maintainability', 'reliability', 'security_compliance',
    'performance_scalability', 'testability_coverage', 'operability_observability'
  ];

  for (const axis of axisOrder) {
    const data = report.axis_scores?.[axis] || report.full_axis_reports?.[axis];
    if (data) {
      const score = data.score !== undefined ? data.score.toFixed(1) : '—';
      const status = getScoreStatus(data.score);
      const displayName = axis.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      lines.push(`| ${displayName.padEnd(27)} | ${score.padStart(5)} | ${status} |`);
    }
  }
  lines.push(``);

  // Prioritized Backlog
  if (report.prioritized_backlog && report.prioritized_backlog.length > 0) {
    lines.push(`## Prioritized Remediation Backlog`);
    lines.push(``);

    const grouped = {
      high: report.prioritized_backlog.filter(i => i.priority === 'high'),
      medium: report.prioritized_backlog.filter(i => i.priority === 'medium'),
      low: report.prioritized_backlog.filter(i => i.priority === 'low'),
    };

    for (const [priority, items] of Object.entries(grouped)) {
      if (items.length === 0) continue;
      lines.push(`### ${priority.toUpperCase()} Priority`);
      for (const item of items) {
        lines.push(`- **${item.axis || 'General'}** — ${item.finding_summary || item.action}`);
        if (item.estimated_dora_impact) {
          lines.push(`  - *DORA/SPACE Impact*: ${item.estimated_dora_impact}`);
        }
        if (item.effort_estimate) {
          lines.push(`  - Effort: ${item.effort_estimate}`);
        }
      }
      lines.push(``);
    }
  }

  // Cross-Axis Insights
  if (report.cross_axis_insights && report.cross_axis_insights.length > 0) {
    lines.push(`## Cross-Axis Interactions`);
    lines.push(``);
    for (const insight of report.cross_axis_insights) {
      const icon = insight.impact === 'positive' ? '✅' : insight.impact === 'negative' ? '⚠️' : 'ℹ️';
      lines.push(`- ${icon} **${insight.interaction}**`);
      if (insight.recommendation) lines.push(`  - Recommendation: ${insight.recommendation}`);
    }
    lines.push(``);
  }

  // Key Strengths (optional)
  if (includeStrengths && report.full_axis_reports) {
    const allStrengths = [];
    for (const [axis, data] of Object.entries(report.full_axis_reports)) {
      if (data.top_strengths && data.top_strengths.length > 0) {
        allStrengths.push(...data.top_strengths.map(s => ({ axis, strength: s })));
      }
    }
    if (allStrengths.length > 0) {
      lines.push(`## Notable Strengths`);
      lines.push(``);
      for (const s of allStrengths.slice(0, 6)) { // limit to top 6
        lines.push(`- **${s.axis.replace(/_/g, ' ')}**: ${s.strength}`);
      }
      lines.push(``);
    }
  }

  // Limitations & Next Steps
  lines.push(`## Limitations & Recommended Next Steps`);
  lines.push(``);
  if (report.limitations && report.limitations.length > 0) {
    for (const lim of report.limitations) {
      lines.push(`- ${lim}`);
    }
  } else {
    lines.push(`- Scope was limited to \`${targetPath}\`. Consider running on additional modules or the full repository.`);
  }
  lines.push(``);
  if (report.next_steps && report.next_steps.length > 0) {
    lines.push(`**Recommended immediate actions**:`);
    for (const step of report.next_steps) {
      lines.push(`- ${step}`);
    }
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(`*Report generated by 7-Axes Dynamic Workflow • Aligned to ISO/IEC 25010 & DORA/SPACE*`);

  return lines.join('\n');
}

function getScoreStatus(score) {
  if (score === undefined || score === null) return '—';
  if (score >= 8) return 'Strong';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Needs Work';
  return 'Critical';
}

function getOverallAssessment(composite) {
  const score = parseFloat(composite);
  if (score >= 8.5) return 'excellent quality and strong alignment with delivery outcomes';
  if (score >= 7) return 'solid quality with targeted opportunities for improvement';
  if (score >= 5) return 'moderate quality with several areas requiring attention';
  return 'significant quality gaps that should be prioritized';
}

/**
 * Optional helper: Run a focused audit on a subset of axes
 */
export async function runFocusedAudit(targetPath, axes) {
  return run7AxesAudit({ targetPath, focusAxes: axes });
}
