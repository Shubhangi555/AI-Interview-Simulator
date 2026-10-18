import type { AnswerEvaluation, InterviewReport, Question } from '../../shared/schemas';
import type { AiService } from './aiService';

/** Offline stand-in for the AI so the full flow can be developed and demoed without a key. */

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

type Cat = Question['category'];
const BANK: Record<Cat, Array<Omit<Question, 'id' | 'category' | 'timeLimitSec'>>> = {
  behavioral: [
    { text: 'Tell me about a time you disagreed with a teammate on a technical decision. How did you resolve it?', competency: 'Collaboration', expectedPoints: ['Clear situation', 'Your specific actions', 'How you listened', 'Measurable outcome', 'What you learned'] },
    { text: 'Describe a project that failed or slipped. What was your role and what would you do differently?', competency: 'Ownership', expectedPoints: ['Honest ownership', 'Root cause', 'Recovery actions', 'Lessons applied later'] },
    { text: 'Walk me through how you prioritise when everything feels urgent.', competency: 'Prioritisation', expectedPoints: ['Framework or criteria', 'Stakeholder communication', 'Concrete example', 'Trade-offs made'] },
    { text: 'Tell me about a time you had to learn something unfamiliar quickly to deliver.', competency: 'Learning agility', expectedPoints: ['Context and stakes', 'Learning approach', 'Result', 'Reflection'] },
  ],
  technical: [
    { text: 'How would you find and fix a memory leak in a long-running web application?', competency: 'Debugging', expectedPoints: ['Reproduce and measure', 'Profiling tools', 'Common causes', 'Verify the fix'] },
    { text: 'Explain the difference between optimistic and pessimistic concurrency control, and when you would use each.', competency: 'Fundamentals', expectedPoints: ['Definitions', 'Conflict handling', 'Performance trade-offs', 'Real use cases'] },
    { text: 'How do you decide what belongs in server state versus client state in a frontend app?', competency: 'Architecture', expectedPoints: ['Ownership of data', 'Caching and staleness', 'Tooling choices', 'Example'] },
    { text: 'Walk me through what happens when a user types a URL and presses enter.', competency: 'Fundamentals', expectedPoints: ['DNS', 'TCP/TLS', 'HTTP request/response', 'Rendering pipeline'] },
  ],
  'system-design': [
    { text: 'Design a URL shortener that handles 10,000 writes per second.', competency: 'System design', expectedPoints: ['Requirements and scale', 'ID generation', 'Storage choice', 'Caching', 'Failure modes'] },
    { text: 'Design a notification service that sends email, SMS and push to millions of users.', competency: 'System design', expectedPoints: ['Queueing', 'Provider abstraction', 'Retries and idempotency', 'User preferences', 'Monitoring'] },
    { text: 'How would you design rate limiting for a public API?', competency: 'Scalability', expectedPoints: ['Algorithms', 'Distributed counters', 'Per-key policies', 'Client feedback'] },
  ],
};

const FILLER_NOTE = (n: number) => (n > 6 ? `${n} filler words — pause silently instead of filling gaps.` : 'Filler words were well controlled.');

export const mockAiService: AiService = {
  async generateQuestions(config, signal) {
    await delay(900, signal);
    const cats: Cat[] = config.type === 'mixed' ? ['behavioral', 'technical', 'system-design'] : [config.type];
    return Array.from({ length: config.questionCount }, (_, i) => {
      const cat = cats[i % cats.length];
      const pool = BANK[cat];
      const base = pool[Math.floor(i / cats.length) % pool.length];
      return { ...base, id: `q${i + 1}`, category: cat, timeLimitSec: cat === 'system-design' ? 300 : 150 };
    });
  },

  async evaluateAnswer({ question, transcript, metrics }, signal) {
    await delay(1100, signal);
    const lower = transcript.toLowerCase();
    // Rough heuristic: length + overlap with expected-point keywords
    const covered = question.expectedPoints.filter((p) =>
      p.toLowerCase().split(/\W+/).some((w) => w.length > 4 && lower.includes(w)),
    );
    const depth = Math.min(10, Math.round(metrics.wordCount / 25));
    const relevance = Math.min(10, 3 + Math.round((covered.length / question.expectedPoints.length) * 7));
    const structure = /first|then|finally|result|because/.test(lower) ? 7 : 4;
    const communication = Math.max(2, 9 - Math.floor(metrics.fillerWordCount / 3));
    const score = Math.round(((relevance + structure + depth + communication) / 4) * 10) / 10;
    const missing = question.expectedPoints.filter((p) => !covered.includes(p));
    return {
      score,
      rubric: { relevance, structure, depth, communication },
      strengths: covered.length ? covered.map((p) => `Addressed: ${p.toLowerCase()}`) : ['You attempted the question directly'],
      improvements: [
        ...missing.slice(0, 3).map((p) => `Cover ${p.toLowerCase()}`),
        ...(structure < 6 ? ['Use a clear structure such as situation → action → result'] : []),
      ],
      idealAnswerOutline: question.expectedPoints,
      followUpQuestion: 'What would you do differently with twice the time or half the budget?',
    } satisfies AnswerEvaluation;
  },

  async generateReport({ items }, signal) {
    await delay(1400, signal);
    const answered = items.filter((i) => i.evaluation);
    const avg = answered.length ? answered.reduce((s, i) => s + (i.evaluation?.score ?? 0), 0) / answered.length : 0;
    const overall = Math.round(avg * 10 * (answered.length / items.length));
    const byComp = new Map<string, number[]>();
    for (const i of items) byComp.set(i.question.competency, [...(byComp.get(i.question.competency) ?? []), i.evaluation?.score ?? 0]);
    const wpm = answered.length ? Math.round(answered.reduce((s, i) => s + i.metrics.wordsPerMinute, 0) / answered.length) : 0;
    const fillers = items.reduce((s, i) => s + i.metrics.fillerWordCount, 0);
    return {
      overallScore: overall,
      readiness: overall >= 75 ? 'ready' : overall >= 55 ? 'almost-ready' : 'needs-practice',
      summary: `You answered ${answered.length} of ${items.length} questions with an average score of ${avg.toFixed(1)}/10. (Mock mode: switch VITE_AI_MODE to "live" for real AI feedback.)`,
      competencyScores: [...byComp].map(([competency, s]) => ({ competency, score: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 })),
      topStrengths: answered.flatMap((i) => i.evaluation?.strengths ?? []).slice(0, 3),
      priorityImprovements: answered.flatMap((i) => i.evaluation?.improvements ?? []).slice(0, 3),
      communication: {
        paceAssessment: wpm === 0 ? 'Not enough spoken answers to assess pace.' : wpm < 110 ? `${wpm} wpm is slow; aim for 130–160.` : wpm > 170 ? `${wpm} wpm is fast; slow down on key points.` : `${wpm} wpm is a comfortable pace.`,
        fillerWordAssessment: FILLER_NOTE(fillers),
      },
      practicePlan: [
        { focus: 'Structure', action: 'Record three answers using situation → action → result and replay them.' },
        { focus: 'Depth', action: 'For each weak question, write the ideal outline and answer it again aloud.' },
      ],
    } satisfies InterviewReport;
  },
};
