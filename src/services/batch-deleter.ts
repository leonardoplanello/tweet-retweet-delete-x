/**
 * Orquestrador de exclusão em lote com rate-limiting, cooldown, persistência contínua e feedback na UI.
 */
import { TweetItem } from '../types/tweet';
import { ExtensionConfig } from '../types/config';
import { DeletionExecutor } from './deletion-executor';
import { DomDeleteService } from './dom-delete-service';
import { RateLimiter } from './rate-limiter';
import { StorageService } from './storage-service';

export interface BatchDeleterCallbacks {
  onProgress: (current: number, total: number, currentItem: TweetItem, message?: string) => void;
  onItemCompleted: (item: TweetItem, success: boolean) => void;
  onLog: (msg: string) => void;
  onDone: (summary: { successCount: number; failCount: number }) => void;
  onHeartbeat?: () => void;
}

export class BatchDeleter {
  private rateLimiter: RateLimiter = new RateLimiter();
  private isRunning: boolean = false;

  public async start(
    items: TweetItem[],
    config: ExtensionConfig,
    callbacks: BatchDeleterCallbacks
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error('Já existe um processo de exclusão em andamento.');
    }

    this.isRunning = true;
    this.rateLimiter.reset();

    const toProcess = items.filter((t) => t.selected && t.status !== 'success');
    const total = toProcess.length;
    let successCount = 0;
    let failCount = 0;

    callbacks.onLog(`[INÍCIO DO LOTE] Iniciando exclusão de ${total} item(ns)... Método: ${config.method.toUpperCase()}`);

    try {
      for (let i = 0; i < total; i++) {
        if (this.rateLimiter.aborted) {
          callbacks.onLog('[CANCELADO] Operação cancelada pelo usuário.');
          break;
        }

        const item = toProcess[i];
        item.status = 'pending';
        callbacks.onProgress(i + 1, total, item, `Processando ${i + 1} de ${total}: Tweet ${item.id}`);
        callbacks.onLog(`[${i + 1}/${total}] Excluindo ${item.isRetweet ? 'Retweet' : 'Tweet'} ID: ${item.id}...`);

        let result = await DeletionExecutor.execute(item, config, {
          current: i + 1,
          total
        });

        // Tratamento de Rate Limit (HTTP 429)
        if (result.isRateLimit && config.autoPauseOnRateLimit) {
          callbacks.onLog(`⚠️ [RATE LIMIT 429 DETECTADO] Pausando por ${config.rateLimitCooldownSeconds} segundos para segurança...`);
          await this.rateLimiter.cooldown(
            config.rateLimitCooldownSeconds,
            (sec) => {
              callbacks.onProgress(i + 1, total, item, `Rate Limit atingido. Aguardando ${sec}s para retomar com segurança...`);
            },
            callbacks.onHeartbeat
          );

          // Nova tentativa após o cooldown
          callbacks.onLog(`Retomando tentativa para o Tweet ${item.id}...`);
          result = await DeletionExecutor.execute(item, config, {
            current: i + 1,
            total
          });
        }

        if (result.success) {
          item.status = 'success';
          item.selected = false;
          successCount++;
          callbacks.onLog(`✅ [SUCESSO] ${item.isRetweet ? 'Retweet' : 'Tweet'} ${item.id} removido.`);
        } else {
          item.status = 'failed';
          item.errorMessage = result.error || 'Falha na exclusão';
          failCount++;
          callbacks.onLog(`❌ [FALHA] Tweet ${item.id}: ${item.errorMessage}`);
        }

        callbacks.onItemCompleted(item, result.success);

        // Salva periodicamente no storage após cada exclusão para garantir persistência imediata
        await StorageService.mergeTweets(items).catch(() => {});

        // Se houver mais itens, aplica o atraso seguro configurado
        if (i < total - 1 && !this.rateLimiter.aborted) {
          await this.rateLimiter.wait(
            config.minDelayMs,
            config.maxDelayMs,
            (remainingMs) => {
              callbacks.onProgress(i + 1, total, item, `Aguardando ${(remainingMs / 1000).toFixed(1)}s (Cadência Segura)...`);
            },
            callbacks.onHeartbeat
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onLog(`[ERRO NO LOTE] ${msg}`);
    } finally {
      this.isRunning = false;
      await StorageService.mergeTweets(items);
      // Finaliza sessão da aba de automação
      await DomDeleteService.finishSession(true).catch(() => {});
      callbacks.onDone({ successCount, failCount });
    }
  }

  public pause(): void {
    this.rateLimiter.pause();
  }

  public resume(): void {
    this.rateLimiter.resume();
  }

  public abort(): void {
    this.rateLimiter.abort();
    DomDeleteService.finishSession(false).catch(() => {});
  }

  public get running(): boolean {
    return this.isRunning;
  }

  public get paused(): boolean {
    return this.rateLimiter.paused;
  }
}
