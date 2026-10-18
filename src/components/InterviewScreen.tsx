import { useEffect, useMemo, useRef, useState } from 'react';
import type { InterviewConfig, Question, ReportItem } from '../../shared/schemas';
import { errorMessage, useGenerateReport } from '../hooks/useInterviewApi';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import {
  discardSavedSession,
  useInterviewDispatch,
  useInterviewState,
  type AnswerRecord,
  type FollowUpRecord,
} from '../state/interviewState';
import { usePreferences } from '../state/preferences';
import { buildFollowUpQuestion, FOLLOW_UP_WEIGHT, followUpForScoring, mergeFollowUp } from '../utils/followUp';
import { AnswerBooth } from './AnswerBooth';
import { FeedbackPanel } from './FeedbackPanel';

export function InterviewScreen() {
  const { config, questions, currentIndex, answers } = useInterviewState();
  const dispatch = useInterviewDispatch();
  const report = useGenerateReport();
  const { autoRead, setAutoRead, speechLang } = usePreferences();
  const endDialog = useRef<HTMLDialogElement>(null);

  if (!config || questions.length === 0) return null;
  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const answeredCount = questions.filter((q) => answers[q.id]?.evaluation).length;

  const finish = () => {
    endDialog.current?.close();
    // Read latest answers at call time; unanswered questions count as skipped.
    // Follow-ups are folded into their parent item (the report accepts max 10 items).
    const items: ReportItem[] = questions.map((q) => {
      const a = answers[q.id];
      const item: ReportItem = {
        question: q,
        transcript: a?.transcript ?? '',
        durationSec: a?.durationSec ?? 0,
        metrics: a?.metrics ?? { wordCount: 0, wordsPerMinute: 0, fillerWordCount: 0 },
        evaluation: a?.evaluation ?? null,
      };
      return mergeFollowUp(item, a?.followUp?.evaluation);
    });
    report.mutate({ config, items }, { onSuccess: (r) => dispatch({ type: 'REPORT_READY', report: r }) });
  };

  const advance = () => (isLast ? finish() : dispatch({ type: 'NEXT_QUESTION' }));

  if (report.isPending || report.isError) {
    return (
      <section className="center-state" role="status">
        {report.isPending ? (
          <>
            <span className="spinner" aria-hidden="true" />
            <p className="serif-lg">Writing your report…</p>
            <p className="hint">Looking across all {answeredCount} answers. This usually takes 10–20 seconds.</p>
          </>
        ) : (
          <>
            <p className="error">{errorMessage(report.error)}</p>
            <p className="hint">Your answers are saved. You can try again now, or save and come back later.</p>
            <div className="actions">
              <button className="btn primary" onClick={finish}>Try again</button>
              <button className="btn quiet" onClick={() => dispatch({ type: 'RESTART' })}>Save and exit</button>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="session">
      <nav className="progress" aria-label="Interview progress">
        <ol>
          {questions.map((q, i) => {
            const a = answers[q.id];
            const state = a?.skipped ? 'skipped' : a?.evaluation ? 'done' : i === currentIndex ? 'current' : 'todo';
            return (
              <li key={q.id} className={state} aria-current={i === currentIndex ? 'step' : undefined}>
                <span className="sr-only">
                  Question {i + 1}: {state}
                  {a?.followUp ? ', follow-up answered' : ''}
                </span>
              </li>
            );
          })}
        </ol>
        <span className="progress-label">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <label className="toggle">
          <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
          Read questions aloud
        </label>
        <button className="btn link end" onClick={() => endDialog.current?.showModal()}>End interview</button>
      </nav>

      {/* key resets all per-question state (recorder, transcript, mutation) */}
      <QuestionStep
        key={question.id}
        config={config}
        question={question}
        autoRead={autoRead}
        speechLang={speechLang}
        saved={answers[question.id]}
        isLast={isLast}
        onEvaluated={(record) => dispatch({ type: 'ANSWER_EVALUATED', questionId: question.id, record })}
        onFollowUpEvaluated={(followUp) => dispatch({ type: 'FOLLOWUP_EVALUATED', questionId: question.id, followUp })}
        onSkip={() => {
          dispatch({ type: 'QUESTION_SKIPPED', questionId: question.id });
          advance();
        }}
        onNext={advance}
      />

      <dialog ref={endDialog} className="modal" aria-labelledby="end-title">
        <h2 id="end-title">End this interview?</h2>
        <p className="hint">
          {answeredCount > 0
            ? `You’ve answered ${answeredCount} of ${questions.length}. Unanswered questions count as skipped in the report.`
            : 'You haven’t answered any questions yet, so there’s nothing to report on.'}
        </p>
        <div className="modal-actions">
          {answeredCount > 0 && <button className="btn primary" onClick={finish}>Finish and get report</button>}
          <button
            className="btn quiet"
            onClick={() => {
              endDialog.current?.close();
              dispatch({ type: 'RESTART' }); // progress stays saved; Setup offers to resume
            }}
          >
            Save and exit
          </button>
          <button
            className="btn quiet danger"
            onClick={() => {
              endDialog.current?.close();
              discardSavedSession();
              dispatch({ type: 'RESTART' });
            }}
          >
            Discard interview
          </button>
          <button className="btn link" onClick={() => endDialog.current?.close()} autoFocus>Keep going</button>
        </div>
      </dialog>
    </section>
  );
}

interface StepProps {
  config: InterviewConfig;
  question: Question;
  autoRead: boolean;
  speechLang: string;
  saved?: AnswerRecord;
  isLast: boolean;
  onEvaluated: (r: AnswerRecord) => void;
  onFollowUpEvaluated: (f: FollowUpRecord) => void;
  onSkip: () => void;
  onNext: () => void;
}

function QuestionStep({ config, question, autoRead, speechLang, saved, isLast, onEvaluated, onFollowUpEvaluated, onSkip, onNext }: StepProps) {
  const tts = useSpeechSynthesis();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const followHeadingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [followOpen, setFollowOpen] = useState(false);

  const evaluation = saved?.evaluation;
  const followUp = saved?.followUp;
  const followUpQuestion = useMemo(() => (evaluation ? buildFollowUpQuestion(question, evaluation) : null), [question, evaluation]);

  // Read the question when it appears, and move focus to it for keyboard / screen-reader users
  useEffect(() => {
    headingRef.current?.focus();
    if (autoRead) tts.speak(question.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  // After scoring (main answer or follow-up), put focus on "Next" so Enter moves on
  useEffect(() => {
    if (evaluation && !followOpen) nextRef.current?.focus();
  }, [evaluation, followUp, followOpen]);

  useEffect(() => {
    if (followOpen) followHeadingRef.current?.focus();
  }, [followOpen]);

  const openFollowUp = () => {
    setFollowOpen(true);
    if (autoRead && followUpQuestion) tts.speak(followUpQuestion.text);
  };

  return (
    <article className="step">
      <header className="question">
        <p className="question-meta">
          <span className="tag">{question.category === 'system-design' ? 'System design' : question.category}</span>
          {question.competency} <span aria-hidden="true">/</span> about {Math.round(question.timeLimitSec / 60)} min
        </p>
        <h2 ref={headingRef} tabIndex={-1}>{question.text}</h2>
        {tts.isSupported && (
          <button className="btn quiet small" onClick={() => (tts.isSpeaking ? tts.cancel() : tts.speak(question.text))}>
            {tts.isSpeaking ? 'Stop reading' : 'Read question aloud'}
          </button>
        )}
      </header>

      {!evaluation && (
        <AnswerBooth
          key="main"
          config={config}
          question={question}
          speechLang={speechLang}
          onStart={tts.cancel}
          onScored={(a) => onEvaluated({ ...a, skipped: false })}
          onSkip={onSkip}
          skipLabel="Skip this question"
          tip="Tip: take a few seconds to plan. For behavioral questions, try Situation → Task → Action → Result."
        />
      )}

      {evaluation && (
        <>
          <FeedbackPanel evaluation={evaluation} hideFollowUp={Boolean(followUpQuestion)} />

          {followUpQuestion && (
            <section className="followup-block" aria-labelledby={`${followUpQuestion.id}-title`}>
              <p className="followup-kicker">
                <span aria-hidden="true">↳</span> The interviewer follows up
              </p>
              <h3 id={`${followUpQuestion.id}-title`} ref={followHeadingRef} tabIndex={-1}>
                {followUpQuestion.text}
              </h3>

              {followUp ? (
                <FeedbackPanel evaluation={followUp.evaluation} compact />
              ) : followOpen ? (
                <AnswerBooth
                  key="followup"
                  config={config}
                  question={followUpForScoring(followUpQuestion, question)}
                  speechLang={speechLang}
                  onStart={tts.cancel}
                  onScored={(a) => {
                    onFollowUpEvaluated({ ...a, question: followUpQuestion });
                    setFollowOpen(false);
                  }}
                  onSkip={() => {
                    tts.cancel();
                    setFollowOpen(false);
                  }}
                  skipLabel="Cancel follow-up"
                  compact
                />
              ) : (
                <div className="followup-offer">
                  <button className="btn quiet" onClick={openFollowUp}>Answer the follow-up</button>
                  <span className="hint">
                    Optional · counts for {Math.round(FOLLOW_UP_WEIGHT * 100)}% of this question’s score in the report
                  </span>
                </div>
              )}
            </section>
          )}

          {!followOpen && (
            <button ref={nextRef} className="btn primary next" onClick={onNext}>
              {isLast ? 'Finish and see report' : 'Next question →'}
            </button>
          )}
        </>
      )}
    </article>
  );
}
