/**
 * Orquestrador do processamento em lote no Background Service Worker.
 * Garante que a exclusão continue mesmo se o usuário fechar o popup, clicar fora ou minimizar o navegador.
 */
import { TweetItem } from '../types/tweet';
import { ExtensionConfig } from '../types/config';
import { BatchJobState, BatchJobSummary } from '../types/batch-job';
import {
  BatchJobStateUpdateMessage,
  BatchJobLogMessage,
  BatchJobItemCompletedMessage,
  BatchJobDoneMessage
} from '../types/messages';
import { BatchDeleter } from './batch-deleter';
import { StorageService } from './storage-service';

const ALARM_KEEPALIVE_NAME = 'tweet_purge_keepalive';

export class BackgroundJobService {
  private static instance: BackgroundJobService;
  private batchDeleter: BatchDeleter = new BatchDeleter();
  private currentState: BatchJobState = {
    status: 'idle',
    total: 0,
    current: 0,
    currentItem: null,
    successCount: 0,
    failCount: 0,
    message: 'Nenhum processamento em andamento'
  };

  private constructor() {
    this.restoreState();
  }

  public static getInstance(): BackgroundJobService {
    if (!this.instance) {
      this.instance = new BackgroundJobService();
    }
    return this.instance;
  }

  private async restoreState(): Promise<void> {
    try {
      const saved = await StorageService.getBatchJobState();
      if (saved) {
        // Se foi salvo como running mas o worker reiniciou, ajusta para pausado ou restaura
        this.currentState = saved;
      }
    } catch (e) {
      console.warn('Erro ao restaurar estado do job:', e);
    }
  }

  public async getState(): Promise<BatchJobState> {
    const saved = await StorageService.getBatchJobState();
    if (saved) {
      this.currentState = saved;
    }
    return this.currentState;
  }

  public async startJob(items: TweetItem[], config: ExtensionConfig): Promise<void> {
    if (this.batchDeleter.running) {
      throw new Error('Já existe uma exclusão em lote em andamento no plano de fundo.');
    }

    const toProcess = items.filter((t) => t.selected && t.status !== 'success');
    if (toProcess.length === 0) {
      throw new Error('Nenhum item válido selecionado para exclusão.');
    }

    // Inicia alarme periódico para manter o Service Worker acordado no MV3
    try {
      chrome.alarms.create(ALARM_KEEPALIVE_NAME, { periodInMinutes: 0.35 });
    } catch {}

    this.currentState = {
      status: 'running',
      total: toProcess.length,
      current: 0,
      currentItem: null,
      successCount: 0,
      failCount: 0,
      message: `Iniciando lote de ${toProcess.length} itens...`,
      startedAt: Date.now(),
      updatedAt: Date.now()
    };
    await this.updateAndBroadcastState();

    // Executa em segundo plano sem travar a chamada original
    this.executeLoop(items, config).catch(async (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      await this.log(`[ERRO CRÍTICO NO BACKGROUND] ${msg}`);
      this.currentState.status = 'aborted';
      this.currentState.message = `Erro: ${msg}`;
      await this.updateAndBroadcastState();
    });
  }

  private async executeLoop(items: TweetItem[], config: ExtensionConfig): Promise<void> {
    await this.batchDeleter.start(items, config, {
      onProgress: async (current, total, currentItem, msg) => {
        this.currentState.current = current;
        this.currentState.total = total;
        this.currentState.currentItem = currentItem;
        this.currentState.message = msg || `Item ${current} de ${total}`;
        this.currentState.updatedAt = Date.now();
        await this.updateAndBroadcastState();
      },
      onItemCompleted: async (item, success) => {
        if (success) {
          this.currentState.successCount++;
        } else {
          this.currentState.failCount++;
        }
        this.currentState.updatedAt = Date.now();
        await this.updateAndBroadcastState();

        const itemMsg: BatchJobItemCompletedMessage = {
          type: 'BATCH_JOB_ITEM_COMPLETED',
          item,
          success
        };
        this.safeSendMessage(itemMsg);
      },
      onLog: async (msg) => {
        await this.log(msg);
      },
      onDone: async (summary) => {
        this.currentState.status = 'completed';
        this.currentState.message = `Concluído: ${summary.successCount} sucesso(s), ${summary.failCount} falha(s).`;
        this.currentState.updatedAt = Date.now();
        await this.updateAndBroadcastState();

        const doneMsg: BatchJobDoneMessage = {
          type: 'BATCH_JOB_DONE',
          summary: {
            successCount: summary.successCount,
            failCount: summary.failCount,
            total: this.currentState.total
          }
        };
        this.safeSendMessage(doneMsg);

        // Remove alarme de keepalive ao finalizar
        try {
          chrome.alarms.clear(ALARM_KEEPALIVE_NAME);
        } catch {}
      },
      onHeartbeat: () => {
        // Chamada dummy a API chrome para redefinir o temporizador de inatividade do Service Worker
        chrome.runtime.getPlatformInfo().catch(() => {});
      }
    });
  }

  public async pauseJob(): Promise<void> {
    this.batchDeleter.pause();
    this.currentState.status = 'paused';
    this.currentState.message = 'Execução em segundo plano pausada.';
    this.currentState.updatedAt = Date.now();
    await this.updateAndBroadcastState();
    await this.log('⏸️ Processo em segundo plano pausado.');
  }

  public async resumeJob(): Promise<void> {
    this.batchDeleter.resume();
    this.currentState.status = 'running';
    this.currentState.message = 'Execução em segundo plano retomada.';
    this.currentState.updatedAt = Date.now();
    await this.updateAndBroadcastState();
    await this.log('▶️ Processo em segundo plano retomado.');
  }

  public async cancelJob(): Promise<void> {
    this.batchDeleter.abort();
    this.currentState.status = 'aborted';
    this.currentState.message = 'Operação cancelada pelo usuário.';
    this.currentState.updatedAt = Date.now();
    await this.updateAndBroadcastState();
    await this.log('❌ Cancelamento solicitado pelo usuário.');

    try {
      chrome.alarms.clear(ALARM_KEEPALIVE_NAME);
    } catch {}
  }

  public async handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    if (alarm.name === ALARM_KEEPALIVE_NAME) {
      // Keepalive ping: executa operação leve no chrome API para redefinir timer do service worker
      await chrome.storage.local.get('x_keepalive_ping').catch(() => {});
    }
  }

  private async updateAndBroadcastState(): Promise<void> {
    await StorageService.saveBatchJobState(this.currentState);
    const msg: BatchJobStateUpdateMessage = {
      type: 'BATCH_JOB_STATE_UPDATE',
      state: this.currentState
    };
    this.safeSendMessage(msg);
  }

  private async log(message: string): Promise<void> {
    const timeStr = new Date().toLocaleTimeString('pt-BR');
    const fullMessage = `[${timeStr}] ${message}`;
    await StorageService.appendBatchJobLog(fullMessage);

    const logMsg: BatchJobLogMessage = {
      type: 'BATCH_JOB_LOG',
      message
    };
    this.safeSendMessage(logMsg);
  }

  private safeSendMessage(message: any): void {
    try {
      chrome.runtime.sendMessage(message).catch(() => {
        // Ignora se não houver popup ou abas ouvindo no momento
      });
    } catch {}
  }
}
