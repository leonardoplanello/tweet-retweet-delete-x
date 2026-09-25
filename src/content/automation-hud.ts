/**
 * Banner flutuante (HUD) injetado na aba do X durante a automação de exclusão.
 * Fornece feedback visual em tempo real para o usuário sem interferir no conteúdo da página.
 */
export class AutomationHud {
  private static readonly HUD_ID = '__tweet_purge_automation_hud__';

  /**
   * Exibe ou atualiza o HUD com informações de progresso do tweet atual.
   */
  static showProgress(current: number, total: number, tweetId: string, statusText?: string): void {
    const el = this.getOrCreateContainer();
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;

    el.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px; animation: spin 2s linear infinite; display: inline-block;">⚙️</span>
          <div>
            <div style="font-weight: 700; font-size: 13px; color: #ffffff;">
              Tweet Delete: Deleting ${current} of ${total} (${percent}%)
            </div>
            <div style="font-size: 11px; color: #a0aec0; margin-top: 1px;">
              ${statusText || `Tweet ID: ${tweetId}`}
            </div>
          </div>
        </div>
        <div style="font-size: 10px; background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.4); white-space: nowrap;">
          ⚠️ Do not close this tab
        </div>
      </div>
      <div style="width: 100%; background: #374151; height: 4px; border-radius: 2px; margin-top: 8px; overflow: hidden;">
        <div style="width: ${percent}%; background: #1d9bf0; height: 100%; transition: width 0.3s ease;"></div>
      </div>
    `;
  }

  /**
   * Atualiza a mensagem de status exibida no banner.
   */
  static updateStatus(message: string): void {
    const el = document.getElementById(this.HUD_ID);
    if (!el) return;
    const sub = el.querySelector('div[style*="font-size: 11px"]');
    if (sub) {
      sub.textContent = message;
    }
  }

  /**
   * Remove o banner do DOM.
   */
  static remove(): void {
    const el = document.getElementById(this.HUD_ID);
    if (el) {
      el.remove();
    }
  }

  private static getOrCreateContainer(): HTMLElement {
    let el = document.getElementById(this.HUD_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = this.HUD_ID;
      el.setAttribute(
        'style',
        `
        position: fixed !important;
        top: 16px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 2147483647 !important;
        background: #15202b !important;
        color: #ffffff !important;
        border: 1px solid #38444d !important;
        border-radius: 10px !important;
        padding: 10px 16px !important;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        min-width: 380px !important;
        max-width: 520px !important;
        pointer-events: auto !important;
      `
      );

      // Injeta keyframe simples se não existir
      if (!document.getElementById('__tweet_purge_hud_styles__')) {
        const style = document.createElement('style');
        style.id = '__tweet_purge_hud_styles__';
        style.textContent = `
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `;
        document.head?.appendChild(style);
      }

      document.body.appendChild(el);
    }
    return el;
  }
}
