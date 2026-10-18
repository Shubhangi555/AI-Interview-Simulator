import type { InterviewConfig, InterviewReport } from '../../shared/schemas';
import type { HistoryItem } from '../state/history';
import { formatTime } from './speechMetrics';

const READINESS = { ready: 'Ready to interview', 'almost-ready': 'Almost ready', 'needs-practice': 'Needs more practice' } as const;
const TYPE_LABEL = { behavioral: 'Behavioral', technical: 'Technical', 'system-design': 'System design', mixed: 'Mixed' } as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
// Keep model/user text from breaking list or table structure
const oneLine = (s: string) => s.replace(/\s*\n+\s*/g, ' ').trim();
const cell = (s: string) => oneLine(s).replace(/\|/g, '\\|');

interface ExportInput {
  config: InterviewConfig;
  report: InterviewReport;
  items: HistoryItem[];
  completedAt?: string;
}

/** Human-readable report as Markdown (opens well in VS Code, GitHub, Notion, Obsidian). */
export function reportToMarkdown({ config, report, items, completedAt }: ExportInput): string {
  const date = new Date(completedAt ?? Date.now()).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const answered = items.filter((i) => i.evaluation).length;
  const out: string[] = [];

  out.push(`# Interview report: ${cap(config.seniority)} ${config.role}`, '');
  out.push(`**Overall score:** ${Math.round(report.overallScore)}/100 · **${READINESS[report.readiness]}**  `);
  out.push(`${TYPE_LABEL[config.type]} interview · ${answered}/${items.length} answered · ${date}  `);
  if (config.focusAreas) out.push(`Focus areas: ${oneLine(config.focusAreas)}`);
  out.push('', report.summary, '');

  out.push('## By competency', '', '| Competency | Score |', '|---|---|');
  for (const c of report.competencyScores) out.push(`| ${cell(c.competency)} | ${c.score.toFixed(1)}/10 |`);
  out.push('');

  out.push('## Strengths', '', ...report.topStrengths.map((s) => `- ${oneLine(s)}`), '');
  out.push('## Work on first', '', ...report.priorityImprovements.map((s) => `- ${oneLine(s)}`), '');
  out.push('## How you sounded', '', `- **Pace:** ${oneLine(report.communication.paceAssessment)}`, `- **Filler words:** ${oneLine(report.communication.fillerWordAssessment)}`, '');
  out.push('## Practice plan', '', ...report.practicePlan.map((p, i) => `${i + 1}. **${oneLine(p.focus)}.** ${oneLine(p.action)}`), '');

  out.push('## Your answers', '');
  items.forEach((item, i) => {
    const ev = item.evaluation;
    out.push(`### ${i + 1}. ${oneLine(item.question.text)}`, '');
    out.push(`*${cap(item.question.category)} · ${item.question.competency}* · **${ev ? `${ev.score.toFixed(1)}/10` : 'Skipped'}**`, '');
    if (!item.transcript) {
      out.push('_No answer recorded._', '');
      return;
    }
    // Blockquote each line so multi-paragraph answers stay inside the quote
    out.push(...item.transcript.trim().split(/\n/).map((l) => `> ${l}`), '');
    if (item.durationSec > 0) out.push(metricsLine(item), '');
    if (ev) {
      const r = ev.rubric;
      out.push(`Relevance ${r.relevance} · Structure ${r.structure} · Depth ${r.depth} · Communication ${r.communication}`, '');
      if (ev.strengths.length) out.push('**What worked**', '', ...ev.strengths.map((s) => `- ${oneLine(s)}`), '');
      if (ev.improvements.length) out.push('**To improve**', '', ...ev.improvements.map((s) => `- ${oneLine(s)}`), '');
      if (ev.idealAnswerOutline.length) out.push('**A strong answer covers**', '', ...ev.idealAnswerOutline.map((s, j) => `${j + 1}. ${oneLine(s)}`), '');
      // Answered follow-ups get their own block; otherwise just mention the likely follow-up
      if (ev.followUpQuestion && !item.followUp) out.push(`*Likely follow-up:* ${oneLine(ev.followUpQuestion)}`, '');
    }
    const fu = item.followUp;
    if (fu) {
      out.push(`#### ↳ Follow-up: ${oneLine(fu.question.text)}`, '', `**${fu.evaluation.score.toFixed(1)}/10**`, '');
      out.push(...fu.transcript.trim().split(/\n/).map((l) => `> ${l}`), '');
      if (fu.durationSec > 0) out.push(metricsLine(fu), '');
      if (fu.evaluation.strengths.length) out.push('**What worked**', '', ...fu.evaluation.strengths.map((s) => `- ${oneLine(s)}`), '');
      if (fu.evaluation.improvements.length) out.push('**To improve**', '', ...fu.evaluation.improvements.map((s) => `- ${oneLine(s)}`), '');
    }
  });

  return out.join('\n');
}

/** "1:15 · 140 words · 132 wpm · 3 filler words". Pace is omitted when typed or implausible (older saved data). */
export function metricsLine(item: Pick<HistoryItem, 'durationSec' | 'metrics'>) {
  const m = item.metrics;
  const parts = [formatTime(item.durationSec), `${m.wordCount} words`];
  if (m.wordsPerMinute > 0 && m.wordsPerMinute <= 300) parts.push(`${m.wordsPerMinute} wpm`, `${m.fillerWordCount} filler words`);
  return parts.join(' · ');
}

/** Raw data export, for backup or analysis. Audio is never included. */
export const reportToJson = ({ config, report, items, completedAt }: ExportInput) =>
  JSON.stringify({ generatedAt: completedAt ?? new Date().toISOString(), config, report, answers: items }, null, 2);

export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const reportFilename = (config: InterviewConfig, completedAt: string | undefined, ext: string) => {
  const day = (completedAt ?? new Date().toISOString()).slice(0, 10);
  return `interview-report-${config.role.replace(/\W+/g, '-').toLowerCase()}-${day}.${ext}`;
};
