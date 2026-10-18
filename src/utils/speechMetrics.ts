import type { SpeechMetrics } from '../../shared/schemas';

const FILLERS = /\b(um+|uh+|erm|like|you know|basically|actually|sort of|kind of|i mean)\b/gi;

// Fast speakers peak around 220 wpm; anything far above means the text wasn't spoken in that time
const MAX_PLAUSIBLE_WPM = 300;

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function computeSpeechMetrics(transcript: string, durationSec: number): SpeechMetrics {
  const words = countWords(transcript);
  const minutes = durationSec / 60;
  const wpm = minutes > 0.1 ? Math.round(words / minutes) : 0; // typed answers have no meaningful duration
  return {
    wordCount: words,
    wordsPerMinute: wpm > MAX_PLAUSIBLE_WPM ? 0 : wpm,
    fillerWordCount: transcript.match(FILLERS)?.length ?? 0,
  };
}

/**
 * Metrics for a submitted answer. Pace and fillers come from what was actually *spoken*
 * (the recognizer output), not the edited/typed final text: users clean up fillers when editing,
 * and pasting a long answer after a short recording would otherwise produce an absurd pace.
 */
export function answerMetrics(finalText: string, spokenText: string, durationSec: number): SpeechMetrics {
  const spoken = spokenText.trim();
  if (!spoken || durationSec <= 0) return { ...computeSpeechMetrics(finalText, 0), fillerWordCount: 0 };
  const fromSpeech = computeSpeechMetrics(spoken, durationSec);
  return { ...fromSpeech, wordCount: countWords(finalText) };
}

export const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
