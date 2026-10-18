import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimal typings for the Web Speech API (not in TS's DOM lib in all versions). */
interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface RecognitionErrorEvent { error: string }
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

const getCtor = (): RecognitionCtor | undefined => {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const isSpeechRecognitionSupported = () => Boolean(getCtor());

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser settings, or type your answer.',
  'service-not-allowed': 'Speech recognition is unavailable in this browser. Type your answer instead.',
  network: 'Speech recognition lost its connection. Your audio is still recording; type or edit the answer below.',
  'audio-capture': 'No microphone was found.',
};

/**
 * Live transcription. Chrome ends recognition after silence even in continuous mode,
 * so we auto-restart while the user still intends to listen.
 * Note: Chrome/Edge send audio to the vendor's cloud for recognition — disclose this to users.
 */
export function useSpeechRecognition(lang = 'en-US') {
  const Ctor = getCtor();
  const isSupported = Boolean(Ctor);
  const recRef = useRef<Recognition | null>(null);
  const wantListening = useRef(false);
  const finalRef = useRef('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(() => {
    if (!Ctor) return;
    setError(null);
    finalRef.current = '';
    setFinalTranscript('');
    setInterim('');
    wantListening.current = true;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += `${r[0].transcript.trim()} `;
        else interimText += r[0].transcript;
      }
      setFinalTranscript(finalRef.current);
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return; // benign; onend restarts
      setError(ERROR_MESSAGES[e.error] ?? `Speech recognition error: ${e.error}`);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        wantListening.current = false;
      }
    };
    rec.onend = () => {
      if (wantListening.current) {
        try {
          rec.start();
          return;
        } catch {
          /* fall through to stopped state */
        }
      }
      setIsListening(false);
      setInterim('');
    };
    recRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
    } catch {
      setError('Could not start speech recognition.');
    }
  }, [Ctor, lang]);

  const stop = useCallback(() => {
    wantListening.current = false;
    recRef.current?.stop();
  }, []);

  // Abort on unmount so the mic is released
  useEffect(
    () => () => {
      wantListening.current = false;
      recRef.current?.abort();
    },
    [],
  );

  return { isSupported, isListening, finalTranscript, interim, error, start, stop };
}
