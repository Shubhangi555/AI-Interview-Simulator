import { useState, type FormEvent } from 'react';
import { InterviewConfigSchema, type InterviewConfigInput } from '../../shared/schemas';
import { isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition';
import { errorMessage, useGenerateQuestions } from '../hooks/useInterviewApi';
import { AI_MODE } from '../lib/aiService';
import { discardSavedSession, loadSavedSession, useInterviewDispatch } from '../state/interviewState';
import { SPEECH_LANGS, usePreferences } from '../state/preferences';

const TYPES = [
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'technical', label: 'Technical' },
  { value: 'system-design', label: 'System design' },
  { value: 'mixed', label: 'Mixed' },
] as const;

const ROLE_PRESETS = ['Frontend Engineer', 'Backend Engineer', 'Full-stack Engineer', 'React Native Developer', 'QA Engineer', 'Product Manager'];

const DEFAULT_FORM: InterviewConfigInput = {
  role: 'Frontend Engineer',
  seniority: 'mid',
  type: 'mixed',
  questionCount: 5,
  focusAreas: '',
  jobDescription: '',
};

export function SetupScreen() {
  const dispatch = useInterviewDispatch();
  const generate = useGenerateQuestions();
  const { lastConfig, setLastConfig, speechLang, setSpeechLang } = usePreferences();
  const speechSupported = isSpeechRecognitionSupported();
  const [form, setForm] = useState<InterviewConfigInput>(() => ({ ...DEFAULT_FORM, ...lastConfig }));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saved, setSaved] = useState(loadSavedSession);

  const update = <K extends keyof InterviewConfigInput>(key: K, value: InterviewConfigInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = InterviewConfigSchema.safeParse(form);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setFieldError(null);
    setLastConfig(parsed.data);
    generate.mutate(parsed.data, {
      onSuccess: (questions) => {
        discardSavedSession(); // starting fresh replaces any unfinished session
        dispatch({ type: 'QUESTIONS_READY', config: parsed.data, questions });
      },
    });
  };

  const count = form.questionCount ?? 5;
  const answeredInSaved = saved ? Object.values(saved.answers).filter((a) => a.evaluation || a.skipped).length : 0;

  return (
    <section className="setup">
      {saved && (
        <aside className="resume" aria-label="Unfinished interview">
          <div>
            <strong>Pick up where you left off?</strong>
            <p className="hint">
              {saved.config.role} · {saved.config.seniority[0].toUpperCase() + saved.config.seniority.slice(1)} · {answeredInSaved} of {saved.questions.length} questions done ·{' '}
              {new Date(saved.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={() => dispatch({ type: 'RESUME_SESSION', snapshot: saved })}>Resume</button>
            <button
              className="btn quiet"
              onClick={() => {
                discardSavedSession();
                setSaved(null);
              }}
            >
              Discard
            </button>
          </div>
        </aside>
      )}

      <header className="setup-head">
        <h1>Practice the interview before the interview.</h1>
        <p className="lede">
          Answer out loud. Your answers are transcribed as you speak, scored against what a strong candidate would cover, and
          rolled up into a report on what to practise next.
        </p>
      </header>

      <form className="setup-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="role">Role</label>
          <input id="role" value={form.role} onChange={(e) => update('role', e.target.value)} maxLength={80} required />
          <div className="chips" role="group" aria-label="Common roles">
            {ROLE_PRESETS.map((r) => (
              <button type="button" key={r} className={`chip ${form.role === r ? 'on' : ''}`} aria-pressed={form.role === r} onClick={() => update('role', r)}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="field">
          <legend>Level</legend>
          <div className="segmented">
            {(['junior', 'mid', 'senior', 'lead'] as const).map((s) => (
              <label key={s} className={form.seniority === s ? 'on' : ''}>
                <input type="radio" name="seniority" checked={form.seniority === s} onChange={() => update('seniority', s)} />
                {s[0].toUpperCase() + s.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Interview type</legend>
          <div className="segmented">
            {TYPES.map((t) => (
              <label key={t.value} className={form.type === t.value ? 'on' : ''}>
                <input type="radio" name="type" checked={form.type === t.value} onChange={() => update('type', t.value)} />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>
            Questions: {count} <span className="hint">· about {count * 2}–{count * 3} min</span>
          </span>
          <input type="range" min={3} max={10} value={count} onChange={(e) => update('questionCount', Number(e.target.value))} />
        </label>

        <label className="field">
          <span>Focus areas (optional)</span>
          <input
            value={form.focusAreas}
            onChange={(e) => update('focusAreas', e.target.value)}
            placeholder="React performance, leading a team, API design"
            maxLength={300}
          />
        </label>

        <label className="field">
          <span>
            Job description (optional) <span className="hint">· {form.jobDescription?.length ?? 0}/4000</span>
          </span>
          <textarea
            rows={4}
            value={form.jobDescription}
            onChange={(e) => update('jobDescription', e.target.value)}
            placeholder="Paste the posting to tailor the questions"
            maxLength={4000}
          />
        </label>

        {speechSupported && (
          <label className="field">
            <span>Speech recognition language</span>
            <select value={speechLang} onChange={(e) => setSpeechLang(e.target.value)}>
              {SPEECH_LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <span className="hint">Pick the accent closest to yours for more accurate transcripts.</span>
          </label>
        )}

        {(fieldError || generate.isError) && (
          <p className="error" role="alert">
            {fieldError ?? `${errorMessage(generate.error)}`}
          </p>
        )}

        <div className="submit-row">
          <button className="btn primary" type="submit" disabled={generate.isPending}>
            {generate.isPending ? 'Preparing questions…' : generate.isError ? 'Try again' : 'Start interview'}
          </button>
          <p className="hint">
            {AI_MODE === 'mock' ? 'Mock mode: questions and feedback are simulated locally.' : `Uses ${count + 2} AI requests.`}
          </p>
        </div>
      </form>
    </section>
  );
}
