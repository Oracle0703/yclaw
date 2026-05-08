import { z } from 'zod';

export const taskListInputSchema = {
  status: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
};

export const taskGetInputSchema = {
  taskId: z.string().min(1),
};

export const batchGetInputSchema = {
  batchId: z.string().min(1),
};

export const batchLogsInputSchema = {
  batchId: z.string().min(1),
  limit: z.number().int().positive().max(500).optional(),
  since: z.string().optional(),
};

export const resultsQueryInputSchema = {
  taskId: z.string().min(1).optional(),
  batchId: z.string().min(1).optional(),
  limit: z.number().int().positive().max(500).optional(),
};

export const hotLatestInputSchema = {
  sourceId: z.string().min(1).optional(),
  keyword: z.string().min(1).optional(),
  limit: z.number().int().positive().max(500).optional(),
};

export const hotTrendsInputSchema = {
  limit: z.number().int().positive().max(500).optional(),
};

export const hotSummaryInputSchema = {
  keyword: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
};

export const taskRunInputSchema = {
  taskId: z.string().min(1),
};

export const sessionRefreshInputSchema = {
  sessionId: z.string().min(1),
};
