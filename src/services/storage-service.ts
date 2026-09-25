/**
 * Serviço de persistência local da extensão usando chrome.storage.local.
 */
import { TweetItem } from '../types/tweet';
import { ExtensionConfig, DEFAULT_CONFIG } from '../types/config';
import { BatchJobState } from '../types/batch-job';

const STORAGE_KEYS = {
  TWEETS: 'x_tweets_list',
  CONFIG: 'x_extension_config',
  DELETED_IDS: 'x_deleted_tweet_ids',
  LAST_SCAN_USER: 'x_last_scan_user',
  JOB_STATE: 'x_batch_job_state',
  JOB_LOGS: 'x_batch_job_logs'
};

export class StorageService {
  /**
   * Obtém a lista de tweets armazenados localmente.
   */
  static async getTweets(): Promise<TweetItem[]> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.TWEETS);
    return (data[STORAGE_KEYS.TWEETS] as TweetItem[]) || [];
  }

  /**
   * Salva a lista de tweets atualizada.
   */
  static async saveTweets(tweets: TweetItem[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.TWEETS]: tweets });
  }

  /**
   * Remove tweets de terceiros (respostas de outras pessoas) garantindo apenas posts do próprio usuário.
   */
  static filterValidUserTweets(tweets: TweetItem[], validUsername?: string): TweetItem[] {
    if (!validUsername) return tweets;
    const cleanUser = validUsername.toLowerCase().replace(/^@/, '');

    return tweets.filter((t) => {
      // Se for Retweet, é mantido pois é um retweet ativo do usuário
      if (t.isRetweet) return true;

      // Se tiver authorHandle definido, valida se corresponde ao usuário alvo
      if (t.authorHandle) {
        return t.authorHandle.toLowerCase() === cleanUser;
      }

      // Se não tiver authorHandle explícito, tenta validar a partir da URL do status
      const match = t.url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})\/status\//i);
      if (match && match[1] && match[1].toLowerCase() !== 'i') {
        return match[1].toLowerCase() === cleanUser;
      }

      return true;
    });
  }

  /**
   * Adiciona ou mescla novos tweets sem duplicar por ID, filtrando tweets inválidos de terceiros.
   */
  static async mergeTweets(newTweets: TweetItem[], validUsername?: string): Promise<TweetItem[]> {
    const current = await this.getTweets();
    const map = new Map<string, TweetItem>();
    
    // Insere os já existentes
    for (const item of current) {
      map.set(item.id, item);
    }
    // Sobrescreve/adiciona novos preservando status se já excluído
    for (const item of newTweets) {
      const existing = map.get(item.id);
      if (existing && existing.status === 'success') {
        continue;
      }
      map.set(item.id, item);
    }

    let merged = Array.from(map.values());
    if (validUsername) {
      merged = this.filterValidUserTweets(merged, validUsername);
    }
    await this.saveTweets(merged);
    return merged;
  }

  /**
   * Limpa a lista de tweets em cache.
   */
  static async clearTweets(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.TWEETS);
  }

  /**
   * Obtém as configurações salvas ou padrão.
   */
  static async getConfig(): Promise<ExtensionConfig> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
    return { ...DEFAULT_CONFIG, ...(data[STORAGE_KEYS.CONFIG] || {}) };
  }

  /**
   * Salva configurações.
   */
  static async saveConfig(config: Partial<ExtensionConfig>): Promise<ExtensionConfig> {
    const current = await this.getConfig();
    const updated = { ...current, ...config };
    await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: updated });
    return updated;
  }

  /**
   * Registra IDs de tweets já apagados com sucesso.
   */
  static async markDeletedId(id: string): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.DELETED_IDS);
    const deletedIds: string[] = (data[STORAGE_KEYS.DELETED_IDS] as string[]) || [];
    if (!deletedIds.includes(id)) {
      deletedIds.push(id);
      await chrome.storage.local.set({ [STORAGE_KEYS.DELETED_IDS]: deletedIds });
    }
  }

  /**
   * Obtém os IDs já apagados.
   */
  static async getDeletedIds(): Promise<string[]> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.DELETED_IDS);
    return (data[STORAGE_KEYS.DELETED_IDS] as string[]) || [];
  }

  /**
   * Obtém o estado do lote em segundo plano.
   */
  static async getBatchJobState(): Promise<BatchJobState | null> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.JOB_STATE);
    return (data[STORAGE_KEYS.JOB_STATE] as BatchJobState) || null;
  }

  /**
   * Salva o estado do lote em segundo plano.
   */
  static async saveBatchJobState(state: BatchJobState | null): Promise<void> {
    if (state === null) {
      await chrome.storage.local.remove(STORAGE_KEYS.JOB_STATE);
    } else {
      await chrome.storage.local.set({ [STORAGE_KEYS.JOB_STATE]: state });
    }
  }

  /**
   * Obtém os logs persistidos da sessão de lote.
   */
  static async getBatchJobLogs(): Promise<string[]> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.JOB_LOGS);
    return (data[STORAGE_KEYS.JOB_LOGS] as string[]) || [];
  }

  /**
   * Adiciona uma mensagem aos logs persistidos da sessão de lote (mantém até 150).
   */
  static async appendBatchJobLog(message: string): Promise<void> {
    const logs = await this.getBatchJobLogs();
    logs.push(message);
    if (logs.length > 150) {
      logs.splice(0, logs.length - 150);
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.JOB_LOGS]: logs });
  }

  /**
   * Limpa os logs persistidos da sessão de lote.
   */
  static async clearBatchJobLogs(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.JOB_LOGS);
  }
}
