/**
 * Componente dedicado para execução de teste direto por URL ou ID de tweet.
 */
import { DeletionExecutor } from '../services/deletion-executor';
import { ExtensionConfig } from '../types/config';
import { TweetItem } from '../types/tweet';
import { XSessionService } from '../services/x-session-service';

export interface TestRunnerViewOptions {
  containerElement: HTMLElement;
  urlInput: HTMLInputElement;
  methodSelect: HTMLSelectElement;
  executeBtn: HTMLButtonElement;
  statusOutput: HTMLElement;
  getConfig: () => ExtensionConfig;
  onSuccess: (deletedId: string) => void;
  onLog: (msg: string) => void;
}

export class TestRunnerView {
  private options: TestRunnerViewOptions;

  constructor(options: TestRunnerViewOptions) {
    this.options = options;
    this.init();
  }

  private init(): void {
    // URL padrão fornecida pelo usuário no prompt
    if (!this.options.urlInput.value) {
      this.options.urlInput.value = 'https://x.com/leoplanello/status/1088925139268526085';
    }

    this.options.executeBtn.addEventListener('click', () => {
      this.executeTest();
    });

    this.checkSession();
  }

  private async checkSession(): Promise<void> {
    const session = await XSessionService.getSession();
    const sessionStatusEl = this.options.containerElement.querySelector('.session-status-badge');
    if (sessionStatusEl) {
      if (session.isLoggedIn) {
        sessionStatusEl.className = 'session-status-badge logged-in';
        sessionStatusEl.textContent = '🟢 Active X session (ct0 detected)';
      } else {
        sessionStatusEl.className = 'session-status-badge logged-out';
        sessionStatusEl.textContent = '🟡 Session not detected (open x.com in a browser tab)';
      }
    }
  }

  public async executeTest(): Promise<void> {
    const rawInput = this.options.urlInput.value.trim();
    if (!rawInput) {
      this.showStatus('Please provide a tweet URL or ID.', 'error');
      return;
    }

    // Extrai o ID numérico do tweet
    const match = rawInput.match(/status\/(\d+)/) || rawInput.match(/^(\d+)$/);
    if (!match) {
      this.showStatus('Invalid URL. Could not extract tweet ID.', 'error');
      return;
    }

    const tweetId = match[1];
    const isRetweet = rawInput.includes('/retweet') || this.options.containerElement.querySelector<HTMLInputElement>('#test-is-retweet')?.checked || false;

    const baseConfig = this.options.getConfig();
    const selectedMethod = this.options.methodSelect.value as any;
    const config: ExtensionConfig = {
      ...baseConfig,
      method: selectedMethod || baseConfig.method
    };

    const authorMatch = rawInput.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})\/status/i);
    const authorHandle = authorMatch && authorMatch[1] !== 'i' ? authorMatch[1] : undefined;

    const mockItem: TweetItem = {
      id: tweetId,
      text: tweetId === '1088925139268526085' ? 'Clima assim é muuuito melhor' : `Test tweet ${tweetId}`,
      createdAt: new Date().toISOString(),
      isRetweet,
      url: rawInput.startsWith('http') ? rawInput : `https://x.com/i/status/${tweetId}`,
      authorHandle,
      selected: true,
      status: 'pending'
    };

    this.options.executeBtn.disabled = true;
    this.showStatus(`⏳ Starting deletion of tweet ${tweetId} via method ${config.method.toUpperCase()}...`, 'info');
    this.options.onLog(`[TEST] Triggering deletion of tweet ${tweetId} using method: ${config.method}`);

    try {
      const result = await DeletionExecutor.execute(mockItem, config, { current: 1, total: 1 });

      if (result.success) {
        this.showStatus(`✅ Tweet ${tweetId} deleted successfully! (Status: ${result.statusCode || 200})`, 'success');
        this.options.onLog(`[TEST SUCCESS] Tweet ${tweetId} was deleted.`);
        this.options.onSuccess(tweetId);
      } else {
        const errText = result.error || 'Unknown error during deletion.';
        this.showStatus(`❌ Failed to delete tweet: ${errText}`, 'error');
        this.options.onLog(`[TEST ERROR] Tweet ${tweetId} failed: ${errText}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.showStatus(`❌ Unexpected error: ${msg}`, 'error');
      this.options.onLog(`[TEST ERROR EXCEPTION] ${msg}`);
    } finally {
      this.options.executeBtn.disabled = false;
      this.checkSession();
      // Limpa HUD flutuante da aba
      import('../services/dom-delete-service').then(({ DomDeleteService }) => {
        DomDeleteService.finishSession(false).catch(() => {});
      });
    }
  }

  private showStatus(msg: string, type: 'info' | 'success' | 'error'): void {
    this.options.statusOutput.textContent = msg;
    this.options.statusOutput.className = `test-status-output ${type}`;
  }
}
