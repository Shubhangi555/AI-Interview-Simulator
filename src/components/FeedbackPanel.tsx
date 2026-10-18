import type { AnswerEvaluation } from '../../shared/schemas';
import { scoreBand } from './ReportView';

const RUBRIC: Array<[keyof AnswerEvaluation['rubric'], string]> = [
  ['relevance', 'Relevance'],
  ['structure', 'Structure'],
  ['depth', 'Depth'],
  ['communication', 'Communication'],
];

interface Props {
  evaluation: AnswerEvaluation;
  /** Hide the "Likely follow-up" line when the follow-up is offered as an answerable step instead. */
  hideFollowUp?: boolean;
  /** Smaller variant for follow-up answers: score, short lists, no rubric bars. */
  compact?: boolean;
}

export function FeedbackPanel({ evaluation, hideFollowUp, compact }: Props) {
  return (
    <section className={`feedback ${compact ? 'compact' : ''}`} aria-live="polite">
      <div className={`feedback-score ${scoreBand(evaluation.score)}`}>
        <strong>{evaluation.score.toFixed(1)}</strong>
        <span>out of 10</span>
      </div>

      {!compact && (
        <dl className="rubric">
          {RUBRIC.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                <span className="bar"><span style={{ width: `${evaluation.rubric[key] * 10}%` }} /></span>
                {evaluation.rubric[key]}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="feedback-cols">
        {evaluation.strengths.length > 0 && (
          <div>
            <h3>What worked</h3>
            <ul>{evaluation.strengths.slice(0, compact ? 2 : undefined).map((s, k) => <li key={k}>{s}</li>)}</ul>
          </div>
        )}
        {evaluation.improvements.length > 0 && (
          <div>
            <h3>To improve</h3>
            <ul>{evaluation.improvements.slice(0, compact ? 2 : undefined).map((s, k) => <li key={k}>{s}</li>)}</ul>
          </div>
        )}
      </div>

      {!compact && (
        <details>
          <summary>What a strong answer covers</summary>
          <ol>{evaluation.idealAnswerOutline.map((s, k) => <li key={k}>{s}</li>)}</ol>
        </details>
      )}
      {!hideFollowUp && !compact && evaluation.followUpQuestion && (
        <p className="followup">Likely follow-up: {evaluation.followUpQuestion}</p>
      )}
    </section>
  );
}
