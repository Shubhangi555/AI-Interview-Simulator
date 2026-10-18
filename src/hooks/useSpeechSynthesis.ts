import { useCallback, useEffect, useState } from 'react';

/** Reads questions aloud so the session feels like a real interview. */
export function useSpeechSynthesis() {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98;
      u.onend = () => setIsSpeaking(false);
      u.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [isSupported],
  );

  const cancel = useCallback(() => {
    if (isSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  useEffect(() => cancel, [cancel]);
  return { isSupported, isSpeaking, speak, cancel };
}
