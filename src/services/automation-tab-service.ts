/**
 * Serviço de orquestração da aba dedicada de automação para navegação direta de tweets no X.
 * Reutiliza abas existentes, injeta scripts de forma resiliente e realiza handshake antes de acionar ações no DOM.
 */
import { DeleteResult } from './graphql-delete-service';

export interface AutomationProgressInfo {
  current?: number;
  total?: number;
}

export class AutomationTabService {
  private static instance: AutomationTabService;
  private currentTabId: number | null = null;
  private openedByUs: boolean = false;

  public static getInstance(): AutomationTabService {
    if (!this.instance) {
      this.instance = new AutomationTabService();
    }
    return this.instance;
  }

  /**
   * Obtém a aba existente ou cria uma nova aba dedicada de automação.
   */
  public async getOrCreateTab(): Promise<number> {
    if (this.currentTabId !== null) {
      try {
        const tab = await chrome.tabs.get(this.currentTabId);
        if (tab && tab.id) {
          return tab.id;
        }
      } catch {
        this.currentTabId = null;
      }
    }

    // Procura abas abertas no X/Twitter que não sejam a página da própria extensão
    const existingTabs = await chrome.tabs.query({
      url: ['https://x.com/*', 'https://twitter.com/*']
    });

    const candidate = existingTabs.find((t) => t.id && !t.url?.startsWith('chrome-extension://'));
    if (candidate && candidate.id) {
      this.currentTabId = candidate.id;
      this.openedByUs = false;
      return candidate.id;
    }

    // Cria nova aba dedicada visível para o processo
    const newTab = await chrome.tabs.create({
      url: 'https://x.com/home',
      active: true
    });

    if (!newTab.id) {
      throw new Error('Falha ao instanciar aba de automação no navegador.');
    }

    this.currentTabId = newTab.id;
    this.openedByUs = true;
    return newTab.id;
  }

  /**
   * Navega para a URL do tweet e aguarda handshake do content script.
   */
  public async navigateToTweet(tweetId: string, tweetUrl?: string): Promise<number> {
    const tabId = await this.getOrCreateTab();
    const targetUrl = tweetUrl && (tweetUrl.includes('x.com') || tweetUrl.includes('twitter.com'))
      ? tweetUrl
      : `https://x.com/i/status/${tweetId}`;

    await chrome.tabs.update(tabId, { url: targetUrl, active: true });

    // Aguarda status complete da navegação
    await this.waitForTabLoaded(tabId, 15000);

    // Garante que o content script responde ao ping antes de prosseguir
    await this.ensureContentScriptReady(tabId, 8000);

    return tabId;
  }

  /**
   * Executa a exclusão ou desretweet de um post na aba de automação.
   */
  public async executeOnTweet(
    tweetId: string,
    isRetweet: boolean,
    progress?: AutomationProgressInfo,
    tweetUrl?: string,
    targetAuthor?: string
  ): Promise<DeleteResult> {
    try {
      const tabId = await this.navigateToTweet(tweetId, tweetUrl);

      const authorFromUrl = tweetUrl?.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})\/status/i)?.[1];
      const effectiveAuthor = targetAuthor || (authorFromUrl && authorFromUrl !== 'i' ? authorFromUrl : undefined);

      const messageType = isRetweet ? 'DOM_UNRETWEET' : 'DOM_DELETE_TWEET';
      const response = await chrome.tabs.sendMessage(tabId, {
        type: messageType,
        tweetId,
        current: progress?.current,
        total: progress?.total,
        targetAuthor: effectiveAuthor
      });

      if (response && response.success) {
        return { success: true };
      }

      if (response && response.alreadyDeleted) {
        return { success: true, statusCode: 404, error: 'Tweet já excluído ou indisponível' };
      }

      return {
        success: false,
        error: response?.error || 'Ação de exclusão DOM não concluída com sucesso.'
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  /**
   * Fecha ou limpa a aba dedicada ao término do lote.
   */
  public async cleanup(closeTab: boolean = true): Promise<void> {
    if (this.currentTabId !== null) {
      try {
        if (this.openedByUs && closeTab) {
          await chrome.tabs.remove(this.currentTabId).catch(() => {});
        } else {
          // Apenas remove o HUD flutuante da página do usuário
          await chrome.tabs.sendMessage(this.currentTabId, { type: 'REMOVE_AUTOMATION_HUD' }).catch(() => {});
        }
      } catch {}
      this.currentTabId = null;
      this.openedByUs = false;
    }
  }

  private waitForTabLoaded(tabId: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      const interval = setInterval(async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === 'complete' || Date.now() - start > timeoutMs) {
            clearInterval(interval);
            resolve();
          }
        } catch {
          clearInterval(interval);
          resolve();
        }
      }, 300);
    });
  }

  private async ensureContentScriptReady(tabId: number, timeoutMs: number): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const res = await chrome.tabs.sendMessage(tabId, { type: 'PING_AUTOMATION' });
        if (res && res.pong) {
          return;
        }
      } catch {
        // Se ainda não respondeu, tenta injetar manualmente caso run_at: document_idle tenha atrasado
        if (Date.now() - start > 2000) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content.js']
            });
          } catch {}
        }
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}
