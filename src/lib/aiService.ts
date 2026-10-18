import {
  AnswerEvaluationSchema,
  InterviewReportSchema,
  QuestionsResponseSchema,
  type AnswerEvaluation,
  type EvaluateRequest,
  type InterviewConfig,
  type InterviewReport,
  type Question,
  type ReportRequest,
} from '../../shared/schemas';
import { postJson } from './apiClient';
import { mockAiService } from './mockAiService';

/** UI depends on this interface only, so live/mock (or a future provider) are interchangeable. */
export interface AiService {
  generateQuestions(config: InterviewConfig, signal?: AbortSignal): Promise<Question[]>;
  evaluateAnswer(req: EvaluateRequest, signal?: AbortSignal): Promise<AnswerEvaluation>;
  generateReport(req: ReportRequest, signal?: AbortSignal): Promise<InterviewReport>;
}

const liveAiService: AiService = {
  generateQuestions: async (config, signal) =>
    (await postJson('/api/interview/questions', config, QuestionsResponseSchema, signal)).questions,
  evaluateAnswer: (req, signal) => postJson('/api/interview/evaluate', req, AnswerEvaluationSchema, signal),
  generateReport: (req, signal) => postJson('/api/interview/report', req, InterviewReportSchema, signal),
};

export const AI_MODE: 'live' | 'mock' =
  String(import.meta.env.VITE_AI_MODE ?? '').trim().toLowerCase() === 'live' ? 'live' : 'mock';
console.info(`[app] AI mode: ${AI_MODE}`);
export const aiService: AiService = AI_MODE === 'live' ? liveAiService : mockAiService;
