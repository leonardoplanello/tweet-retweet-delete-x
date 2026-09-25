/**
 * Definições e contratos de estado para o processamento de lote em segundo plano.
 */
import { TweetItem } from './tweet';

export type BatchJobStatus = 'idle' | 'running' | 'paused' | 'aborted' | 'completed';

export interface BatchJobProgress {
  current: number;
  total: number;
  currentItem: TweetItem | null;
  message: string;
  successCount: number;
  failCount: number;
}

export interface BatchJobState {
  status: BatchJobStatus;
  total: number;
  current: number;
  currentItem: TweetItem | null;
  successCount: number;
  failCount: number;
  message: string;
  startedAt?: number;
  updatedAt?: number;
}

export interface BatchJobSummary {
  successCount: number;
  failCount: number;
  total: number;
}
