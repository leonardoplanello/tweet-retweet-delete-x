/**
 * Contratos de mensagens trocadas entre popup, background worker e content scripts.
 */
import { TweetItem } from './tweet';
import { ExtensionConfig } from './config';
import { BatchJobState, BatchJobSummary } from './batch-job';

export type ExtensionMessageType =
  | 'GET_SESSION_AUTH'
  | 'SCAN_TIMELINE_START'
  | 'SCAN_TIMELINE_STOP'
  | 'SCAN_TIMELINE_PROGRESS'
  | 'SCAN_TIMELINE_COMPLETE'
  | 'DOM_DELETE_TWEET'
  | 'DOM_UNRETWEET'
  | 'PING_AUTOMATION'
  | 'REMOVE_AUTOMATION_HUD'
  | 'INJECT_TEST_TWEET'
  | 'START_BATCH_JOB'
  | 'PAUSE_BATCH_JOB'
  | 'RESUME_BATCH_JOB'
  | 'CANCEL_BATCH_JOB'
  | 'GET_BATCH_JOB_STATE'
  | 'BATCH_JOB_STATE_UPDATE'
  | 'BATCH_JOB_LOG'
  | 'BATCH_JOB_ITEM_COMPLETED'
  | 'BATCH_JOB_DONE'
  | 'OPEN_FULL_TAB'
  | 'OPEN_STANDALONE_WINDOW';

export interface BaseMessage {
  type: ExtensionMessageType;
}

export interface GetSessionAuthResponse {
  csrfToken?: string;
  isLoggedIn: boolean;
  username?: string;
}

export interface ScanTimelineStartRequest extends BaseMessage {
  type: 'SCAN_TIMELINE_START';
  maxScrolls?: number;
  targetUsername?: string;
}

export interface DomDeleteTweetRequest extends BaseMessage {
  type: 'DOM_DELETE_TWEET';
  tweetId: string;
  current?: number;
  total?: number;
  targetAuthor?: string;
}

export interface DomDeleteTweetResponse {
  success: boolean;
  error?: string;
  alreadyDeleted?: boolean;
}

export interface DomUnretweetRequest extends BaseMessage {
  type: 'DOM_UNRETWEET';
  tweetId: string;
  current?: number;
  total?: number;
  targetAuthor?: string;
}

export interface DomUnretweetResponse {
  success: boolean;
  error?: string;
  alreadyDeleted?: boolean;
}

export interface ScanTimelineProgressMessage extends BaseMessage {
  type: 'SCAN_TIMELINE_PROGRESS';
  foundCount: number;
  tweets: TweetItem[];
}

export interface StartBatchJobRequest extends BaseMessage {
  type: 'START_BATCH_JOB';
  items: TweetItem[];
  config: ExtensionConfig;
}

export interface BatchJobStateUpdateMessage extends BaseMessage {
  type: 'BATCH_JOB_STATE_UPDATE';
  state: BatchJobState;
}

export interface BatchJobLogMessage extends BaseMessage {
  type: 'BATCH_JOB_LOG';
  message: string;
}

export interface BatchJobItemCompletedMessage extends BaseMessage {
  type: 'BATCH_JOB_ITEM_COMPLETED';
  item: TweetItem;
  success: boolean;
}

export interface BatchJobDoneMessage extends BaseMessage {
  type: 'BATCH_JOB_DONE';
  summary: BatchJobSummary;
}
