import { useEffect, useState } from 'react';
import { HistoryScreen } from './components/HistoryScreen';
import { InterviewScreen } from './components/InterviewScreen';
import { ReportScreen } from './components/ReportScreen';
import { SetupScreen } from './components/SetupScreen';
import { AI_MODE } from './lib/aiService';
import { useHistory } from './state/history';
import { useInterviewDispatch, useInterviewState } from './state/interviewState';
import { usePreferences, type Theme } from './state/preferences';

const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<Theme, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };

export default function App() {
  const { phase } = useInterviewState();
  const dispatch = useInterviewDispatch();
  const { theme, setTheme } = usePreferences();
  const historyCount = useHistory().length;
  const [view, setView] = useState<'main' | 'history'>('main');
  const interviewing = phase === 'interviewing';

  // Leaving the history view always lands on a clean setup screen
  const startNew = () => {
    if (phase === 'report') dispatch({ type: 'RESTART' });
    setView('main');
  };

  // New screen → start at the top (otherwise long reports leave you scrolled halfway down)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase, view]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar no-print">
        {interviewing ? (
          <span className="brand">Mock Interview Room</span>
        ) : (
          <button className="brand as-link" onClick={startNew}>Mock Interview Room</button>
        )}
        {AI_MODE === 'mock' && (
          <span className="demo-pill" title="Questions and feedback are simulated in the browser. Run locally with an API key for real AI feedback.">
            Demo<span className="demo-pill-long"> mode</span>
          </span>
        )}
        <nav className="topnav" aria-label="Main">
          {!interviewing && (
            <button className={`navlink ${view === 'history' ? 'on' : ''}`} aria-current={view === 'history' ? 'page' : undefined} onClick={() => setView('history')}>
              History{historyCount > 0 && <span className="count">{historyCount}</span>}
            </button>
          )}
          <button
            className="navlink"
            onClick={() => setTheme(NEXT_THEME[theme])}
            aria-label={`Theme: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[NEXT_THEME[theme]]}.`}
            title="Switch theme"
          >
            <span aria-hidden="true">{theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}</span>{' '}
            <span className="theme-label">{THEME_LABEL[theme]}</span>
          </button>
        </nav>
      </header>
      <main id="main">
        {view === 'history' && !interviewing ? (
          <HistoryScreen onNew={startNew} />
        ) : (
          <>
            {phase === 'setup' && <SetupScreen />}
            {phase === 'interviewing' && <InterviewScreen />}
            {phase === 'report' && <ReportScreen onShowHistory={() => setView('history')} />}
          </>
        )}
      </main>
    </div>
  );
}
