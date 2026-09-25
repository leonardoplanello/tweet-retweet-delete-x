/**
 * Serviço para orquestração de exclusão via DOM usando aba dedicada do Chrome.
 */
import { DeleteResult } from './graphql-delete-service';
import { AutomationTabService, AutomationProgressInfo } from './automation-tab-service';

export class DomDeleteService {
  /**
   * Executa a exclusão de um tweet via automação DOM na aba dedicada.
   */
  static async deleteTweet(
    tweetId: string,
    progress?: AutomationProgressInfo,
    tweetUrl?: string,
    targetAuthor?: string
  ): Promise<DeleteResult> {
    return AutomationTabService.getInstance().executeOnTweet(tweetId, false, progress, tweetUrl, targetAuthor);
  }

  /**
   * Desfaz um Retweet via automação DOM na aba dedicada.
   */
  static async unretweet(
    tweetId: string,
    progress?: AutomationProgressInfo,
    tweetUrl?: string,
    targetAuthor?: string
  ): Promise<DeleteResult> {
    return AutomationTabService.getInstance().executeOnTweet(tweetId, true, progress, tweetUrl, targetAuthor);
  }

  /**
   * Encerra a sessão da aba de automação (limpa HUD ou fecha aba se foi criada pela extensão).
   */
  static async finishSession(closeTab: boolean = true): Promise<void> {
    return AutomationTabService.getInstance().cleanup(closeTab);
  }
}
