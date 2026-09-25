/**
 * Entry point do popup da extensão que orquestra componentes visuais e serviços de dados.
 * Conecta-se ao Background Service Worker para manter exclusões ativas mesmo ao clicar fora ou minimizar.
 */
import { TweetItem } from '../types/tweet';
import { ExtensionConfig } from '../types/config';
import { BatchJobState } from '../types/batch-job';
import { StartBatchJobRequest } from '../types/messages';
import { StorageService } from '../services/storage-service';
import { XSessionService } from '../services/x-session-service';
import { TimelineScannerService } from '../services/timeline-scanner-service';
import { DeletionExecutor } from '../services/deletion-executor';
import { DomDeleteService } from '../services/dom-delete-service';
import { KeepAwakeService } from '../services/keep-awake-service';
import { TabManager } from '../components/tab-manager';
import { TweetListView } from '../components/tweet-list-view';
import { TestRunnerView } from '../components/test-runner-view';
import { ArchiveUploaderView } from '../components/archive-uploader-view';
import { SettingsView } from '../components/settings-view';
import { ProgressBarView } from '../components/progress-bar-view';
import { LoggerView } from '../components/logger-view';
import { WindowModeView } from '../components/window-mode-view';

class PopupController {
  private allTweets: TweetItem[] = [];
  private isBatchPaused: boolean = false;

  // Subcomponentes
  private tabManager!: TabManager;
  private loggerView!: LoggerView;
  private progressBarView!: ProgressBarView;
  private settingsView!: SettingsView;
  private testRunnerView!: TestRunnerView;
  private archiveUploaderView!: ArchiveUploaderView;
  private tweetsListView!: TweetListView;
  private retweetsListView!: TweetListView;
  private windowModeView!: WindowModeView;

  // Elementos globais do DOM
  private sessionBadgeEl!: HTMLElement;
  private scanBtn!: HTMLButtonElement;
  private bulkDeleteBtn!: HTMLButtonElement;
  private bulkSelectionLabel!: HTMLElement;
  private badgeTweetsCount!: HTMLElement;
  private badgeRtsCount!: HTMLElement;
  private bgRunningBanner!: HTMLElement;
  private bgRunningText!: HTMLElement;

  async init(): Promise<void> {
    this.bindGlobalElements();
    this.initComponents();
    this.setupBackgroundMessageListeners();
    await this.loadInitialData();
    await this.checkSession();
    await this.checkOngoingBackgroundJob();
  }

  private bindGlobalElements(): void {
    this.sessionBadgeEl = document.getElementById('session-badge') as HTMLElement;
    this.scanBtn = document.getElementById('btn-scan-timeline') as HTMLButtonElement;
    this.bulkDeleteBtn = document.getElementById('btn-delete-selected') as HTMLButtonElement;
    this.bulkSelectionLabel = document.getElementById('bulk-selection-label') as HTMLElement;
    this.badgeTweetsCount = document.getElementById('badge-tweets-count') as HTMLElement;
    this.badgeRtsCount = document.getElementById('badge-rts-count') as HTMLElement;
    this.bgRunningBanner = document.getElementById('bg-running-banner') as HTMLElement;
    this.bgRunningText = document.getElementById('bg-running-text') as HTMLElement;

    this.scanBtn.addEventListener('click', () => this.handleScanTimeline());
    this.bulkDeleteBtn.addEventListener('click', () => this.handleBulkDelete());
  }

  private initComponents(): void {
    // 1. Gerenciador de Abas
    this.tabManager = new TabManager('.tab-nav-btn', '.tab-pane');

    // 2. Logger View
    this.loggerView = new LoggerView({
      containerElement: document.getElementById('logger-container') as HTMLElement,
      logsOutputElement: document.getElementById('logger-output') as HTMLElement,
      clearBtn: document.getElementById('btn-clear-logs') as HTMLButtonElement,
      toggleBtn: document.getElementById('btn-toggle-logs') as HTMLButtonElement
    });

    // 3. Progress Bar View (conectado ao background)
    this.progressBarView = new ProgressBarView({
      containerElement: document.getElementById('progress-container') as HTMLElement,
      fillElement: document.getElementById('progress-bar-fill') as HTMLElement,
      textElement: document.getElementById('progress-text') as HTMLElement,
      pauseBtn: document.getElementById('btn-pause-process') as HTMLButtonElement,
      cancelBtn: document.getElementById('btn-cancel-process') as HTMLButtonElement,
      onTogglePause: () => {
        if (this.isBatchPaused) {
          chrome.runtime.sendMessage({ type: 'RESUME_BATCH_JOB' });
          this.progressBarView.setPaused(false);
          this.isBatchPaused = false;
          this.loggerView.log('Solicitada retomada do processo em segundo plano.');
        } else {
          chrome.runtime.sendMessage({ type: 'PAUSE_BATCH_JOB' });
          this.progressBarView.setPaused(true);
          this.isBatchPaused = true;
          this.loggerView.log('Solicitada pausa do processo em segundo plano.');
        }
      },
      onCancel: () => {
        chrome.runtime.sendMessage({ type: 'CANCEL_BATCH_JOB' });
        this.progressBarView.hide();
        this.hideRunningBanner();
        KeepAwakeService.disable();
        this.bulkDeleteBtn.disabled = false;
        this.loggerView.log('Cancelamento solicitado.');
      }
    });

    // 4. Settings View
    this.settingsView = new SettingsView({
      methodSelect: document.getElementById('settings-method') as HTMLSelectElement,
      minDelayInput: document.getElementById('settings-min-delay') as HTMLInputElement,
      maxDelayInput: document.getElementById('settings-max-delay') as HTMLInputElement,
      autoPauseCheckbox: document.getElementById('settings-auto-pause') as HTMLInputElement,
      cooldownInput: document.getElementById('settings-cooldown') as HTMLInputElement,
      customDeleteQueryIdInput: document.getElementById('settings-query-id') as HTMLInputElement,
      clearCacheBtn: document.getElementById('btn-clear-cache') as HTMLButtonElement,
      saveFeedbackEl: document.getElementById('settings-save-feedback') as HTMLElement,
      onConfigChange: (cfg: ExtensionConfig) => {
        this.loggerView.log(`Configurações salvas: Método ${cfg.method.toUpperCase()} | Delay ${cfg.minDelayMs}-${cfg.maxDelayMs}ms`);
      },
      onClearCache: () => {
        this.allTweets = [];
        this.syncTweetsToLists();
        this.loggerView.log('Cache de tweets limpo.');
      }
    });

    // 5. Window Mode View (Aba cheia ou janela independente)
    this.windowModeView = new WindowModeView({
      openTabBtn: document.getElementById('btn-open-tab') as HTMLButtonElement,
      openWindowBtn: document.getElementById('btn-open-window') as HTMLButtonElement,
      modeBadge: document.getElementById('mode-badge') as HTMLElement,
      onLog: (msg: string) => this.loggerView.log(msg)
    });

    const settingsTabBtn = document.getElementById('btn-settings-open-tab') as HTMLButtonElement;
    const settingsWinBtn = document.getElementById('btn-settings-open-window') as HTMLButtonElement;
    if (settingsTabBtn) {
      settingsTabBtn.addEventListener('click', () => this.windowModeView.openInNewTab());
    }
    if (settingsWinBtn) {
      settingsWinBtn.addEventListener('click', () => this.windowModeView.openInStandaloneWindow());
    }

    // 6. Test Runner View (para exclusão direta e teste)
    this.testRunnerView = new TestRunnerView({
      containerElement: document.getElementById('tab-test') as HTMLElement,
      urlInput: document.getElementById('test-url-input') as HTMLInputElement,
      methodSelect: document.getElementById('test-method-select') as HTMLSelectElement,
      executeBtn: document.getElementById('btn-run-test-delete') as HTMLButtonElement,
      statusOutput: document.getElementById('test-status-output') as HTMLElement,
      getConfig: () => this.settingsView.getConfig(),
      onSuccess: (deletedId: string) => {
        this.markTweetAsDeleted(deletedId);
      },
      onLog: (msg: string) => this.loggerView.log(msg)
    });

    // 7. Archive Uploader View
    this.archiveUploaderView = new ArchiveUploaderView({
      fileInput: document.getElementById('archive-file-input') as HTMLInputElement,
      dropZone: document.getElementById('archive-dropzone') as HTMLElement,
      statusElement: document.getElementById('archive-status') as HTMLElement,
      onArchiveLoaded: (items: TweetItem[]) => {
        this.allTweets = items;
        this.syncTweetsToLists();
        this.tabManager.switchTab('tab-tweets');
      },
      onLog: (msg: string) => this.loggerView.log(msg)
    });

    // 8. Lista de Tweets
    this.tweetsListView = new TweetListView({
      containerElement: document.getElementById('tweets-list-container') as HTMLElement,
      filterInput: document.getElementById('tweets-filter-input') as HTMLInputElement,
      startDateInput: document.getElementById('tweets-date-start') as HTMLInputElement,
      endDateInput: document.getElementById('tweets-date-end') as HTMLInputElement,
      selectAllBtn: document.getElementById('tweets-select-all') as HTMLButtonElement,
      deselectAllBtn: document.getElementById('tweets-deselect-all') as HTMLButtonElement,
      counterElement: document.getElementById('tweets-selection-counter') as HTMLElement,
      isRetweetList: false,
      onSelectionChange: () => this.updateBulkSelectionState(),
      onDeleteSingle: (t: TweetItem) => this.handleDeleteSingle(t)
    });

    // 9. Lista de Retweets
    this.retweetsListView = new TweetListView({
      containerElement: document.getElementById('rts-list-container') as HTMLElement,
      filterInput: document.getElementById('rts-filter-input') as HTMLInputElement,
      startDateInput: document.getElementById('rts-date-start') as HTMLInputElement,
      endDateInput: document.getElementById('rts-date-end') as HTMLInputElement,
      selectAllBtn: document.getElementById('rts-select-all') as HTMLButtonElement,
      deselectAllBtn: document.getElementById('rts-deselect-all') as HTMLButtonElement,
      counterElement: document.getElementById('rts-selection-counter') as HTMLElement,
      isRetweetList: true,
      onSelectionChange: () => this.updateBulkSelectionState(),
      onDeleteSingle: (t: TweetItem) => this.handleDeleteSingle(t)
    });
  }

  private setupBackgroundMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'BATCH_JOB_STATE_UPDATE') {
        this.handleStateUpdate(message.state as BatchJobState);
      } else if (message.type === 'BATCH_JOB_ITEM_COMPLETED') {
        const item: TweetItem = message.item;
        const local = this.allTweets.find((t) => t.id === item.id);
        if (local) {
          local.status = item.status;
          local.selected = false;
          local.errorMessage = item.errorMessage;
        }
        const el = document.getElementById(`tweet-card-${item.id}`);
        if (el) {
          el.className = `tweet-card ${item.status}`;
        }
        this.updateBulkSelectionState();
      } else if (message.type === 'BATCH_JOB_LOG') {
        this.loggerView.log(message.message);
      } else if (message.type === 'BATCH_JOB_DONE') {
        this.progressBarView.hide();
        this.hideRunningBanner();
        KeepAwakeService.disable();
        this.bulkDeleteBtn.disabled = false;
        StorageService.getTweets().then((tweets) => {
          this.allTweets = tweets;
          this.syncTweetsToLists();
        });
        this.loggerView.log(
          `[FIM DO LOTE] Concluído! ${message.summary.successCount} excluídos, ${message.summary.failCount} com erro.`
        );
      }
    });
  }

  private async checkOngoingBackgroundJob(): Promise<void> {
    const savedLogs = await StorageService.getBatchJobLogs();
    if (savedLogs && savedLogs.length > 0) {
      for (const l of savedLogs.slice(-15)) {
        this.loggerView.log(l);
      }
    }

    chrome.runtime.sendMessage({ type: 'GET_BATCH_JOB_STATE' }, (state: BatchJobState) => {
      if (chrome.runtime.lastError || !state) return;
      if (state.status === 'running' || state.status === 'paused') {
        this.handleStateUpdate(state);
      }
    });
  }

  private handleStateUpdate(state: BatchJobState): void {
    if (state.status === 'running') {
      this.progressBarView.show();
      this.progressBarView.setPaused(false);
      this.progressBarView.update(state.current, state.total, state.message);
      this.showRunningBanner();
      this.bulkDeleteBtn.disabled = true;
      this.isBatchPaused = false;
      KeepAwakeService.enable();
    } else if (state.status === 'paused') {
      this.progressBarView.show();
      this.progressBarView.setPaused(true);
      this.progressBarView.update(state.current, state.total, state.message);
      this.showRunningBanner('Processo pausado em segundo plano.');
      this.bulkDeleteBtn.disabled = true;
      this.isBatchPaused = true;
    } else if (state.status === 'completed' || state.status === 'aborted') {
      this.progressBarView.hide();
      this.hideRunningBanner();
      KeepAwakeService.disable();
      this.bulkDeleteBtn.disabled = false;
      this.isBatchPaused = false;
      StorageService.getTweets().then((tweets) => {
        this.allTweets = tweets;
        this.syncTweetsToLists();
      });
    }
  }

  private showRunningBanner(text?: string): void {
    if (this.bgRunningBanner) {
      this.bgRunningBanner.style.display = 'flex';
    }
    if (this.bgRunningText && text) {
      this.bgRunningText.textContent = text;
    } else if (this.bgRunningText) {
      this.bgRunningText.textContent = 'Executando em segundo plano. Seguro para clicar fora ou minimizar.';
    }
  }

  private hideRunningBanner(): void {
    if (this.bgRunningBanner) {
      this.bgRunningBanner.style.display = 'none';
    }
  }

  private async loadInitialData(): Promise<void> {
    this.allTweets = await StorageService.getTweets();

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (activeTab?.url) {
        const usernameMatch = activeTab.url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})/i);
        const candidate = usernameMatch?.[1]?.toLowerCase();
        const reserved = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'compose', 'search', 'settings']);
        if (candidate && !reserved.has(candidate)) {
          const beforeCount = this.allTweets.length;
          this.allTweets = StorageService.filterValidUserTweets(this.allTweets, candidate);
          if (this.allTweets.length < beforeCount) {
            await StorageService.saveTweets(this.allTweets);
            this.loggerView.log(
              `[LIMPEZA AUTOMÁTICA] ${beforeCount - this.allTweets.length} resposta(s) de terceiros removida(s) do histórico local.`
            );
          }
        }
      }
    } catch {}

    this.syncTweetsToLists();
    this.loggerView.log(`Extensão carregada. ${this.allTweets.length} itens no histórico local.`);
  }

  private async checkSession(): Promise<void> {
    const session = await XSessionService.getSession();
    if (session.isLoggedIn) {
      this.sessionBadgeEl.className = 'session-status-badge logged-in';
      this.sessionBadgeEl.textContent = '🟢 Conectado ao X';
    } else {
      this.sessionBadgeEl.className = 'session-status-badge logged-out';
      this.sessionBadgeEl.textContent = '🟡 Login não detectado no X';
    }
  }

  private syncTweetsToLists(): void {
    this.tweetsListView.setTweets(this.allTweets);
    this.retweetsListView.setTweets(this.allTweets);

    const tweetsCount = this.allTweets.filter((t) => !t.isRetweet && t.status !== 'success').length;
    const rtsCount = this.allTweets.filter((t) => t.isRetweet && t.status !== 'success').length;

    this.badgeTweetsCount.textContent = String(tweetsCount);
    this.badgeRtsCount.textContent = String(rtsCount);

    this.updateBulkSelectionState();
  }

  private updateBulkSelectionState(): void {
    const selectedItems = this.allTweets.filter((t) => t.selected && t.status !== 'success');
    const selectedCount = selectedItems.length;

    if (selectedCount > 0) {
      this.bulkDeleteBtn.disabled = false;
      this.bulkDeleteBtn.textContent = `🗑️ Apagar Selecionados (${selectedCount})`;
      const tweetsSel = selectedItems.filter((t) => !t.isRetweet).length;
      const rtsSel = selectedItems.filter((t) => t.isRetweet).length;
      this.bulkSelectionLabel.textContent = `${selectedCount} item(ns) selecionado(s) (${tweetsSel} tweets, ${rtsSel} retweets)`;
    } else {
      this.bulkDeleteBtn.disabled = true;
      this.bulkDeleteBtn.textContent = '🗑️ Apagar Selecionados (0)';
      this.bulkSelectionLabel.textContent = 'Nenhum tweet selecionado';
    }
  }

  private async handleScanTimeline(): Promise<void> {
    this.scanBtn.disabled = true;
    this.scanBtn.textContent = '⏳ Varrendo...';
    this.loggerView.log('Iniciando varredura da timeline aberta...');
    await KeepAwakeService.enable();

    try {
      const tweets = await TimelineScannerService.startScan({
        onProgress: (found) => {
          this.loggerView.log(`Varredura em andamento: ${found} tweets visíveis encontrados...`);
        },
        onLog: (msg) => this.loggerView.log(msg)
      });

      this.allTweets = tweets;
      this.syncTweetsToLists();
      this.loggerView.log(`Varredura concluída com sucesso. Total em cache: ${tweets.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.loggerView.log(`[ERRO NA VARREDURA] ${msg}`);
      alert(`Atenção: ${msg}`);
    } finally {
      this.scanBtn.disabled = false;
      this.scanBtn.textContent = '🔍 Varrer Perfil';
      KeepAwakeService.disable();
    }
  }

  private async handleDeleteSingle(tweet: TweetItem): Promise<void> {
    if (!confirm(`Deseja apagar este ${tweet.isRetweet ? 'retweet' : 'tweet'} permanentemente?\n"${tweet.text.slice(0, 80)}..."`)) {
      return;
    }

    tweet.status = 'pending';
    this.syncTweetsToLists();
    this.loggerView.log(`Iniciando exclusão individual de ${tweet.id}...`);

    const config = this.settingsView.getConfig();
    const res = await DeletionExecutor.execute(tweet, config, { current: 1, total: 1 });

    if (res.success) {
      this.markTweetAsDeleted(tweet.id);
      this.loggerView.log(`✅ Tweet ${tweet.id} excluído com sucesso.`);
    } else {
      tweet.status = 'failed';
      tweet.errorMessage = res.error;
      this.syncTweetsToLists();
      this.loggerView.log(`❌ Falha ao excluir ${tweet.id}: ${res.error}`);
    }
    await DomDeleteService.finishSession(false).catch(() => {});
  }

  private async handleBulkDelete(): Promise<void> {
    const selected = this.allTweets.filter((t) => t.selected && t.status !== 'success');
    if (selected.length === 0) return;

    const confirmMsg = `ATENÇÃO: Ação irreversível!\n\nDeseja realmente excluir os ${selected.length} itens selecionados?\n\n(O processo continuará rodando em segundo plano mesmo se você clicar fora ou minimizar o navegador.)`;
    if (!confirm(confirmMsg)) return;

    const config = this.settingsView.getConfig();

    this.bulkDeleteBtn.disabled = true;
    this.progressBarView.show();
    this.progressBarView.setPaused(false);
    this.progressBarView.update(0, selected.length, `Iniciando lote de ${selected.length} itens em segundo plano...`);
    this.showRunningBanner();
    await KeepAwakeService.enable();

    this.loggerView.log(`[LOTE EM SEGUNDO PLANO] Enviando ${selected.length} item(ns) para processamento em background...`);

    const req: StartBatchJobRequest = {
      type: 'START_BATCH_JOB',
      items: this.allTweets,
      config
    };

    chrome.runtime.sendMessage(req, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        const err = chrome.runtime.lastError?.message || response?.error || 'Erro desconhecido ao iniciar lote no background';
        this.loggerView.log(`❌ [FALHA AO INICIAR LOTE] ${err}`);
        this.progressBarView.hide();
        this.hideRunningBanner();
        KeepAwakeService.disable();
        this.bulkDeleteBtn.disabled = false;
        alert(`Não foi possível iniciar o lote: ${err}`);
      } else {
        this.loggerView.log('⚡ Lote iniciado no background. Você pode fechar o popup, navegar ou minimizar o navegador com segurança!');
      }
    });
  }

  private markTweetAsDeleted(id: string): void {
    const item = this.allTweets.find((t) => t.id === id);
    if (item) {
      item.status = 'success';
      item.selected = false;
    }
    StorageService.saveTweets(this.allTweets);
    this.syncTweetsToLists();
  }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  const controller = new PopupController();
  controller.init().catch(console.error);
});
