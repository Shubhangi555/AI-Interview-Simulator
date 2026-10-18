import { useMemo, useState } from 'react';
import { findPrevious, history, useHistory } from '../state/history';
import { ReportView, scoreBand } from './ReportView';
import { ScoreTrend } from './ScoreTrend';

const READINESS_SHORT = { ready: 'Ready', 'almost-ready': 'Almost', 'needs-practice': 'Practise' } as const;
const ALL = '__all__';
const TYPE_LABEL = { behavioral: 'Behavioral', technical: 'Technical', 'system-design': 'System design', mixed: 'Mixed' } as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function HistoryScreen({ onNew }: { onNew: () => void }) {
  const entries = useHistory(); // newest first
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedRole, setRole] = useState(ALL);

  const roles = useMemo(() => [...new Set(entries.map((e) => e.config.role.trim()))].sort(), [entries]);
  const role = roles.includes(selectedRole) ? selectedRole : ALL; // fall back if that role's entries were deleted
  const filtered = role === ALL ? entries : entries.filter((e) => e.config.role.trim() === role);
  const opened = openId ? entries.find((e) => e.id === openId) : undefined;

  const remove = (id: string) => {
    if (!window.confirm('Delete this interview from your history? This cannot be undone.')) return;
    history.remove(id);
    if (openId === id) setOpenId(null);
  };

  if (opened) {
    return (
      <>
        <button className="btn link back no-print" onClick={() => setOpenId(null)}>← All interviews</button>
        <ReportView
          config={opened.config}
          report={opened.report}
          items={opened.items}
          completedAt={opened.completedAt}
          previous={findPrevious(entries, opened)}
          actions={
            <>
              <button className="btn primary" onClick={onNew}>Start a new interview</button>
              <button className="btn quiet danger" onClick={() => remove(opened.id)}>Delete</button>
            </>
          }
        />
      </>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="center-state">
        <p className="serif-lg">No interviews yet.</p>
        <p className="hint">Finished interviews are saved in this browser so you can track your progress.</p>
        <button className="btn primary" onClick={onNew}>Start your first interview</button>
      </section>
    );
  }

  const scores = filtered.map((e) => e.report.overallScore);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const best = scores.length ? Math.round(Math.max(...scores)) : 0;

  return (
    <section className="history">
      <header className="history-head">
        <div>
          <h1>Your interviews</h1>
          <p className="hint">Saved in this browser only. Audio recordings aren’t kept.</p>
        </div>
        {roles.length > 1 && (
          <label className="field inline">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value={ALL}>All roles</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
      </header>

      <dl className="stats">
        <div><dt>Interviews</dt><dd>{filtered.length}</dd></div>
        <div><dt>Average</dt><dd>{avg}</dd></div>
        <div><dt>Best</dt><dd>{best}</dd></div>
      </dl>

      <ScoreTrend entries={[...filtered].reverse().slice(-12)} onOpen={setOpenId} />

      <section>
        <h2 className="sr-only">All interviews</h2>
        <ul className="history-list">
          {filtered.map((e) => {
            const answered = e.items.filter((i) => i.evaluation).length;
            return (
              <li key={e.id}>
                <button className="history-row" onClick={() => setOpenId(e.id)}>
                  <span className={`history-score ${scoreBand(e.report.overallScore / 10)}`}>{Math.round(e.report.overallScore)}</span>
                  <span className="history-main">
                    <strong>{e.config.role}</strong>
                    <span className="hint">
                      {cap(e.config.seniority)} · {TYPE_LABEL[e.config.type]} · {answered}/{e.items.length} answered ·{' '}
                      {READINESS_SHORT[e.report.readiness]}
                    </span>
                  </span>
                  <time className="hint" dateTime={e.completedAt}>
                    {new Date(e.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </time>
                </button>
                <button className="btn icon" aria-label={`Delete ${e.config.role} interview`} title="Delete" onClick={() => remove(e.id)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="actions">
        <button className="btn primary" onClick={onNew}>Start a new interview</button>
        <button
          className="btn link"
          onClick={() => window.confirm('Delete all saved interviews? This cannot be undone.') && history.clear()}
        >
          Clear history
        </button>
      </div>
    </section>
  );
}
