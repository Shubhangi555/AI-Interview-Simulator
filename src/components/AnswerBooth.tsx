import { useEffect, useState } from 'react';
import type { AnswerEvaluation, InterviewConfig, Question, SpeechMetrics } from '../../shared/schemas';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { errorMessage, useEvaluateAnswer } from '../hooks/useInterviewApi';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { answerMetrics, computeSpeechMetrics, formatTime } from '../utils/speechMetrics';
import { LevelMeter } from './LevelMeter';

const TIME_WARN_RATIO = 0.8;

export interface ScoredAnswer {
  transcript: string;
  durationSec: number;
  metrics: SpeechMetrics;
  audio: Blob | null;
  evaluation: AnswerEvaluation;
}

interface Props {
  config: InterviewConfig;
  /** The question as sent for scoring (may carry extra context, e.g. for follow-ups). */
  question: Question;
  speechLang: string;
  onStart?: () => void; // e.g. stop text-to-speech
  onScored: (answer: ScoredAnswer) => void;
  onSkip: () => void;
  skipLabel: string;
  tip?: string;
  compact?: boolean;
}

type Stage = 'ready' | 'recording' | 'review';

/**
 * One answer attempt: record + live transcript (or type) → review/edit → score.
 * Mount with a `key` per attempt; unmounting releases the mic and revokes the recording URL.
 */
export function AnswerBooth({ config, question, speechLang, onStart, onScored, onSkip, skipLabel, tip, compact }: Props) {
  const recorder = useAudioRecorder();
  const speech = useSpeechRecognition(speechLang);
  const evaluate = useEvaluateAnswer();

  const voiceAvailable = recorder.isSupported;
  const [stage, setStage] = useState<Stage>(voiceAvailable ? 'ready' : 'review');
  const [draft, setDraft] = useState('');
  const [draftEdited, setDraftEdited] = useState(false);

  // Keep the review draft in sync with late-arriving final results until the user edits it
  useEffect(() => {
    if (stage === 'review' && !draftEdited && speech.finalTranscript) setDraft(speech.finalTranscript.trim());
  }, [stage, draftEdited, speech.finalTranscript]);

  // Warn before leaving while there's unsaved work (a recording or an unscored answer)
  const hasUnsavedWork = stage === 'recording' || draft.trim().length > 0 || evaluate.isPending;
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // still required by Chrome to show the prompt
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedWork]);

  const startAnswer = async () => {
    onStart?.();
    setDraft('');
    setDraftEdited(false);
    recorder.reset();
    const ok = await recorder.start();
    if (!ok) {
      setStage('review'); // fall back to typing
      return;
    }
    if (speech.isSupported) speech.start();
    setStage('recording');
  };

  const stopAnswer = () => {
    recorder.stop();
    speech.stop();
    setDraft(`${speech.finalTranscript} ${speech.interim}`.trim());
    setStage('review');
  };

  const submit = () => {
    const transcript = draft.trim();
    if (!transcript || evaluate.isPending) return;
    const durationSec = recorder.recording?.durationSec ?? 0;
    const metrics = answerMetrics(transcript, speech.finalTranscript, durationSec);
    evaluate.mutate(
      { config, question, transcript, durationSec, metrics },
      { onSuccess: (evaluation) => onScored({ transcript, durationSec, metrics, audio: recorder.recording?.blob ?? null, evaluation }) },
    );
  };

  const timeRatio = recorder.elapsedSec / question.timeLimitSec;
  const timeState = timeRatio >= 1 ? 'over' : timeRatio >= TIME_WARN_RATIO ? 'warn' : '';
  const live = computeSpeechMetrics(`${speech.finalTranscript} ${speech.interim}`, recorder.elapsedSec);
  const mediaError = recorder.error ?? speech.error;
  const draftWords = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <>
      {mediaError && <p className="error" role="alert">{mediaError}</p>}
      <div className={`booth ${stage} ${compact ? 'compact' : ''}`}>
        {stage === 'ready' && (
          <div className="booth-ready">
            <button className="btn record" onClick={startAnswer}>
              <span className="dot" aria-hidden="true" /> Start answering
            </button>
            <button className="btn quiet" onClick={() => setStage('review')}>Type instead</button>
            {tip && <p className="hint">{tip}</p>}
            {!speech.isSupported && <p className="hint">Live transcription needs Chrome or Edge. Audio still records; type your answer after.</p>}
          </div>
        )}

        {stage === 'recording' && (
          <div className="booth-live">
            <div className="live-row">
              <span className="on-air">Recording</span>
              <span className={`clock ${timeState}`}>
                {formatTime(recorder.elapsedSec)} / {formatTime(question.timeLimitSec)}
              </span>
            </div>
            <div
              className={`timebar ${timeState}`}
              role="progressbar"
              aria-label="Time used"
              aria-valuemin={0}
              aria-valuemax={question.timeLimitSec}
              aria-valuenow={Math.min(recorder.elapsedSec, question.timeLimitSec)}
            >
              <span style={{ width: `${Math.min(100, timeRatio * 100)}%` }} />
            </div>
            {timeState && (
              <p className={`time-note ${timeState}`} role="status">
                {timeState === 'over' ? 'Time’s up. Wrap up in a sentence or two.' : 'About 20% of your time left. Start wrapping up.'}
              </p>
            )}
            <LevelMeter level={recorder.level} active />
            <p className="live-transcript" aria-live="polite">
              {speech.finalTranscript}
              <span className="interim">{speech.interim}</span>
              {!speech.finalTranscript && !speech.interim && <span className="interim">Listening…</span>}
            </p>
            {speech.isSupported && recorder.elapsedSec >= 5 && (
              <dl className="live-stats" aria-label="Live speaking stats">
                <div><dt>Words</dt><dd>{live.wordCount}</dd></div>
                <div>
                  <dt>Pace</dt>
                  <dd className={live.wordsPerMinute > 170 ? 'flag' : ''}>{live.wordsPerMinute} wpm</dd>
                </div>
                <div>
                  <dt>Fillers</dt>
                  <dd className={live.fillerWordCount > 5 ? 'flag' : ''}>{live.fillerWordCount}</dd>
                </div>
              </dl>
            )}
            <button className="btn primary" onClick={stopAnswer}>Stop and review</button>
          </div>
        )}

        {stage === 'review' && (
          <div className="booth-review">
            {recorder.recording && (
              <audio controls src={recorder.recording.url} className="playback">
                Your browser can’t play this recording.
              </audio>
            )}
            <label className="field">
              <span>{recorder.recording ? 'Transcript: fix anything that was misheard' : 'Your answer'}</span>
              <textarea
                rows={compact ? 5 : 7}
                value={draft}
                maxLength={8000}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDraftEdited(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Type or paste your answer"
              />
            </label>
            <p className="hint field-foot">
              {draftWords} words · <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit
            </p>
            {evaluate.isError && <p className="error" role="alert">{errorMessage(evaluate.error)}</p>}
            <div className="actions">
              <button className="btn primary" onClick={submit} disabled={!draft.trim() || evaluate.isPending}>
                {evaluate.isPending && <span className="spinner sm" aria-hidden="true" />}
                {evaluate.isPending ? 'Scoring your answer…' : 'Get feedback'}
              </button>
              {voiceAvailable && (
                <button className="btn quiet" onClick={startAnswer} disabled={evaluate.isPending}>
                  {recorder.recording ? 'Record again' : 'Record instead'}
                </button>
              )}
            </div>
          </div>
        )}

        {stage !== 'recording' && (
          <button className="btn link skip" onClick={onSkip} disabled={evaluate.isPending}>
            {skipLabel}
          </button>
        )}
      </div>
    </>
  );
}
