/**
 * Entidade de Tweet / Retweet para exibição e controle de exclusão.
 */
export type TweetStatus = 'idle' | 'pending' | 'success' | 'failed' | 'skipped';

export interface TweetItem {
  id: string;
  text: string;
  createdAt: string; // ISO date string ou data formatada
  isRetweet: boolean;
  retweetedFrom?: string;
  mediaUrls?: string[];
  url: string;
  authorHandle?: string;
  selected: boolean;
  status: TweetStatus;
  errorMessage?: string;
}

export interface TweetFilter {
  keyword: string;
  startDate?: string;
  endDate?: string;
  hasMedia?: boolean;
}

export interface TweetStats {
  totalTweets: number;
  totalRetweets: number;
  selectedTweets: number;
  selectedRetweets: number;
}
