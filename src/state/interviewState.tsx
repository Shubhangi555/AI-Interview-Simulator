import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import { z } from 'zod';
import {
  AnswerEvaluationSchema,
  InterviewConfigSchema,
  QuestionSchema,
  SpeechMetricsSchema,
  type AnswerEvaluation,
  type InterviewConfig,
  type InterviewReport,
  type Question,
  type SpeechMetrics,
} from '../../shared/schemas';
import { newId, readJson, removeKey, writeJson } from '../lib/storage';
import { FollowUpDataSchema, history, type FollowUpData } from './history';

const stripAudio = ({ audio: _audio, ...rest }: FollowUpRecord): FollowUpData => rest;

/**
 * Client/session state only. All AI data fetching lives in React Query (hooks/useInterviewApi),
 * results are committed here once a mutation succeeds.
 */
export type Phase = 'setup' | 'interviewing' | 'report';

export interface AnswerRecord {
  transcript: string;
  durationSec: number;
  metrics: SpeechMetrics;
  audio: Blob | null; // kept in memory only; never uploaded or persisted
  evaluation: AnswerEvaluation | null;
  skipped: boolean;
  followUp?: FollowUpRecord; // optional, so sessions saved before follow-ups existed still load
}

/** An answered follow-up. Only stored once scored; an unanswered follow-up is simply absent. */
export interface FollowUpRecord {
  question: Question;
  transcript: string;
  durationSec: number;
  metrics: SpeechMetrics;
  audio: Blob | null;
  evaluation: AnswerEvaluation;
}

export interface InterviewState {
  sessionId: string;
  phase: Phase;
  config: InterviewConfig | null;
  questions: Question[];
  currentIndex: number;
  answers: Record<string, AnswerRecord>;
  report: InterviewReport | null;
}

export type Action =
  | { type: 'QUESTIONS_READY'; config: InterviewConfig; questions: Question[] }
  | { type: 'RESUME_SESSION'; snapshot: SavedSession }
  | { type: 'ANSWER_EVALUATED'; questionId: string; record: AnswerRecord }
  | { type: 'FOLLOWUP_EVALUATED'; questionId: string; followUp: FollowUpRecord }
  | { type: 'QUESTION_SKIPPED'; questionId: string }
  | { type: 'NEXT_QUESTION' }
  | { type: 'REPORT_READY'; report: InterviewReport }
  | { type: 'RESTART' };

const initialState: InterviewState = {
  sessionId: '',
  phase: 'setup',
  config: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  report: null,
};

const EMPTY_METRICS: SpeechMetrics = { wordCount: 0, wordsPerMinute: 0, fillerWordCount: 0 };

function reducer(state: InterviewState, action: Action): InterviewState {
  switch (action.type) {
    case 'QUESTIONS_READY':
      return { ...initialState, sessionId: newId(), phase: 'interviewing', config: action.config, questions: action.questions };
    case 'RESUME_SESSION': {
      const s = action.snapshot;
      const answers: Record<string, AnswerRecord> = {};
      for (const [id, { followUp, ...a }] of Object.entries(s.answers)) {
        answers[id] = { ...a, audio: null, ...(followUp && { followUp: { ...followUp, audio: null } }) };
      }
      return { ...initialState, ...s, answers, phase: 'interviewing' };
    }
    case 'ANSWER_EVALUATED':
      return { ...state, answers: { ...state.answers, [action.questionId]: action.record } };
    case 'FOLLOWUP_EVALUATED': {
      const parent = state.answers[action.questionId];
      if (!parent?.evaluation) return state; // a follow-up only exists after its parent was scored
      return { ...state, answers: { ...state.answers, [action.questionId]: { ...parent, followUp: action.followUp } } };
    }
    case 'QUESTION_SKIPPED':
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionId]: { transcript: '', durationSec: 0, metrics: EMPTY_METRICS, audio: null, evaluation: null, skipped: true },
        },
      };
    case 'NEXT_QUESTION':
      return { ...state, currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1) };
    case 'REPORT_READY':
      return { ...state, phase: 'report', report: action.report };
    case 'RESTART':
      return initialState;
    default:
      return state;
  }
}

/* ---------------- In-progress session persistence ---------------- */
// Lets a refresh or accidental tab close resume mid-interview without re-spending AI quota.
const SESSION_KEY = 'session.v1';

const SavedSessionSchema = z.object({
  sessionId: z.string().min(1),
  config: InterviewConfigSchema,
  questions: z.array(QuestionSchema).min(1),
  currentIndex: z.number().int().nonnegative(),
  answers: z.record(
    z.object({
      transcript: z.string(),
      durationSec: z.number(),
      metrics: SpeechMetricsSchema,
      evaluation: AnswerEvaluationSchema.nullable(),
      skipped: z.boolean(),
      followUp: FollowUpDataSchema.optional(),
    }),
  ),
  savedAt: z.string(),
});
export type SavedSession = z.infer<typeof SavedSessionSchema>;

export function loadSavedSession(): SavedSession | null {
  const parsed = SavedSessionSchema.safeParse(readJson<unknown>(SESSION_KEY, null));
  if (!parsed.success) return null;
  const s = parsed.data;
  return s.currentIndex < s.questions.length ? s : null;
}

export const discardSavedSession = () => removeKey(SESSION_KEY);

function persist(state: InterviewState) {
  if (state.phase !== 'interviewing' || !state.config) return;
  const answers: SavedSession['answers'] = {};
  for (const [id, { audio: _audio, followUp, ...rest }] of Object.entries(state.answers)) {
    answers[id] = { ...rest, ...(followUp && { followUp: stripAudio(followUp) }) };
  }
  writeJson(SESSION_KEY, {
    sessionId: state.sessionId,
    config: state.config,
    questions: state.questions,
    currentIndex: state.currentIndex,
    answers,
    savedAt: new Date().toISOString(),
  } satisfies SavedSession);
}

/* ---------------- Context ---------------- */
const StateCtx = createContext<InterviewState | null>(null);
const DispatchCtx = createContext<Dispatch<Action> | null>(null);

export function InterviewProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Save progress while interviewing; clear it once the session ends either way
  useEffect(() => {
    if (state.phase === 'interviewing') persist(state);
    else if (state.phase === 'report') discardSavedSession();
  }, [state]);

  // Completed interview → history (upsert by id, so effect re-runs are harmless)
  useEffect(() => {
    if (state.phase !== 'report' || !state.report || !state.config) return;
    history.add({
      id: state.sessionId,
      completedAt: new Date().toISOString(),
      config: state.config,
      report: state.report,
      items: state.questions.map((q) => {
        const a = state.answers[q.id];
        return {
          question: q,
          transcript: a?.transcript ?? '',
          durationSec: a?.durationSec ?? 0,
          metrics: a?.metrics ?? EMPTY_METRICS,
          evaluation: a?.evaluation ?? null,
          skipped: !a?.evaluation,
          ...(a?.followUp && { followUp: stripAudio(a.followUp) }),
        };
      }),
    });
  }, [state.phase, state.report, state.config, state.sessionId, state.questions, state.answers]);

  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useInterviewState() {
  const ctx = useContext(StateCtx);
  if (!ctx) throw new Error('useInterviewState must be used inside InterviewProvider');
  return ctx;
}

export function useInterviewDispatch() {
  const ctx = useContext(DispatchCtx);
  if (!ctx) throw new Error('useInterviewDispatch must be used inside InterviewProvider');
  return ctx;
}
