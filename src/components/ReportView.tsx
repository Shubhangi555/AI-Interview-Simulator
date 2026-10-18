import type { ReactNode } from 'react';
import type { InterviewConfig, InterviewReport } from '../../shared/schemas';
import type { HistoryEntry, HistoryItem } from '../state/history';
import { downloadFile, metricsLine, reportFilename, reportToJson, reportToMarkdown } from '../utils/reportExport';

const READINESS = {
  ready: 'Ready to interview',
  'almost-ready': 'Almost ready',
  'needs-practice': 'Needs more practice',
} as const;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Props {
  config: InterviewConfig;
  report: InterviewReport;
  items: HistoryItem[];
  completedAt?: string;
  audioUrls?: Record<string, string>; // only available for the live session
  previous?: HistoryEntry;
  actions: ReactNode;
}

/** Presentational report, shared by the live report screen and past interviews in History. */
export function ReportView({ config, report, items, completedAt, audioUrls = {}, previous, actions }: Props) {
  const delta = previous ? Math.round(report.overallScore - previous.report.overallScore) : null;
  const answered = items.filter((i) => i.evaluation).length;

  // Text-only exports; audio is never included
  const exportInput = { config, report, items, completedAt };
  const downloadMarkdown = () =>
    downloadFile(reportToMarkdown(exportInput), reportFilename(config, completedAt, 'md'), 'text/markdown;charset=utf-8');
  const downloadJson = () => downloadFile(reportToJson(exportInput), reportFilename(config, completedAt, 'json'), 'application/json');

  return (
    <section className="report">
      <header className="report-head">
        <div className="overall" aria-label={`Overall score ${Math.round(report.overallScore)} out of 100`}>
          <strong>{Math.round(report.overallScore)}</strong>
          <span>/100</span>
        </div>
        <div>
          <p className={`readiness ${report.readiness}`}>{READINESS[report.readiness]}</p>
          <h1>
            {cap(config.seniority)} {config.role}
            <span className="report-meta">
              {' '}
              · {config.type === 'system-design' ? 'System design' : cap(config.type)} · {answered}/{items.length} answered
              {completedAt && <> · {new Date(completedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</>}
            </span>
          </h1>
          {delta !== null && (
            <p className={`delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}`}>
              <span aria-hidden="true">{delta > 0 ? '▲' : delta < 0 ? '▼' : '■'}</span>{' '}
              {delta === 0 ? 'Same as' : `${delta > 0 ? '+' : ''}${delta} vs`} your last {config.role} interview (
              {Math.round(previous!.report.overallScore)})
            </p>
          )}
          <p className="summary">{report.summary}</p>
        </div>
      </header>

      <div className="report-grid">
        <section className="card">
          <h2>By competency</h2>
          <dl className="rubric">
            {report.competencyScores.map((c, k) => (
              <div key={k}>
                <dt>{c.competency}</dt>
                <dd>
                  <span className="bar"><span style={{ width: `${c.score * 10}%` }} /></span>
                  {c.score.toFixed(1)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card">
          <h2>How you sounded</h2>
          <p>{report.communication.paceAssessment}</p>
          <p>{report.communication.fillerWordAssessment}</p>
        </section>

        <section className="card">
          <h2>Strengths</h2>
          <ul>{report.topStrengths.map((s, k) => <li key={k}>{s}</li>)}</ul>
        </section>

        <section className="card">
          <h2>Work on first</h2>
          <ul>{report.priorityImprovements.map((s, k) => <li key={k}>{s}</li>)}</ul>
        </section>
      </div>

      <section className="plan">
        <h2>Your practice plan</h2>
        <ol>
          {report.practicePlan.map((p, k) => (
            <li key={k}>
              <strong>{p.focus}.</strong> {p.action}
            </li>
          ))}
        </ol>
      </section>

      <section className="answers">
        <h2>Your answers</h2>
        {items.map((item, i) => {
          const q = item.question;
          const ev = item.evaluation;
          return (
            <details key={q.id}>
              <summary>
                <span className="q-num">{i + 1}</span>
                <span className="q-text">
                  {q.text}
                  {item.followUp && <span className="q-badge">+ follow-up</span>}
                </span>
                <span className={`q-score ${ev ? scoreBand(ev.score) : 'skipped'}`}>{ev ? ev.score.toFixed(1) : 'Skipped'}</span>
              </summary>
              {audioUrls[q.id] && <audio controls src={audioUrls[q.id]} className="playback" />}
              {item.transcript ? (
                <>
                  <p className="transcript">{item.transcript}</p>
                  {item.durationSec > 0 && (
                    <p className="hint">{metricsLine(item)}</p>
                  )}
                </>
              ) : (
                <p className="hint">No answer recorded.</p>
              )}
              {ev && ev.improvements.length > 0 && (
                <>
                  <h3 className="answers-sub">To improve</h3>
                  <ul>{ev.improvements.map((s, k) => <li key={k}>{s}</li>)}</ul>
                </>
              )}
              {ev && ev.idealAnswerOutline.length > 0 && (
                <>
                  <h3 className="answers-sub">A strong answer covers</h3>
                  <ol>{ev.idealAnswerOutline.map((s, k) => <li key={k}>{s}</li>)}</ol>
                </>
              )}
              {item.followUp && (
                <div className="answer-followup">
                  <p className="followup-kicker">
                    <span aria-hidden="true">↳</span> Follow-up ·{' '}
                    <span className={`q-score ${scoreBand(item.followUp.evaluation.score)}`}>
                      {item.followUp.evaluation.score.toFixed(1)}
                    </span>
                  </p>
                  <p className="answer-followup-q">{item.followUp.question.text}</p>
                  {audioUrls[item.followUp.question.id] && (
                    <audio controls src={audioUrls[item.followUp.question.id]} className="playback" />
                  )}
                  <p className="transcript">{item.followUp.transcript}</p>
                  {item.followUp.durationSec > 0 && <p className="hint">{metricsLine(item.followUp)}</p>}
                  {item.followUp.evaluation.improvements.length > 0 && (
                    <ul>{item.followUp.evaluation.improvements.map((s, k) => <li key={k}>{s}</li>)}</ul>
                  )}
                </div>
              )}
            </details>
          );
        })}
      </section>

      <div className="actions no-print">
        {actions}
        <button className="btn quiet" onClick={() => window.print()}>Print or save as PDF</button>
        <button className="btn quiet" onClick={downloadMarkdown}>Download report (.md)</button>
        <button className="btn link" onClick={downloadJson} title="Raw data for backup or analysis">Raw data (JSON)</button>
      </div>
    </section>
  );
}

/** Score bands drive a text-weight/colour cue; the number itself is always shown. */
export const scoreBand = (score10: number) => (score10 >= 7.5 ? 'good' : score10 >= 5 ? 'ok' : 'low');
