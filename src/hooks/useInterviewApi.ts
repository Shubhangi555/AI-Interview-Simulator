import { useMutation } from '@tanstack/react-query';
import type { EvaluateRequest, InterviewConfig, ReportRequest } from '../../shared/schemas';
import { aiService } from '../lib/aiService';
import { ApiError } from '../lib/apiClient';

/** Retry only transient failures (timeouts, 429/5xx), at most twice, with backoff. */
const retry = (failureCount: number, error: Error) => error instanceof ApiError && error.retryable && failureCount < 2;
const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 8000);

export const useGenerateQuestions = () =>
  useMutation({
    mutationKey: ['interview', 'questions'],
    mutationFn: (config: InterviewConfig) => aiService.generateQuestions(config),
    retry,
    retryDelay,
  });

export const useEvaluateAnswer = () =>
  useMutation({
    mutationKey: ['interview', 'evaluate'],
    mutationFn: (req: EvaluateRequest) => aiService.evaluateAnswer(req),
    retry,
    retryDelay,
  });

export const useGenerateReport = () =>
  useMutation({
    mutationKey: ['interview', 'report'],
    mutationFn: (req: ReportRequest) => aiService.generateReport(req),
    retry,
    retryDelay,
  });

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');
