/**
 * Módulo de automação visual via DOM para exclusão de tweets e cancelamento de retweets.
 * Suporta threads, conversas, respostas assíncronas do React, detecção de 404 e seleção precisa por autor e ID.
 */
import { AutomationHud } from './automation-hud';

export interface DomDeleteOptions {
  current?: number;
  total?: number;
  targetAuthor?: string;
}

interface ScoredArticle {
  article: Element;
  score: number;
  index: number;
}

export class DomClicker {
  /**
   * Aguarda um elemento aparecer no DOM com timeout configurável.
   */
  private static async waitForElement<T extends Element>(
    selector: string,
    timeoutMs: number = 5000,
    parent: ParentNode = document
  ): Promise<T | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = parent.querySelector<T>(selector);
      if (el) return el;
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  }

  /**
   * Dispara sequência completa de eventos (pointerdown, mousedown, pointerup, mouseup, click)
   * no elemento button para garantir compatibilidade com o React 18 do X.
   */
  private static dispatchSafeClick(element: HTMLElement): void {
    const target = (element.closest('button') || element) as HTMLElement;
    try {
      target.focus();
    } catch {}

    const rect = target.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX,
      clientY
    };

    try {
      target.dispatchEvent(new PointerEvent('pointerdown', eventInit));
    } catch {}
    target.dispatchEvent(new MouseEvent('mousedown', eventInit));
    try {
      target.dispatchEvent(new PointerEvent('pointerup', eventInit));
    } catch {}
    target.dispatchEvent(new MouseEvent('mouseup', eventInit));
    target.click();
  }

  /**
   * Fecha menus popover ou modais abertos pressionando Escape e clicando no body.
   */
  private static closeOpenMenus(): void {
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      document.body.click();
    } catch {}
  }

  /**
   * Detecta se a página exibe erro 404, post inexistente ou já apagado.
   */
  private static isTweetUnavailable(): boolean {
    const pageText = document.body.innerText || '';
    const indicators = [
      'Este post não está disponível',
      'This post is unavailable',
      'Hmm... essa página não existe',
      'Hmm... this page doesn’t exist',
      'Hmm... this page doesn\'t exist',
      'Esta conta foi suspensa',
      'This account has been suspended',
      'Não foi possível carregar o post',
      'Post not found'
    ];

    for (const indicator of indicators) {
      if (pageText.includes(indicator)) {
        return true;
      }
    }

    const errorEl = document.querySelector('[data-testid="error-detail"], [data-testid="empty_state_header_text"]');
    return Boolean(errorEl);
  }

  /**
   * Obtém o handle do autor a partir da URL da página ou do switcher de conta.
   */
  private static getTargetAuthorFromPage(): string | null {
    const pathMatch = window.location.pathname.match(/\/([a-zA-Z0-9_]{1,15})\/status/i);
    if (pathMatch) {
      const candidate = pathMatch[1].toLowerCase();
      if (candidate !== 'i') return candidate;
    }

    const switcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (switcher) {
      const match = (switcher.textContent || '').match(/@([a-zA-Z0-9_]{1,15})/);
      if (match) return match[1].toLowerCase();
    }

    return null;
  }

  /**
   * Avalia e pontua todos os artigos de tweet presentes na página para selecionar
   * especificamente o post do usuário dono, ignorando posts de terceiros em threads.
   */
  private static rankArticles(tweetId?: string, targetAuthor?: string | null): ScoredArticle[] {
    const articles = Array.from(document.querySelectorAll<Element>('article[data-testid="tweet"]'));
    if (articles.length === 0) return [];

    const scored = articles.map((article, index) => {
      let score = 0;
      const articleHtml = article.innerHTML || '';

      // 1. Correspondência exata do ID do tweet nos links internos
      if (tweetId) {
        if (article.querySelector(`a[href*="/status/${tweetId}"]`)) {
          score += 200;
        } else if (articleHtml.includes(tweetId)) {
          score += 100;
        }

        // Se o artigo possui link para OUTRO status diferente do tweetId, penaliza (é outro tweet na thread)
        const otherStatusLink = article.querySelector('a[href*="/status/"]');
        if (otherStatusLink && !article.querySelector(`a[href*="/status/${tweetId}"]`)) {
          score -= 50;
        }
      }

      // 2. Correspondência do autor (@username) no cabeçalho do tweet
      if (targetAuthor) {
        const userEl = article.querySelector('[data-testid="User-Name"]');
        const userText = userEl ? (userEl.textContent || '').toLowerCase() : '';
        if (userText.includes(`@${targetAuthor.toLowerCase()}`)) {
          score += 80;
        } else if (userText.length > 0) {
          // Pertence a outro autor conhecido na conversa
          score -= 40;
        }
      }

      // 3. Post com botão unretweet
      if (article.querySelector('[data-testid="unretweet"]')) {
        score += 30;
      }

      return { article, score, index };
    });

    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    return scored;
  }

  /**
   * Localiza o botão "..." (caret) de um artigo de tweet.
   */
  private static findCaretButton(article: Element): HTMLElement | null {
    const btn = article.querySelector<HTMLElement>(
      'button[data-testid="caret"], [data-testid="caret"], button[aria-haspopup="menu"], button[aria-label*="Mais"], button[aria-label*="More"]'
    );
    if (btn) {
      return (btn.closest('button') || btn) as HTMLElement;
    }
    return null;
  }

  /**
   * Localiza o item "Excluir" dentro do menu Dropdown aberto.
   */
  private static findDeleteMenuItem(menu: HTMLElement): HTMLElement | null {
    const items = Array.from(
      menu.querySelectorAll<HTMLElement>(
        '[role="menuitem"], [data-testid="Dropdown"] > div, div[tabindex="0"], div[data-testid="delete"]'
      )
    );
    return (
      items.find((el) => {
        const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
        return (
          txt.includes('excluir') ||
          txt.includes('delete') ||
          txt.includes('apagar') ||
          el.getAttribute('data-testid') === 'delete'
        );
      }) || null
    );
  }

  /**
   * Localiza o botão de confirmação dentro do modal de exclusão.
   */
  private static async findConfirmButton(): Promise<HTMLElement | null> {
    const confirmBtn = await this.waitForElement<HTMLElement>(
      '[data-testid="confirmationSheetConfirm"], button[data-testid="confirmationSheetConfirm"]',
      3500
    );
    if (confirmBtn) return (confirmBtn.closest('button') || confirmBtn) as HTMLElement;

    const dialog = document.querySelector('[role="dialog"], [data-testid="sheetDialog"]');
    if (dialog) {
      const btns = Array.from(dialog.querySelectorAll<HTMLElement>('button'));
      const match = btns.find((b) => {
        const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
        return (
          (txt.includes('excluir') || txt.includes('delete') || txt.includes('apagar')) &&
          !txt.includes('cancel')
        );
      });
      if (match) return match;
    }

    return null;
  }

  /**
   * Exclui um tweet através de cliques na interface do X.
   */
  static async deleteTweetByDom(
    tweetId?: string,
    options?: DomDeleteOptions
  ): Promise<{ success: boolean; error?: string; alreadyDeleted?: boolean }> {
    try {
      if (options?.current && options?.total && tweetId) {
        AutomationHud.showProgress(options.current, options.total, tweetId, 'Localizando post...');
      }

      await new Promise((r) => setTimeout(r, 600));

      if (this.isTweetUnavailable()) {
        if (options?.current && options?.total && tweetId) {
          AutomationHud.showProgress(options.current, options.total, tweetId, 'Post já não existe (404/Removido).');
        }
        return { success: true, alreadyDeleted: true };
      }

      const targetAuthor = options?.targetAuthor || this.getTargetAuthorFromPage();

      // 1. Aguarda até que o tweet alvo (do autor ou com o ID) seja renderizado na tela
      const startWait = Date.now();
      let candidates: ScoredArticle[] = [];

      while (Date.now() - startWait < 12000) {
        if (this.isTweetUnavailable()) {
          return { success: true, alreadyDeleted: true };
        }

        candidates = this.rankArticles(tweetId, targetAuthor);

        // Se encontramos um candidato qualificado (com score positivo compatível), prossegue
        if (candidates.length > 0 && (candidates[0].score >= 40 || candidates.length === 1)) {
          break;
        }

        await new Promise((r) => setTimeout(r, 300));
      }

      if (candidates.length === 0) {
        if (this.isTweetUnavailable()) {
          return { success: true, alreadyDeleted: true };
        }
        return {
          success: false,
          error: `Tweet ${tweetId || ''} não carregou na página visível do X a tempo.`
        };
      }

      // 2. Itera pelos candidatos por ordem de relevância
      for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        const candidate = item.article;

        try {
          candidate.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {}
        await new Promise((r) => setTimeout(r, 400));

        const caretBtn = this.findCaretButton(candidate);
        if (!caretBtn) {
          // Se não possui caret mas tem unretweet, pode ser um retweet
          const unretweetBtn = candidate.querySelector<HTMLElement>('[data-testid="unretweet"]');
          if (unretweetBtn) {
            return this.unretweetByDom(tweetId, options);
          }
          continue;
        }

        if (options?.current && options?.total && tweetId) {
          AutomationHud.showProgress(
            options.current,
            options.total,
            tweetId,
            candidates.length > 1 ? `Checking post (${i + 1}/${candidates.length})...` : 'Opening options menu...'
          );
        }

        this.dispatchSafeClick(caretBtn);

        // Aguarda dropdown menu abrir
        await new Promise((r) => setTimeout(r, 350));
        const menu = await this.waitForElement<HTMLElement>('[data-testid="Dropdown"], [role="menu"]', 3000);
        if (!menu) {
          this.closeOpenMenus();
          continue;
        }

        // Procura a opção "Excluir"
        const deleteItem = this.findDeleteMenuItem(menu);

        if (!deleteItem) {
          // Este artigo é de outro autor na conversa (ex: post pai)
          this.closeOpenMenus();
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }

        // Encontrou o tweet correto com a opção Excluir!
        if (options?.current && options?.total && tweetId) {
          AutomationHud.showProgress(options.current, options.total, tweetId, 'Confirming deletion...');
        }

        this.dispatchSafeClick(deleteItem);

        // Aguarda e clica na confirmação
        await new Promise((r) => setTimeout(r, 400));
        const confirmBtn = await this.findConfirmButton();

        if (!confirmBtn) {
          return { success: false, error: 'Delete confirmation button did not appear.' };
        }

        this.dispatchSafeClick(confirmBtn);
        await new Promise((r) => setTimeout(r, 800));

        if (options?.current && options?.total && tweetId) {
          AutomationHud.showProgress(options.current, options.total, tweetId, '✅ Tweet deleted successfully.');
        }

        return { success: true };
      }

      // Verificação final para retweets
      for (const item of candidates) {
        const unretweetBtn = item.article.querySelector<HTMLElement>('[data-testid="unretweet"]');
        if (unretweetBtn) {
          return this.unretweetByDom(tweetId, options);
        }
      }

      return {
        success: false,
        error: 'Delete option not found in menu (verify that the connected account owns this post).'
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  /**
   * Desfaz um Retweet através de cliques no DOM.
   */
  static async unretweetByDom(
    tweetId?: string,
    options?: DomDeleteOptions
  ): Promise<{ success: boolean; error?: string; alreadyDeleted?: boolean }> {
    try {
      if (options?.current && options?.total && tweetId) {
        AutomationHud.showProgress(options.current, options.total, tweetId, 'Locating Retweet...');
      }

      await new Promise((r) => setTimeout(r, 600));

      if (this.isTweetUnavailable()) {
        return { success: true, alreadyDeleted: true };
      }

      const targetAuthor = options?.targetAuthor || this.getTargetAuthorFromPage();
      const startWait = Date.now();
      let candidates: ScoredArticle[] = [];

      while (Date.now() - startWait < 12000) {
        candidates = this.rankArticles(tweetId, targetAuthor);
        if (candidates.length > 0 && (candidates[0].score >= 30 || candidates.length === 1)) {
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (candidates.length === 0) {
        if (this.isTweetUnavailable()) {
          return { success: true, alreadyDeleted: true };
        }
        return { success: false, error: `Retweet ${tweetId || ''} not found on page.` };
      }

      for (const item of candidates) {
        const candidate = item.article;
        const unretweetBtn = candidate.querySelector<HTMLElement>('[data-testid="unretweet"]');
        if (!unretweetBtn) {
          const normalRetweetBtn = candidate.querySelector<HTMLElement>('[data-testid="retweet"]');
          if (normalRetweetBtn) {
            return { success: true, alreadyDeleted: true };
          }
          continue;
        }

        try {
          candidate.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {}
        await new Promise((r) => setTimeout(r, 400));

        if (options?.current && options?.total && tweetId) {
          AutomationHud.showProgress(options.current, options.total, tweetId, 'Undoing Retweet...');
        }

        this.dispatchSafeClick(unretweetBtn);
        await new Promise((r) => setTimeout(r, 400));

        const confirmBtn = await this.waitForElement<HTMLElement>(
          '[data-testid="unretweetConfirm"], [data-testid="confirmationSheetConfirm"]',
          3500
        );

        if (!confirmBtn) {
          const menuItems = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
          const undoItem = menuItems.find((el) => /desfazer|undo/i.test(el.innerText || el.textContent || ''));
          if (undoItem) {
            this.dispatchSafeClick(undoItem);
            await new Promise((r) => setTimeout(r, 700));
            return { success: true };
          }
          return { success: false, error: 'Confirmation popup to unretweet did not appear.' };
        }

        this.dispatchSafeClick(confirmBtn);
        await new Promise((r) => setTimeout(r, 800));

        if (options?.current && options?.total && tweetId) {
          AutomationHud.showProgress(options.current, options.total, tweetId, '✅ Retweet undone successfully.');
        }

        return { success: true };
      }

      return { success: false, error: 'Unretweet button was not found in displayed posts.' };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
}
