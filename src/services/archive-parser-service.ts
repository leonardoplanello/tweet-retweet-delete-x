/**
 * Serviço para processamento de arquivos exportados do Twitter Archive (tweets.js ou .json).
 */
import { TweetItem } from '../types/tweet';

export class ArchiveParserService {
  /**
   * Processa o conteúdo de um arquivo de arquivo do Twitter (tweets.js / tweet.js ou JSON puro).
   */
  static parse(fileContent: string): TweetItem[] {
    let cleanJson = fileContent.trim();

    // Remove atribuição JS window.YTD.tweet*.part0 = [...]
    if (cleanJson.startsWith('window.YTD')) {
      const equalsIdx = cleanJson.indexOf('=');
      if (equalsIdx !== -1) {
        cleanJson = cleanJson.substring(equalsIdx + 1).trim();
      }
    }

    // Remove eventual ponto e vírgula no final
    if (cleanJson.endsWith(';')) {
      cleanJson = cleanJson.slice(0, -1).trim();
    }

    let parsedArray: any[];
    try {
      parsedArray = JSON.parse(cleanJson);
    } catch (e) {
      throw new Error('Formato de arquivo inválido. Certifique-se de selecionar o arquivo tweets.js ou .json da exportação do X.');
    }

    if (!Array.isArray(parsedArray)) {
      throw new Error('Conteúdo do arquivo não é uma lista de tweets válida.');
    }

    const items: TweetItem[] = [];

    for (const entry of parsedArray) {
      const t = entry.tweet || entry;
      const id = String(t.id_str || t.id || '');
      if (!id) continue;

      const fullText: string = t.full_text || t.text || '';
      const isRetweet = Boolean(
        t.retweeted ||
        fullText.startsWith('RT @') ||
        t.retweeted_status ||
        t.retweeted_status_id_str
      );

      let retweetedFrom: string | undefined;
      if (isRetweet && fullText.startsWith('RT @')) {
        const match = fullText.match(/^RT @([a-zA-Z0-9_]+):/);
        if (match) {
          retweetedFrom = `@${match[1]}`;
        }
      }

      // Mídias
      const mediaUrls: string[] = [];
      const mediaEntities = t.entities?.media || t.extended_entities?.media || [];
      for (const m of mediaEntities) {
        if (m.media_url_https) {
          mediaUrls.push(m.media_url_https);
        }
      }

      items.push({
        id,
        text: fullText,
        createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
        isRetweet,
        retweetedFrom,
        mediaUrls,
        url: `https://x.com/i/status/${id}`,
        selected: false,
        status: 'idle'
      });
    }

    return items;
  }
}
