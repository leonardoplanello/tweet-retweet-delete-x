/**
 * Componente de renderização do Card de Tweet/Retweet individual.
 */
import { TweetItem } from '../types/tweet';

export class TweetCard {
  /**
   * Renderiza o elemento HTML de um item da lista.
   */
  static render(
    tweet: TweetItem,
    onToggleSelect: (id: string, selected: boolean) => void,
    onDeleteSingle?: (tweet: TweetItem) => void
  ): HTMLElement {
    const card = document.createElement('div');
    card.className = `tweet-card ${tweet.status} ${tweet.selected ? 'selected' : ''}`;
    card.id = `tweet-card-${tweet.id}`;

    const dateStr = this.formatDate(tweet.createdAt);
    const badgeType = tweet.isRetweet ? '🔁 Retweet' : '💬 Tweet';
    const badgeClass = tweet.isRetweet ? 'badge-retweet' : 'badge-tweet';

    let statusText = '';
    if (tweet.status === 'pending') statusText = '⏳ Apagando...';
    else if (tweet.status === 'success') statusText = '✅ Excluído';
    else if (tweet.status === 'failed') statusText = `❌ Erro: ${tweet.errorMessage || 'Falhou'}`;

    card.innerHTML = `
      <div class="tweet-card-header">
        <label class="tweet-checkbox-container">
          <input type="checkbox" class="tweet-checkbox" data-id="${tweet.id}" ${tweet.selected ? 'checked' : ''} ${tweet.status === 'success' ? 'disabled' : ''}/>
          <span class="checkmark"></span>
        </label>
        <span class="badge ${badgeClass}">${badgeType}</span>
        <span class="tweet-date">${dateStr}</span>
        <a href="${tweet.url}" target="_blank" rel="noopener noreferrer" class="tweet-link" title="Abrir no X">🔗</a>
      </div>
      <div class="tweet-card-body">
        ${tweet.retweetedFrom ? `<div class="retweet-author">Retweetado de <strong>${tweet.retweetedFrom}</strong></div>` : ''}
        ${!tweet.isRetweet && tweet.authorHandle ? `<div class="tweet-author-tag" style="font-size: 11px; color: #8899a6; margin-bottom: 4px;">Por <strong>@${tweet.authorHandle}</strong></div>` : ''}
        <div class="tweet-text">${this.escapeHtml(tweet.text)}</div>
        ${statusText ? `<div class="tweet-status-label ${tweet.status}">${statusText}</div>` : ''}
      </div>
      <div class="tweet-card-actions">
        ${
          tweet.status !== 'success' && onDeleteSingle
            ? `<button type="button" class="btn-single-delete" title="Apagar apenas este">🗑️</button>`
            : ''
        }
      </div>
    `;

    // Eventos
    const checkbox = card.querySelector<HTMLInputElement>('.tweet-checkbox');
    checkbox?.addEventListener('change', (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      card.classList.toggle('selected', isChecked);
      onToggleSelect(tweet.id, isChecked);
    });

    const singleDelBtn = card.querySelector<HTMLButtonElement>('.btn-single-delete');
    singleDelBtn?.addEventListener('click', () => {
      if (onDeleteSingle) {
        onDeleteSingle(tweet);
      }
    });

    return card;
  }

  private static formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  }

  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
