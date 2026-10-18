import { QuestionSchema, type AnswerEvaluation, type Question, type ReportItem } from '../../shared/schemas';

/** Share of a question's report score that comes from its follow-up, when one was answered. */
export const FOLLOW_UP_WEIGHT = 0.25;

const FOLLOW_UP_SUFFIX = '-f';
export const followUpId = (parentId: string) => `${parentId}${FOLLOW_UP_SUFFIX}`;

/**
 * Turns the evaluator's free-text `followUpQuestion` into a full Question, so it can reuse the
 * existing /evaluate endpoint unchanged. Validated with the shared schema; returns null if unusable.
 */
export function buildFollowUpQuestion(parent: Question, evaluation: AnswerEvaluation): Question | null {
  const text = evaluation.followUpQuestion?.trim();
  if (!text || text.length < 5) return null;

  // A strong follow-up answer goes deeper on what the original strong answer covers
  const points = (evaluation.idealAnswerOutline.length ? evaluation.idealAnswerOutline : parent.expectedPoints).slice(0, 4);
  const parsed = QuestionSchema.safeParse({
    id: followUpId(parent.id),
    text,
    category: parent.category,
    competency: parent.competency,
    expectedPoints: points.length ? points : parent.expectedPoints,
    // Follow-ups are shorter than the main question
    timeLimitSec: Math.min(180, Math.max(60, Math.round(parent.timeLimitSec * 0.6))),
  });
  return parsed.success ? parsed.data : null;
}

/**
 * The question as sent for scoring: the evaluator only sees one question at a time, so give it the
 * original question as context. Only AI-generated text is added here, never the candidate's answer.
 */
export const followUpForScoring = (followUp: Question, parent: Question): Question => ({
  ...followUp,
  text: `Follow-up to the earlier question "${parent.text}": ${followUp.text}`,
});

/**
 * The report endpoint accepts at most 10 items, so a follow-up is folded into its parent item
 * instead of being sent separately: blended score, plus its key feedback prefixed "Follow-up".
 */
export function mergeFollowUp(item: ReportItem, followUpEval: AnswerEvaluation | null | undefined): ReportItem {
  if (!item.evaluation || !followUpEval) return item;
  const main = item.evaluation;
  const blend = (a: number, b: number) => Math.round((a * (1 - FOLLOW_UP_WEIGHT) + b * FOLLOW_UP_WEIGHT) * 10) / 10;
  const tag = (s: string) => `Follow-up: ${s}`;
  return {
    ...item,
    evaluation: {
      ...main,
      score: blend(main.score, followUpEval.score),
      rubric: {
        relevance: blend(main.rubric.relevance, followUpEval.rubric.relevance),
        structure: blend(main.rubric.structure, followUpEval.rubric.structure),
        depth: blend(main.rubric.depth, followUpEval.rubric.depth),
        communication: blend(main.rubric.communication, followUpEval.rubric.communication),
      },
      // Schema caps these lists at 5; keep the main answer's points first
      strengths: [...main.strengths.slice(0, 4), ...followUpEval.strengths.slice(0, 1).map(tag)].slice(0, 5),
      improvements: [...main.improvements.slice(0, 4), ...followUpEval.improvements.slice(0, 1).map(tag)].slice(0, 5),
    },
  };
}
