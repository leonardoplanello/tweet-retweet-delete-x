/**
 * Serviço de exclusão via chamadas diretas aos endpoints internos do X (GraphQL e REST fallback).
 */
import { XSessionService } from './x-session-service';

export interface DeleteResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  isRateLimit?: boolean;
}

export class GraphqlDeleteService {
  // QueryIDs conhecidos para mutação de exclusão no X Web
  private static readonly KNOWN_DELETE_QUERY_IDS = [
    'VaenaVgh5q0MAfm4uMmKgA',
    '7_BAEr9FBSS24bh0YVa4kg',
    'bDE2rBtTNuW0W5vD8R1-6A'
  ];

  private static readonly KNOWN_UNRETWEET_QUERY_IDS = [
    'iQtK4dl5hBmXewZZUrEOgg',
    'ojPdsPpjeyd1IqfviUfTow',
    '_nL3j0rNq2y_hKq63uC2vw'
  ];

  /**
   * Exclui um Tweet via GraphQL ou endpoint REST interno.
   */
  static async deleteTweet(tweetId: string, customQueryId?: string): Promise<DeleteResult> {
    const session = await XSessionService.getSession();
    if (!session.csrfToken) {
      return {
        success: false,
        error: 'Sessão do X não encontrada. Abra o x.com no navegador para sincronizar seu login.'
      };
    }

    const queryIdsToTry = customQueryId
      ? [customQueryId, ...this.KNOWN_DELETE_QUERY_IDS]
      : this.KNOWN_DELETE_QUERY_IDS;

    // 1. Tenta GraphQL com queryIds conhecidos
    for (const qId of queryIdsToTry) {
      const url = `https://x.com/i/api/graphql/${qId}/DeleteTweet`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: this.buildHeaders(session.csrfToken),
          credentials: 'include',
          body: JSON.stringify({
            variables: {
              tweet_id: tweetId,
              dark_request: false
            },
            queryId: qId
          })
        });

        if (res.status === 200) {
          const body = await res.json().catch(() => ({}));
          // Verifica se houve erro nos erros internos do GraphQL
          if (body.errors && body.errors.length > 0) {
            const msg = body.errors[0]?.message || 'Erro interno no GraphQL';
            return { success: false, statusCode: 200, error: msg };
          }
          return { success: true, statusCode: 200 };
        }

        if (res.status === 429) {
          return { success: false, statusCode: 429, isRateLimit: true, error: 'Rate limit excedido (429)' };
        }
      } catch (err) {
        console.warn(`Tentativa GraphQL DeleteTweet com ${qId} falhou:`, err);
      }
    }

    // 2. Fallback para endpoint REST tradicional do X: /i/api/1.1/statuses/destroy/:id.json
    try {
      const restUrl = `https://x.com/i/api/1.1/statuses/destroy/${tweetId}.json`;
      const res = await fetch(restUrl, {
        method: 'POST',
        headers: this.buildHeaders(session.csrfToken),
        credentials: 'include'
      });

      if (res.status === 200 || res.status === 204) {
        return { success: true, statusCode: res.status };
      }
      if (res.status === 429) {
        return { success: false, statusCode: 429, isRateLimit: true, error: 'Rate limit excedido (429)' };
      }
      if (res.status === 404) {
        // Já não existe ou já foi apagado
        return { success: true, statusCode: 404, error: 'Tweet já excluído ou não encontrado (404)' };
      }

      return {
        success: false,
        statusCode: res.status,
        error: `Falha na requisição HTTP: ${res.status} ${res.statusText}`
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  /**
   * Desfaz um Retweet via GraphQL ou endpoint REST interno.
   */
  static async unretweet(tweetId: string, customQueryId?: string): Promise<DeleteResult> {
    const session = await XSessionService.getSession();
    if (!session.csrfToken) {
      return {
        success: false,
        error: 'Sessão do X não encontrada. Abra o x.com no navegador.'
      };
    }

    const queryIdsToTry = customQueryId
      ? [customQueryId, ...this.KNOWN_UNRETWEET_QUERY_IDS]
      : this.KNOWN_UNRETWEET_QUERY_IDS;

    // 1. Tenta GraphQL DeleteRetweet
    for (const qId of queryIdsToTry) {
      const url = `https://x.com/i/api/graphql/${qId}/DeleteRetweet`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: this.buildHeaders(session.csrfToken),
          credentials: 'include',
          body: JSON.stringify({
            variables: {
              source_tweet_id: tweetId,
              dark_request: false
            },
            queryId: qId
          })
        });

        if (res.status === 200) {
          return { success: true, statusCode: 200 };
        }
        if (res.status === 429) {
          return { success: false, statusCode: 429, isRateLimit: true, error: 'Rate limit excedido (429)' };
        }
      } catch (err) {
        console.warn(`Tentativa GraphQL DeleteRetweet com ${qId} falhou:`, err);
      }
    }

    // 2. Fallback REST para desunretweet: /i/api/1.1/statuses/unretweet/:id.json
    try {
      const restUrl = `https://x.com/i/api/1.1/statuses/unretweet/${tweetId}.json`;
      const res = await fetch(restUrl, {
        method: 'POST',
        headers: this.buildHeaders(session.csrfToken),
        credentials: 'include'
      });

      if (res.status === 200 || res.status === 204) {
        return { success: true, statusCode: res.status };
      }
      if (res.status === 429) {
        return { success: false, statusCode: 429, isRateLimit: true, error: 'Rate limit (429)' };
      }
      return {
        success: false,
        statusCode: res.status,
        error: `Falha HTTP: ${res.status}`
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  private static buildHeaders(csrfToken: string): HeadersInit {
    return {
      authorization: XSessionService.WEB_BEARER_TOKEN,
      'x-csrf-token': csrfToken,
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-client-language': 'pt',
      'content-type': 'application/json'
    };
  }
}
