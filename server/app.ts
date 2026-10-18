import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ZodError, type ZodTypeAny, type z } from 'zod';
// Explicit .js extensions: required by Node's ESM loader when this runs as a Vercel function
import {
  AnswerEvaluationSchema,
  EvaluateRequestSchema,
  InterviewConfigSchema,
  InterviewReportSchema,
  QuestionsResponseSchema,
  ReportRequestSchema,
} from '../shared/schemas.js';
import { AiError, generateJson } from './ai.js';
import { evaluatePrompt, questionsPrompt, reportPrompt } from './prompts.js';

/**
 * The Express app, without `listen()`. Used by:
 *  - server/index.ts  → local dev (`npm run dev`)
 *  - api/index.ts     → Vercel serverless function (same routes, same behaviour)
 */
const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim());

app.disable('x-powered-by');
// Behind Vercel's proxy the client IP is in X-Forwarded-For; trust one hop so rate limiting is per user, not per proxy
if (process.env.VERCEL) app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' })); // transcripts are text; audio never leaves the browser

// Minimal CORS allow-list. On Vercel the frontend and /api share an origin, so no CORS is needed there.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Every request costs model tokens — cap per IP. Replace with per-user limits once auth exists.
// Note: in-memory, so on serverless each warm instance counts separately (a soft limit, not a hard one).
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));

/** Wraps an AI route: validates body, runs handler, forwards errors. */
const route =
  <S extends ZodTypeAny, O>(input: S, handler: (body: z.infer<S>) => Promise<O>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await handler(input.parse(req.body)));
    } catch (err) {
      next(err);
    }
  };

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post(
  '/api/interview/questions',
  route(InterviewConfigSchema, (config) => generateJson({ ...questionsPrompt(config), schema: QuestionsResponseSchema, maxTokens: 3000 })),
);

app.post(
  '/api/interview/evaluate',
  route(EvaluateRequestSchema, (body) => generateJson({ ...evaluatePrompt(body), schema: AnswerEvaluationSchema, maxTokens: 1500 })),
);

app.post(
  '/api/interview/report',
  route(ReportRequestSchema, (body) => generateJson({ ...reportPrompt(body), schema: InterviewReportSchema, maxTokens: 2500 })),
);

// Unknown /api routes get JSON, not Express's HTML 404
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found', retryable: false }));

// Central error handler: consistent { error, retryable } shape, no stack traces to clients.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid request', retryable: false });
  }
  if (err instanceof AiError) {
    return res.status(err.status).json({ error: err.message, retryable: err.retryable });
  }
  console.error('[server] unhandled', err);
  res.status(500).json({ error: 'Unexpected server error', retryable: true });
});

export default app;
