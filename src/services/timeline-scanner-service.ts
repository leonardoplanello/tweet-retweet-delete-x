/**
 * Serviço para coordenação de varredura dinâmica da timeline através do content script.
 */
import { TweetItem } from '../types/tweet';
import { StorageService } from './storage-service';

export interface ScanCallbacks {
  onProgress: (found: number) => void;
  onLog: (msg: string) => void;
}

export class TimelineScannerService {
  /**
   * Extrai o nome de usuário da URL da aba ativa caso esteja em uma página do X.
   */
  private static extractUsernameFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('x.com') && !parsed.hostname.includes('twitter.com')) {
        return null;
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length === 0) return null;
      const candidate = parts[0].toLowerCase();
      const reserved = new Set([
        'home', 'explore', 'notifications', 'messages', 'i', 'compose',
        'search', 'settings', 'tos', 'privacy', 'logout', 'login', 'intent'
      ]);
      if (reserved.has(candidate)) return null;
      if (/^[a-zA-Z0-9_]{1,15}$/.test(candidate)) {
        return candidate;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Inicia a varredura na aba ativa do X.
   */
  static async startScan(callbacks: ScanCallbacks): Promise<TweetItem[]> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab || !activeTab.id || !activeTab.url || (!activeTab.url.includes('x.com') && !activeTab.url.includes('twitter.com'))) {
      throw new Error('Abra a página do seu perfil no X (ex: x.com/seu_usuario) antes de iniciar a varredura.');
    }

    const targetUsername = this.extractUsernameFromUrl(activeTab.url);
    if (targetUsername) {
      callbacks.onLog(`[VARREDURA] Alvo identificado: @${targetUsername}. Apenas seus posts e retweets serão coletados.`);
    } else {
      callbacks.onLog(`[VARREDURA] Iniciando busca de tweets na aba ativa (${activeTab.url})...`);
    }

    // Injeta content script caso ainda não esteja injetado
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      });
    } catch {
      // Ignora se já estiver injetado pelo manifest
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        activeTab.id!,
        { type: 'SCAN_TIMELINE_START', maxScrolls: 15, targetUsername: targetUsername || undefined },
        async (response) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (response && response.success) {
            const tweets: TweetItem[] = response.tweets || [];
            callbacks.onLog(`[VARREDURA CONCLUÍDA] Foram identificados ${tweets.length} tweets/retweets válidos pertencentes ao usuário.`);
            const saved = await StorageService.mergeTweets(tweets, targetUsername || undefined);
            resolve(saved);
          } else {
            reject(new Error(response?.error || 'Falha ao escanear a timeline'));
          }
        }
      );
    });
  }

  /**
   * Interrompe a varredura em andamento.
   */
  static async stopScan(): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (activeTab && activeTab.id) {
      chrome.tabs.sendMessage(activeTab.id, { type: 'SCAN_TIMELINE_STOP' }).catch(() => {});
    }
  }
}
