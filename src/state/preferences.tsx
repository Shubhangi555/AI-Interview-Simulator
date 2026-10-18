import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { InterviewConfigInput } from '../../shared/schemas';
import { usePersistentState } from '../lib/storage';

/** Per-browser UI preferences. Never sent to the server. */
export type Theme = 'system' | 'light' | 'dark';

export const SPEECH_LANGS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-AU', label: 'English (Australia)' },
] as const;

const THEMES: Theme[] = ['system', 'light', 'dark'];
const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);
const isLang = (v: unknown): v is string => SPEECH_LANGS.some((l) => l.value === v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isConfig = (v: unknown): v is InterviewConfigInput | null =>
  v === null || (typeof v === 'object' && typeof (v as InterviewConfigInput).role === 'string');

function usePreferencesValue() {
  const [theme, setTheme] = usePersistentState<Theme>('theme', 'system', isTheme);
  const [speechLang, setSpeechLang] = usePersistentState<string>('speechLang', 'en-US', isLang);
  const [autoRead, setAutoRead] = usePersistentState<boolean>('autoRead', true, isBool);
  const [lastConfig, setLastConfig] = usePersistentState<InterviewConfigInput | null>('lastConfig', null, isConfig);

  // Theme is applied on <html> so the CSS tokens switch everywhere, including print
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  return useMemo(
    () => ({ theme, setTheme, speechLang, setSpeechLang, autoRead, setAutoRead, lastConfig, setLastConfig }),
    [theme, setTheme, speechLang, setSpeechLang, autoRead, setAutoRead, lastConfig, setLastConfig],
  );
}

type Preferences = ReturnType<typeof usePreferencesValue>;
const PrefsCtx = createContext<Preferences | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  return <PrefsCtx.Provider value={usePreferencesValue()}>{children}</PrefsCtx.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PrefsCtx);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
