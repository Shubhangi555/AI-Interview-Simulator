import { useCallback, useEffect, useRef, useState } from 'react';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
const pickMime = () =>
  typeof MediaRecorder !== 'undefined' ? MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) : undefined;

export interface Recording {
  url: string; // object URL — revoked when replaced or on unmount
  blob: Blob;
  durationSec: number;
}

/**
 * Records mic audio locally (never uploaded) and exposes a 0–1 input level for a live meter.
 * Cleans up tracks, audio context and object URLs to avoid leaks across questions.
 */
export function useAudioRecorder() {
  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>();
  const timerRef = useRef<number>();
  const startedAt = useRef(0);
  const urlRef = useRef<string | null>(null);

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser.');
      return false;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;

      // Level meter via AnalyserNode
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mimeType = pickMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        setRecording({ url: urlRef.current, blob, durationSec: (Date.now() - startedAt.current) / 1000 });
        teardown();
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      startedAt.current = Date.now();
      setElapsedSec(0);
      timerRef.current = window.setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
      setIsRecording(true);
      return true;
    } catch (err) {
      teardown();
      const name = (err as DOMException).name;
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access is blocked. Allow it in your browser settings, or type your answer.'
          : name === 'NotFoundError'
            ? 'No microphone was found.'
            : 'Could not start recording.',
      );
      return false;
    }
  }, [isSupported, teardown]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setIsRecording(false);
  }, []);

  const reset = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setRecording(null);
    setElapsedSec(0);
  }, []);

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      teardown();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [teardown],
  );

  return { isSupported, isRecording, elapsedSec, level, recording, error, start, stop, reset };
}
