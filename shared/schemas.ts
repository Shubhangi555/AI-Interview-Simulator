import { z } from 'zod';

/** Single source of truth for the API contract. Validated on the server (input + AI output) and on the client (responses). */

export const SeniorityEnum = z.enum(['junior', 'mid', 'senior', 'lead']);
export const InterviewTypeEnum = z.enum(['behavioral', 'technical', 'system-design', 'mixed']);

export const InterviewConfigSchema = z.object({
  role: z.string().trim().min(2, 'Enter a role').max(80),
  seniority: SeniorityEnum,
  type: InterviewTypeEnum,
  questionCount: z.number().int().min(3).max(10),
  focusAreas: z.string().trim().max(300).optional().default(''),
  jobDescription: z.string().trim().max(4000).optional().default(''),
});

export const QuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(5),
  category: InterviewTypeEnum.exclude(['mixed']),
  competency: z.string().min(2),
  expectedPoints: z.array(z.string()).min(1).max(6),
  timeLimitSec: z.number().int().min(30).max(600),
});

export const QuestionsResponseSchema = z.object({
  questions: z.array(QuestionSchema).min(1).max(10),
});

export const SpeechMetricsSchema = z.object({
  wordCount: z.number().int().nonnegative(),
  wordsPerMinute: z.number().nonnegative(),
  fillerWordCount: z.number().int().nonnegative(),
});

const score10 = z.number().min(0).max(10);

export const AnswerEvaluationSchema = z.object({
  score: score10,
  rubric: z.object({
    relevance: score10,
    structure: score10,
    depth: score10,
    communication: score10,
  }),
  strengths: z.array(z.string()).max(5),
  improvements: z.array(z.string()).max(5),
  idealAnswerOutline: z.array(z.string()).max(6),
  followUpQuestion: z.string().optional(),
});

export const EvaluateRequestSchema = z.object({
  config: InterviewConfigSchema,
  question: QuestionSchema,
  transcript: z.string().trim().min(1, 'Answer is empty').max(8000),
  durationSec: z.number().nonnegative().max(1800),
  metrics: SpeechMetricsSchema,
});

export const ReportItemSchema = z.object({
  question: QuestionSchema,
  transcript: z.string().max(8000),
  durationSec: z.number().nonnegative(),
  metrics: SpeechMetricsSchema,
  evaluation: AnswerEvaluationSchema.nullable(), // null = skipped
});

export const ReportRequestSchema = z.object({
  config: InterviewConfigSchema,
  items: z.array(ReportItemSchema).min(1).max(10),
});

export const InterviewReportSchema = z.object({
  overallScore: z.number().min(0).max(100),
  readiness: z.enum(['ready', 'almost-ready', 'needs-practice']),
  summary: z.string(),
  competencyScores: z.array(z.object({ competency: z.string(), score: score10 })).max(10),
  topStrengths: z.array(z.string()).max(5),
  priorityImprovements: z.array(z.string()).max(5),
  communication: z.object({
    paceAssessment: z.string(),
    fillerWordAssessment: z.string(),
  }),
  practicePlan: z.array(z.object({ focus: z.string(), action: z.string() })).max(6),
});

export type InterviewConfig = z.infer<typeof InterviewConfigSchema>;
export type InterviewConfigInput = z.input<typeof InterviewConfigSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type SpeechMetrics = z.infer<typeof SpeechMetricsSchema>;
export type AnswerEvaluation = z.infer<typeof AnswerEvaluationSchema>;
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;
export type ReportItem = z.infer<typeof ReportItemSchema>;
export type ReportRequest = z.infer<typeof ReportRequestSchema>;
export type InterviewReport = z.infer<typeof InterviewReportSchema>;
