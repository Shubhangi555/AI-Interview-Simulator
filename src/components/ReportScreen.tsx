import { useEffect, useMemo } from 'react';
import { findPrevious, useHistory, type HistoryItem } from '../state/history';
import { useInterviewDispatch, useInterviewState } from '../state/interviewState';
import { followUpId } from '../utils/followUp';
import { ReportView } from './ReportView';

export function ReportScreen({ onShowHistory }: { onShowHistory: () => void }) {
  const { sessionId, report, config, questions, answers } = useInterviewState();
  const dispatch = useInterviewDispatch();
  const entries = useHistory();

  // Object URLs for answer playback; revoked on unmount
  const audioUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of questions) {
      const a = answers[q.id];
      if (a?.audio) map[q.id] = URL.createObjectURL(a.audio);
      if (a?.followUp?.audio) map[followUpId(q.id)] = URL.createObjectURL(a.followUp.audio);
    }
    return map;
  }, [questions, answers]);
  useEffect(() => () => Object.values(audioUrls).forEach((u) => URL.revokeObjectURL(u)), [audioUrls]);

  if (!report || !config) return null;

  const items: HistoryItem[] = questions.map((q) => {
    const a = answers[q.id];
    return {
      question: q,
      transcript: a?.transcript ?? '',
      durationSec: a?.durationSec ?? 0,
      metrics: a?.metrics ?? { wordCount: 0, wordsPerMinute: 0, fillerWordCount: 0 },
      evaluation: a?.evaluation ?? null,
      skipped: !a?.evaluation,
      ...(a?.followUp && { followUp: { ...a.followUp, audio: undefined } }),
    };
  });

  return (
    <ReportView
      config={config}
      report={report}
      items={items}
      audioUrls={audioUrls}
      previous={findPrevious(entries, { id: sessionId, config })}
      actions={
        <>
          <button className="btn primary" onClick={() => dispatch({ type: 'RESTART' })}>Start a new interview</button>
          <button className="btn quiet" onClick={onShowHistory}>See all interviews</button>
        </>
      }
    />
  );
}
