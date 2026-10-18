import type { AnswerEvaluation, InterviewConfig, InterviewReport, Question } from '../../shared/schemas';
import type { AiService } from './aiService';
import { GENERIC_FOLLOW_UPS, QUESTION_BANK, type BankQuestion, type Level, type Track } from './mockQuestionBank';
import { readJson, writeJson } from './storage';

/**
 * Offline stand-in for the AI so the full flow can be developed and demoed without a key.
 * Picks questions from a role-aware bank, avoids recent repeats, and gives heuristic feedback.
 */

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

// Slightly variable latency so the demo feels like a real service
const thinking = (base: number, signal?: AbortSignal) => delay(base + Math.random() * 600, signal);
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

type Cat = Question['category'];

/* ---------------- Question selection ---------------- */

const ROLE_TRACKS: Array<[RegExp, Track[]]> = [
  [/full[\s-]?stack/i, ['frontend', 'backend']],
  [/mobile|android|ios|react native|flutter|swift|kotlin/i, ['mobile']],
  [/front|react|angular|vue|\bui\b|web dev|javascript|typescript|next/i, ['frontend']],
  [/\bqa\b|test|quality|sdet|automation/i, ['qa']],
  [/devops|\bsre\b|site reliability|cloud|platform|infra/i, ['devops']],
  [/data|analyst|machine learning|\bml\b|scientist|\bbi\b/i, ['data']],
  [/product|\bpm\b|program manager/i, ['product']],
  [/back|api|node|java|python|golang|\bgo\b|server|django|spring|\.net|php|ruby/i, ['backend']],
];

/** Map a free-text role ("Senior React Developer") to question tracks; unknown roles get general questions. */
export function tracksForRole(role: string): Track[] {
  for (const [re, tracks] of ROLE_TRACKS) if (re.test(role)) return tracks;
  return [];
}

const LEVELS: Record<InterviewConfig['seniority'], { allowed: Level[]; preferred: Level }> = {
  junior: { allowed: [1, 2], preferred: 1 },
  mid: { allowed: [1, 2, 3], preferred: 2 },
  senior: { allowed: [2, 3], preferred: 3 },
  lead: { allowed: [2, 3], preferred: 3 },
};

/** How many of each category to ask. "Mixed" leans on behavioral + technical, with some design for non-juniors. */
function categoryPlan(config: InterviewConfig): Cat[] {
  const n = config.questionCount;
  if (config.type !== 'mixed') return Array(n).fill(config.type);
  const design = config.seniority === 'junior' ? (n >= 6 ? 1 : 0) : Math.max(1, Math.round(n * 0.2));
  const behavioral = Math.ceil((n - design) / 2);
  return [
    ...Array<Cat>(behavioral).fill('behavioral'),
    ...Array<Cat>(n - design - behavioral).fill('technical'),
    ...Array<Cat>(design).fill('system-design'),
  ];
}

// Common words that would otherwise "match" every question when a job description is pasted in
const STOPWORDS = new Set(
  'the and for with you your our are will have has this that from who what when how why work working team teams experience years year strong skills ability able using use build building role job about into across well good great plus must should can not all any its their they them then than more most also etc'.split(' '),
);
const words = (text: string) =>
  new Set(text.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)));

const RECENT_KEY = 'mock.recentQuestions';
const RECENT_LIMIT = 60;

function scoreQuestion(q: BankQuestion, roleTracks: Track[], config: InterviewConfig, focus: Set<string>, recent: Set<string>) {
  const lvl = LEVELS[config.seniority];
  let score = Math.random() * 3; // shuffle among equally good matches
  if (roleTracks.some((t) => q.tracks.includes(t))) score += 6;
  else if (q.tracks.includes('any')) score += roleTracks.length ? 1 : 4;
  score += q.level === lvl.preferred ? 3 : lvl.allowed.includes(q.level) ? 1 : -4;
  // Focus areas / job description: reward keyword overlap
  const haystack = `${q.text} ${q.competency} ${(q.tags ?? []).join(' ')}`.toLowerCase();
  let hits = 0;
  for (const w of focus) if (haystack.includes(w)) hits++;
  score += Math.min(hits, 3) * 2.5;
  if (recent.has(q.id)) score -= 8; // strongly prefer questions you haven't seen lately
  return score;
}

function selectQuestions(config: InterviewConfig): Question[] {
  const roleTracks = tracksForRole(config.role);
  const focus = words(`${config.focusAreas} ${config.jobDescription}`);
  const recent = new Set(readJson<string[]>(RECENT_KEY, []));
  const chosen = new Set<string>();
  const plan = categoryPlan(config);

  const picked = plan.map((cat) => {
    const best = QUESTION_BANK.filter((q) => q.category === cat && !chosen.has(q.id))
      .map((q) => ({ q, s: scoreQuestion(q, roleTracks, config, focus, recent) }))
      .sort((a, b) => b.s - a.s)[0]?.q;
    if (best) chosen.add(best.id);
    return best;
  }).filter((q): q is BankQuestion => Boolean(q));

  // Warm up: within each category, easier questions first
  const order: Record<Cat, number> = { behavioral: 0, technical: 1, 'system-design': 2 };
  picked.sort((a, b) => order[a.category] - order[b.category] || a.level - b.level);

  writeJson(RECENT_KEY, [...picked.map((q) => q.id), ...recent].slice(0, RECENT_LIMIT));

  const senior = config.seniority === 'senior' || config.seniority === 'lead';
  return picked.map((q, i) => ({
    id: `q${i + 1}`,
    text: q.text,
    category: q.category,
    competency: q.competency,
    expectedPoints: q.expectedPoints,
    timeLimitSec:
      q.category === 'system-design' ? (config.seniority === 'junior' ? 240 : 300) : q.category === 'behavioral' ? (senior ? 180 : 150) : q.level === 3 ? 180 : 150,
  }));
}

/* ---------------- Answer evaluation ---------------- */

const BY_TEXT = new Map(QUESTION_BANK.map((q) => [q.text, q]));

const STRENGTH_TEMPLATES = [
  (p: string) => `You covered ${p.toLowerCase()}`,
  (p: string) => `Good coverage of ${p.toLowerCase()}`,
  (p: string) => `Clear point on ${p.toLowerCase()}`,
];
const IMPROVE_TEMPLATES = [
  (p: string) => `Add ${p.toLowerCase()}`,
  (p: string) => `Expand on ${p.toLowerCase()} with a concrete example`,
  (p: string) => `You didn't mention ${p.toLowerCase()}`,
];

function keywordsFor(point: string) {
  return point.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
}

function evaluate(question: Question, transcript: string, metrics: { wordCount: number; fillerWordCount: number }): AnswerEvaluation {
  const lower = transcript.toLowerCase();
  const covered = question.expectedPoints.filter((p) => keywordsFor(p).some((w) => lower.includes(w)));
  const missing = question.expectedPoints.filter((p) => !covered.includes(p));

  const hasNumbers = /\d/.test(transcript);
  const hasExample = /for example|for instance|e\.g\.|such as|in my (last|previous)|at my/.test(lower);
  const hasStructure = /first|second|then|next|finally|result|because|so that|situation|task|action/.test(lower);
  const usesI = /\bi\b|\bi'm\b|\bi've\b/.test(lower);
  const isBehavioral = question.category === 'behavioral';

  const coverage = covered.length / question.expectedPoints.length;
  const relevance = Math.min(10, 3 + Math.round(coverage * 7));
  const structure = Math.min(10, (hasStructure ? 6 : 3) + (hasExample ? 2 : 0) + (metrics.wordCount > 80 ? 1 : 0));
  const depth = Math.min(10, Math.round(metrics.wordCount / 22) + (hasNumbers ? 1 : 0));
  const communication = Math.max(2, Math.min(10, 9 - Math.floor(metrics.fillerWordCount / 3) - (metrics.wordCount > 400 ? 1 : 0)));
  const score = Math.round(((relevance * 1.3 + structure + depth + communication * 0.7) / 4) * 10) / 10;

  const strengths = covered.slice(0, 3).map((p) => pick(STRENGTH_TEMPLATES)(p));
  if (hasNumbers) strengths.push('You quantified the impact with numbers');
  if (hasExample) strengths.push('You grounded the answer in a concrete example');
  if (hasStructure && strengths.length < 5) strengths.push('Easy to follow: the answer had a clear structure');
  if (!strengths.length) strengths.push('You addressed the question directly');

  const improvements = missing.slice(0, 3).map((p) => pick(IMPROVE_TEMPLATES)(p));
  if (metrics.wordCount < 60) improvements.push('Go deeper: aim for one to two minutes with specifics');
  if (metrics.wordCount > 400) improvements.push('Tighten it: lead with the answer, then support it');
  if (!hasStructure) improvements.push(isBehavioral ? 'Use Situation → Task → Action → Result' : 'Structure it: approach, trade-offs, then a recommendation');
  if (isBehavioral && !hasNumbers) improvements.push('Quantify the outcome (time saved, % improvement, users affected)');
  if (isBehavioral && !usesI) improvements.push('Say “I” more than “we” so your own contribution is clear');

  const bank = BY_TEXT.get(question.text);
  return {
    score,
    rubric: { relevance, structure, depth, communication },
    strengths: strengths.slice(0, 5),
    improvements: improvements.slice(0, 5),
    idealAnswerOutline: question.expectedPoints,
    followUpQuestion: pick(bank?.followUps.length ? bank.followUps : GENERIC_FOLLOW_UPS),
  };
}

/* ---------------- Report ---------------- */

const PLAN_BY_DIMENSION: Record<keyof AnswerEvaluation['rubric'], { focus: string; action: string }> = {
  relevance: { focus: 'Answer the question asked', action: 'Before answering, restate the question in one sentence, then list the 3–4 points you will cover.' },
  structure: { focus: 'Structure', action: 'Record three answers using Situation → Task → Action → Result and replay them to check the flow.' },
  depth: { focus: 'Depth', action: 'For each weak question, write the ideal outline, add one real example with numbers, and answer it again aloud.' },
  communication: { focus: 'Delivery', action: 'Practise two-minute answers and replace filler words with a short pause.' },
};

function buildReport(items: Parameters<AiService['generateReport']>[0]['items']): InterviewReport {
  const answered = items.filter((i) => i.evaluation);
  const avg = answered.length ? answered.reduce((s, i) => s + (i.evaluation?.score ?? 0), 0) / answered.length : 0;
  const overall = Math.round(avg * 10 * (answered.length / items.length));

  const byComp = new Map<string, number[]>();
  for (const i of items) byComp.set(i.question.competency, [...(byComp.get(i.question.competency) ?? []), i.evaluation?.score ?? 0]);
  const competencyScores = [...byComp].map(([competency, s]) => ({ competency, score: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 }));
  const sorted = [...competencyScores].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  // Weakest rubric dimensions drive the practice plan
  const dims = (Object.keys(PLAN_BY_DIMENSION) as Array<keyof AnswerEvaluation['rubric']>)
    .map((d) => ({ d, v: answered.reduce((s, i) => s + (i.evaluation?.rubric[d] ?? 0), 0) / (answered.length || 1) }))
    .sort((a, b) => a.v - b.v);
  const practicePlan = [
    ...dims.slice(0, 2).map(({ d }) => PLAN_BY_DIMENSION[d]),
    ...(weakest && weakest.score < 7 ? [{ focus: weakest.competency, action: `Prepare two stories or explanations that show ${weakest.competency.toLowerCase()}, and practise them out loud.` }] : []),
  ];

  const spoken = answered.filter((i) => i.metrics.wordsPerMinute > 0);
  const wpm = spoken.length ? Math.round(spoken.reduce((s, i) => s + i.metrics.wordsPerMinute, 0) / spoken.length) : 0;
  const fillers = items.reduce((s, i) => s + i.metrics.fillerWordCount, 0);
  const unique = (list: string[]) => [...new Set(list)];

  const band = overall >= 75 ? 'strong' : overall >= 55 ? 'solid but uneven' : 'still developing';
  const summary = answered.length
    ? `Your performance was ${band}: ${answered.length} of ${items.length} questions answered, averaging ${avg.toFixed(1)}/10. ` +
      (strongest && weakest && strongest !== weakest
        ? `${strongest.competency} was your strongest area, while ${weakest.competency.toLowerCase()} needs the most work. `
        : '') +
      'This is demo mode: feedback is simulated in your browser. Run it with an API key for real AI feedback.'
    : 'No questions were answered, so there is nothing to assess yet. This is demo mode: feedback is simulated in your browser.';

  return {
    overallScore: overall,
    readiness: overall >= 75 ? 'ready' : overall >= 55 ? 'almost-ready' : 'needs-practice',
    summary,
    competencyScores: competencyScores.slice(0, 10),
    topStrengths: unique(answered.flatMap((i) => i.evaluation?.strengths ?? [])).slice(0, 3),
    priorityImprovements: unique(answered.flatMap((i) => i.evaluation?.improvements ?? [])).slice(0, 3),
    communication: {
      paceAssessment:
        wpm === 0 ? 'Not enough spoken answers to assess pace. Try recording your answers next time.'
        : wpm < 110 ? `${wpm} wpm is on the slow side; aim for 130–160 wpm.`
        : wpm > 170 ? `${wpm} wpm is fast; slow down on your key points.`
        : `${wpm} wpm is a comfortable, clear pace.`,
      fillerWordAssessment:
        fillers > 6 ? `${fillers} filler words: pause silently instead of filling gaps.` : 'Filler words were well controlled.',
    },
    practicePlan: practicePlan.slice(0, 6),
  };
}

export const mockAiService: AiService = {
  async generateQuestions(config, signal) {
    await thinking(900, signal);
    return selectQuestions(config);
  },

  async evaluateAnswer({ question, transcript, metrics }, signal) {
    await thinking(1000, signal);
    return evaluate(question, transcript, metrics);
  },

  async generateReport({ items }, signal) {
    await thinking(1300, signal);
    return buildReport(items);
  },
};
