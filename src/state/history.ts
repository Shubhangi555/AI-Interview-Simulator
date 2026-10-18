import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import {
  AnswerEvaluationSchema,
  InterviewConfigSchema,
  InterviewReportSchema,
  QuestionSchema,
  SpeechMetricsSchema,
} from '../../shared/schemas';
import { readJson, writeJson } from '../lib/storage';

/**
 * Completed interviews, kept in localStorage (text only; audio blobs are not persisted).
 * Validated on read so a schema change or hand-edited storage can't crash the app.
 */
const KEY = 'history.v1';
const MAX_ENTRIES = 30; // ~5–10 kB each; well under the ~5 MB localStorage budget

/** A scored follow-up, without audio. Shared by saved sessions and history. */
export const FollowUpDataSchema = z.object({
  question: QuestionSchema,
  transcript: z.string(),
  durationSec: z.number(),
  metrics: SpeechMetricsSchema,
  evaluation: AnswerEvaluationSchema,
});
export type FollowUpData = z.infer<typeof FollowUpDataSchema>;

export const HistoryItemSchema = z.object({
  question: QuestionSchema,
  transcript: z.string(),
  durationSec: z.number(),
  metrics: SpeechMetricsSchema,
  evaluation: AnswerEvaluationSchema.nullable(),
  skipped: z.boolean(),
  followUp: FollowUpDataSchema.optional(), // optional: entries saved before follow-ups still validate
});

export const HistoryEntrySchema = z.object({
  id: z.string(),
  completedAt: z.string(), // ISO timestamp
  config: InterviewConfigSchema,
  report: InterviewReportSchema,
  items: z.array(HistoryItemSchema),
});

export type HistoryItem = z.infer<typeof HistoryItemSchema>;
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

function load(): HistoryEntry[] {
  const raw = readJson<unknown>(KEY, []);
  if (!Array.isArray(raw)) return [];
  // Drop individual bad entries instead of losing the whole history
  return raw.flatMap((e) => {
    const parsed = HistoryEntrySchema.safeParse(e);
    return parsed.success ? [parsed.data] : [];
  });
}

let entries: HistoryEntry[] = load(); // newest first
const listeners = new Set<() => void>();

function commit(next: HistoryEntry[]) {
  entries = next;
  writeJson(KEY, entries);
  listeners.forEach((l) => l());
}

export const history = {
  /** Upsert by id, so a repeated save (e.g. StrictMode double effect) never duplicates. */
  add(entry: HistoryEntry) {
    commit([entry, ...entries.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES));
  },
  remove(id: string) {
    commit(entries.filter((e) => e.id !== id));
  },
  clear() {
    commit([]);
  },
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useHistory = () => useSyncExternalStore(subscribe, () => entries);

/** The most recent earlier interview for the same role + level, for "vs last time" comparisons. */
export function findPrevious(list: HistoryEntry[], current: { id: string; config: { role: string; seniority: string } }) {
  const idx = list.findIndex((e) => e.id === current.id);
  const older = idx === -1 ? list : list.slice(idx + 1);
  const role = current.config.role.trim().toLowerCase();
  return older.find((e) => e.config.role.trim().toLowerCase() === role && e.config.seniority === current.config.seniority);
}
