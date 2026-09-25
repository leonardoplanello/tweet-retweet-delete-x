/**
 * Executor unificado de exclusão que implementa estratégias DOM (UI Direta), GraphQL e Híbrida com fallback.
 */
import { TweetItem } from '../types/tweet';
import { ExtensionConfig } from '../types/config';
import { GraphqlDeleteService, DeleteResult } from './graphql-delete-service';
import { DomDeleteService } from './dom-delete-service';
import { StorageService } from './storage-service';
import { AutomationProgressInfo } from './automation-tab-service';

export class DeletionExecutor {
  /**
   * Exclui um item (tweet ou retweet) de acordo com a estratégia configurada.
   */
  static async execute(
    item: TweetItem,
    config: ExtensionConfig,
    progress?: AutomationProgressInfo
  ): Promise<DeleteResult> {
    const isRetweet = item.isRetweet;
    let result: DeleteResult = { success: false };

    if (config.method === 'dom') {
      result = isRetweet
        ? await DomDeleteService.unretweet(item.id, progress, item.url, item.authorHandle)
        : await DomDeleteService.deleteTweet(item.id, progress, item.url, item.authorHandle);
    } else if (config.method === 'graphql') {
      result = isRetweet
        ? await GraphqlDeleteService.unretweet(item.id, config.customUnretweetQueryId)
        : await GraphqlDeleteService.deleteTweet(item.id, config.customDeleteQueryId);
    } else {
      // Modo Híbrido: tenta GraphQL primeiro
      result = isRetweet
        ? await GraphqlDeleteService.unretweet(item.id, config.customUnretweetQueryId)
        : await GraphqlDeleteService.deleteTweet(item.id, config.customDeleteQueryId);

      // Se falhar e não for 429 de rate limit, tenta via DOM com navegação
      if (!result.success && !result.isRateLimit) {
        console.warn(`Tentativa GraphQL falhou para ${item.id}. Tentando fallback visual via DOM...`);
        result = isRetweet
          ? await DomDeleteService.unretweet(item.id, progress, item.url, item.authorHandle)
          : await DomDeleteService.deleteTweet(item.id, progress, item.url, item.authorHandle);
      }
    }

    if (result.success) {
      await StorageService.markDeletedId(item.id);
    }

    return result;
  }
}
