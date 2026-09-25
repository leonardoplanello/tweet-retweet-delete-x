"use strict";
(() => {
  // src/content/automation-hud.ts
  var AutomationHud = class {
    static HUD_ID = "__tweet_purge_automation_hud__";
    /**
     * Exibe ou atualiza o HUD com informações de progresso do tweet atual.
     */
    static showProgress(current, total, tweetId, statusText) {
      const el = this.getOrCreateContainer();
      const percent = total > 0 ? Math.round(current / total * 100) : 0;
      el.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px; animation: spin 2s linear infinite; display: inline-block;">\u2699\uFE0F</span>
          <div>
            <div style="font-weight: 700; font-size: 13px; color: #ffffff;">
              Tweet Purge: Excluindo ${current} de ${total} (${percent}%)
            </div>
            <div style="font-size: 11px; color: #a0aec0; margin-top: 1px;">
              ${statusText || `Tweet ID: ${tweetId}`}
            </div>
          </div>
        </div>
        <div style="font-size: 10px; background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.4); white-space: nowrap;">
          \u26A0\uFE0F N\xE3o feche esta aba
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
    static updateStatus(message) {
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
    static remove() {
      const el = document.getElementById(this.HUD_ID);
      if (el) {
        el.remove();
      }
    }
    static getOrCreateContainer() {
      let el = document.getElementById(this.HUD_ID);
      if (!el) {
        el = document.createElement("div");
        el.id = this.HUD_ID;
        el.setAttribute(
          "style",
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
        if (!document.getElementById("__tweet_purge_hud_styles__")) {
          const style = document.createElement("style");
          style.id = "__tweet_purge_hud_styles__";
          style.textContent = `
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `;
          document.head?.appendChild(style);
        }
        document.body.appendChild(el);
      }
      return el;
    }
  };

  // src/content/dom-clicker.ts
  var DomClicker = class {
    /**
     * Aguarda um elemento aparecer no DOM com timeout configurável.
     */
    static async waitForElement(selector, timeoutMs = 5e3, parent = document) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const el = parent.querySelector(selector);
        if (el) return el;
        await new Promise((r) => setTimeout(r, 150));
      }
      return null;
    }
    /**
     * Dispara sequência completa de eventos (pointerdown, mousedown, pointerup, mouseup, click)
     * no elemento button para garantir compatibilidade com o React 18 do X.
     */
    static dispatchSafeClick(element) {
      const target = element.closest("button") || element;
      try {
        target.focus();
      } catch {
      }
      const rect = target.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;
      const eventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY
      };
      try {
        target.dispatchEvent(new PointerEvent("pointerdown", eventInit));
      } catch {
      }
      target.dispatchEvent(new MouseEvent("mousedown", eventInit));
      try {
        target.dispatchEvent(new PointerEvent("pointerup", eventInit));
      } catch {
      }
      target.dispatchEvent(new MouseEvent("mouseup", eventInit));
      target.click();
    }
    /**
     * Fecha menus popover ou modais abertos pressionando Escape e clicando no body.
     */
    static closeOpenMenus() {
      try {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
        document.body.click();
      } catch {
      }
    }
    /**
     * Detecta se a página exibe erro 404, post inexistente ou já apagado.
     */
    static isTweetUnavailable() {
      const pageText = document.body.innerText || "";
      const indicators = [
        "Este post n\xE3o est\xE1 dispon\xEDvel",
        "This post is unavailable",
        "Hmm... essa p\xE1gina n\xE3o existe",
        "Hmm... this page doesn\u2019t exist",
        "Hmm... this page doesn't exist",
        "Esta conta foi suspensa",
        "This account has been suspended",
        "N\xE3o foi poss\xEDvel carregar o post",
        "Post not found"
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
    static getTargetAuthorFromPage() {
      const pathMatch = window.location.pathname.match(/\/([a-zA-Z0-9_]{1,15})\/status/i);
      if (pathMatch) {
        const candidate = pathMatch[1].toLowerCase();
        if (candidate !== "i") return candidate;
      }
      const switcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      if (switcher) {
        const match = (switcher.textContent || "").match(/@([a-zA-Z0-9_]{1,15})/);
        if (match) return match[1].toLowerCase();
      }
      return null;
    }
    /**
     * Avalia e pontua todos os artigos de tweet presentes na página para selecionar
     * especificamente o post do usuário dono, ignorando posts de terceiros em threads.
     */
    static rankArticles(tweetId, targetAuthor) {
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      if (articles.length === 0) return [];
      const scored = articles.map((article, index) => {
        let score = 0;
        const articleHtml = article.innerHTML || "";
        if (tweetId) {
          if (article.querySelector(`a[href*="/status/${tweetId}"]`)) {
            score += 200;
          } else if (articleHtml.includes(tweetId)) {
            score += 100;
          }
          const otherStatusLink = article.querySelector('a[href*="/status/"]');
          if (otherStatusLink && !article.querySelector(`a[href*="/status/${tweetId}"]`)) {
            score -= 50;
          }
        }
        if (targetAuthor) {
          const userEl = article.querySelector('[data-testid="User-Name"]');
          const userText = userEl ? (userEl.textContent || "").toLowerCase() : "";
          if (userText.includes(`@${targetAuthor.toLowerCase()}`)) {
            score += 80;
          } else if (userText.length > 0) {
            score -= 40;
          }
        }
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
    static findCaretButton(article) {
      const btn = article.querySelector(
        'button[data-testid="caret"], [data-testid="caret"], button[aria-haspopup="menu"], button[aria-label*="Mais"], button[aria-label*="More"]'
      );
      if (btn) {
        return btn.closest("button") || btn;
      }
      return null;
    }
    /**
     * Localiza o item "Excluir" dentro do menu Dropdown aberto.
     */
    static findDeleteMenuItem(menu) {
      const items = Array.from(
        menu.querySelectorAll(
          '[role="menuitem"], [data-testid="Dropdown"] > div, div[tabindex="0"], div[data-testid="delete"]'
        )
      );
      return items.find((el) => {
        const txt = (el.innerText || el.textContent || "").trim().toLowerCase();
        return txt.includes("excluir") || txt.includes("delete") || txt.includes("apagar") || el.getAttribute("data-testid") === "delete";
      }) || null;
    }
    /**
     * Localiza o botão de confirmação dentro do modal de exclusão.
     */
    static async findConfirmButton() {
      const confirmBtn = await this.waitForElement(
        '[data-testid="confirmationSheetConfirm"], button[data-testid="confirmationSheetConfirm"]',
        3500
      );
      if (confirmBtn) return confirmBtn.closest("button") || confirmBtn;
      const dialog = document.querySelector('[role="dialog"], [data-testid="sheetDialog"]');
      if (dialog) {
        const btns = Array.from(dialog.querySelectorAll("button"));
        const match = btns.find((b) => {
          const txt = (b.innerText || b.textContent || "").trim().toLowerCase();
          return (txt.includes("excluir") || txt.includes("delete") || txt.includes("apagar")) && !txt.includes("cancel");
        });
        if (match) return match;
      }
      return null;
    }
    /**
     * Exclui um tweet através de cliques na interface do X.
     */
    static async deleteTweetByDom(tweetId, options) {
      try {
        if (options?.current && options?.total && tweetId) {
          AutomationHud.showProgress(options.current, options.total, tweetId, "Localizando post...");
        }
        await new Promise((r) => setTimeout(r, 600));
        if (this.isTweetUnavailable()) {
          if (options?.current && options?.total && tweetId) {
            AutomationHud.showProgress(options.current, options.total, tweetId, "Post j\xE1 n\xE3o existe (404/Removido).");
          }
          return { success: true, alreadyDeleted: true };
        }
        const targetAuthor = options?.targetAuthor || this.getTargetAuthorFromPage();
        const startWait = Date.now();
        let candidates = [];
        while (Date.now() - startWait < 12e3) {
          if (this.isTweetUnavailable()) {
            return { success: true, alreadyDeleted: true };
          }
          candidates = this.rankArticles(tweetId, targetAuthor);
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
            error: `Tweet ${tweetId || ""} n\xE3o carregou na p\xE1gina vis\xEDvel do X a tempo.`
          };
        }
        for (let i = 0; i < candidates.length; i++) {
          const item = candidates[i];
          const candidate = item.article;
          try {
            candidate.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
          }
          await new Promise((r) => setTimeout(r, 400));
          const caretBtn = this.findCaretButton(candidate);
          if (!caretBtn) {
            const unretweetBtn = candidate.querySelector('[data-testid="unretweet"]');
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
              candidates.length > 1 ? `Verificando post (${i + 1}/${candidates.length})...` : "Abrindo menu de op\xE7\xF5es..."
            );
          }
          this.dispatchSafeClick(caretBtn);
          await new Promise((r) => setTimeout(r, 350));
          const menu = await this.waitForElement('[data-testid="Dropdown"], [role="menu"]', 3e3);
          if (!menu) {
            this.closeOpenMenus();
            continue;
          }
          const deleteItem = this.findDeleteMenuItem(menu);
          if (!deleteItem) {
            this.closeOpenMenus();
            await new Promise((r) => setTimeout(r, 300));
            continue;
          }
          if (options?.current && options?.total && tweetId) {
            AutomationHud.showProgress(options.current, options.total, tweetId, "Confirmando exclus\xE3o...");
          }
          this.dispatchSafeClick(deleteItem);
          await new Promise((r) => setTimeout(r, 400));
          const confirmBtn = await this.findConfirmButton();
          if (!confirmBtn) {
            return { success: false, error: "Bot\xE3o de confirma\xE7\xE3o de exclus\xE3o n\xE3o apareceu." };
          }
          this.dispatchSafeClick(confirmBtn);
          await new Promise((r) => setTimeout(r, 800));
          if (options?.current && options?.total && tweetId) {
            AutomationHud.showProgress(options.current, options.total, tweetId, "\u2705 Tweet exclu\xEDdo com sucesso.");
          }
          return { success: true };
        }
        for (const item of candidates) {
          const unretweetBtn = item.article.querySelector('[data-testid="unretweet"]');
          if (unretweetBtn) {
            return this.unretweetByDom(tweetId, options);
          }
        }
        return {
          success: false,
          error: 'Op\xE7\xE3o "Excluir" n\xE3o encontrada no menu dos tweets exibidos (verifique se a conta conectada \xE9 a propriet\xE1ria).'
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
    static async unretweetByDom(tweetId, options) {
      try {
        if (options?.current && options?.total && tweetId) {
          AutomationHud.showProgress(options.current, options.total, tweetId, "Localizando Retweet...");
        }
        await new Promise((r) => setTimeout(r, 600));
        if (this.isTweetUnavailable()) {
          return { success: true, alreadyDeleted: true };
        }
        const targetAuthor = options?.targetAuthor || this.getTargetAuthorFromPage();
        const startWait = Date.now();
        let candidates = [];
        while (Date.now() - startWait < 12e3) {
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
          return { success: false, error: `Retweet ${tweetId || ""} n\xE3o encontrado na p\xE1gina.` };
        }
        for (const item of candidates) {
          const candidate = item.article;
          const unretweetBtn = candidate.querySelector('[data-testid="unretweet"]');
          if (!unretweetBtn) {
            const normalRetweetBtn = candidate.querySelector('[data-testid="retweet"]');
            if (normalRetweetBtn) {
              return { success: true, alreadyDeleted: true };
            }
            continue;
          }
          try {
            candidate.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
          }
          await new Promise((r) => setTimeout(r, 400));
          if (options?.current && options?.total && tweetId) {
            AutomationHud.showProgress(options.current, options.total, tweetId, "Desfazendo Retweet...");
          }
          this.dispatchSafeClick(unretweetBtn);
          await new Promise((r) => setTimeout(r, 400));
          const confirmBtn = await this.waitForElement(
            '[data-testid="unretweetConfirm"], [data-testid="confirmationSheetConfirm"]',
            3500
          );
          if (!confirmBtn) {
            const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
            const undoItem = menuItems.find((el) => /desfazer|undo/i.test(el.innerText || el.textContent || ""));
            if (undoItem) {
              this.dispatchSafeClick(undoItem);
              await new Promise((r) => setTimeout(r, 700));
              return { success: true };
            }
            return { success: false, error: "Confirma\xE7\xE3o de desrepublica\xE7\xE3o n\xE3o apareceu." };
          }
          this.dispatchSafeClick(confirmBtn);
          await new Promise((r) => setTimeout(r, 800));
          if (options?.current && options?.total && tweetId) {
            AutomationHud.showProgress(options.current, options.total, tweetId, "\u2705 Retweet desfeito com sucesso.");
          }
          return { success: true };
        }
        return { success: false, error: "Bot\xE3o de desrepublicar (unretweet) n\xE3o foi encontrado nos artigos exibidos." };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err)
        };
      }
    }
  };

  // src/content/dom-scanner.ts
  var DomScanner = class {
    static isScanning = false;
    /**
     * Identifica o handle do usuário logado ou do perfil ativo no X.
     */
    static getCurrentUserHandle(preferredHandle) {
      if (preferredHandle) {
        const clean = preferredHandle.trim().replace(/^@/, "").toLowerCase();
        if (/^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
          return clean;
        }
      }
      const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
      if (profileLink) {
        const href = profileLink.getAttribute("href") || "";
        const clean = href.replace(/^\//, "").split("/")[0].split("?")[0].trim();
        if (clean && /^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
          return clean.toLowerCase();
        }
      }
      const accountSwitcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      if (accountSwitcher && accountSwitcher.textContent) {
        const match = accountSwitcher.textContent.match(/@([a-zA-Z0-9_]{1,15})/);
        if (match) {
          return match[1].toLowerCase();
        }
      }
      const navProfile = document.querySelector(
        'nav a[aria-label*="Profile" i], nav a[aria-label*="Perfil" i]'
      );
      if (navProfile) {
        const href = navProfile.getAttribute("href") || "";
        const clean = href.replace(/^\//, "").split("/")[0].split("?")[0].trim();
        if (clean && /^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
          return clean.toLowerCase();
        }
      }
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        const candidate = pathParts[0].toLowerCase();
        const reserved = /* @__PURE__ */ new Set([
          "home",
          "explore",
          "notifications",
          "messages",
          "i",
          "compose",
          "search",
          "settings",
          "tos",
          "privacy",
          "logout",
          "login",
          "intent"
        ]);
        if (!reserved.has(candidate) && /^[a-zA-Z0-9_]{1,15}$/.test(candidate)) {
          return candidate;
        }
      }
      return null;
    }
    /**
     * Extrai o handle do autor do tweet (@usuario) a partir dos seletores do article.
     */
    static extractTweetAuthor(article) {
      const userEl = article.querySelector('[data-testid="User-Name"]');
      if (userEl && userEl.textContent) {
        const match = userEl.textContent.match(/@([a-zA-Z0-9_]{1,15})/);
        if (match) {
          return match[1].toLowerCase();
        }
      }
      const avatarLink = article.querySelector(
        'div[data-testid="Tweet-User-Avatar"] a[href^="/"]'
      );
      if (avatarLink) {
        const href = avatarLink.getAttribute("href") || "";
        const clean = href.replace(/^\//, "").split("/")[0].split("?")[0].trim();
        if (clean && /^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
          return clean.toLowerCase();
        }
      }
      if (userEl) {
        const links = userEl.querySelectorAll('a[href^="/"]');
        for (const a of links) {
          const href = a.getAttribute("href") || "";
          if (!href.includes("/status/")) {
            const clean = href.replace(/^\//, "").split("/")[0].split("?")[0].trim();
            if (clean && /^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
              return clean.toLowerCase();
            }
          }
        }
      }
      const timeEl = article.querySelector("time");
      const statusLink = timeEl?.closest('a[href*="/status/"]') || article.querySelector('a[href*="/status/"]');
      if (statusLink) {
        const href = statusLink.getAttribute("href") || "";
        const match = href.match(/(?:x\.com|twitter\.com)?\/([a-zA-Z0-9_]{1,15})\/status\/\d+/i);
        if (match && match[1] && match[1].toLowerCase() !== "i") {
          return match[1].toLowerCase();
        }
      }
      return null;
    }
    /**
     * Extrai os tweets presentes atualmente no DOM da página, filtrando para incluir
     * somente publicações do próprio usuário ou retweets realizados por ele.
     */
    static extractVisibleTweets(targetUsername) {
      const currentUser = this.getCurrentUserHandle(targetUsername);
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const tweets = [];
      articles.forEach((article) => {
        try {
          const timeEl = article.querySelector("time");
          const statusLink = timeEl?.closest('a[href*="/status/"]') || article.querySelector('a[href*="/status/"]');
          if (!statusLink) return;
          const href = statusLink.getAttribute("href") || "";
          const match = href.match(/\/status\/(\d+)/);
          if (!match) return;
          const id = match[1];
          const textEl = article.querySelector('[data-testid="tweetText"]');
          const text = textEl?.textContent || "";
          const createdAt = timeEl?.getAttribute("datetime") || (/* @__PURE__ */ new Date()).toISOString();
          const socialContext = article.querySelector('[data-testid="socialContext"]');
          const socialText = socialContext?.textContent?.toLowerCase() || "";
          const hasUnretweetBtn = Boolean(article.querySelector('[data-testid="unretweet"]'));
          const isRetweet = hasUnretweetBtn || socialText.includes("republicou") || socialText.includes("retweeted") || socialText.includes("reposted") || socialText.includes("voc\xEA repostou") || socialText.includes("you reposted");
          const authorHandle = this.extractTweetAuthor(article);
          if (!isRetweet) {
            if (currentUser && authorHandle) {
              if (authorHandle.toLowerCase() !== currentUser.toLowerCase()) {
                return;
              }
            }
          } else {
            const isUserRetweet = hasUnretweetBtn || socialText.includes("voc\xEA") || socialText.includes("you") || Boolean(currentUser) && (socialText.includes(currentUser) || window.location.pathname.toLowerCase().startsWith(`/${currentUser}`));
            if (!isUserRetweet) {
              return;
            }
          }
          const mediaUrls = [];
          article.querySelectorAll('img[src*="media"], img[src*="ext_tw_video_thumb"]').forEach((img) => {
            if (img.src && !img.src.includes("profile_images")) {
              mediaUrls.push(img.src);
            }
          });
          tweets.push({
            id,
            text,
            createdAt,
            isRetweet,
            retweetedFrom: isRetweet ? authorHandle ? `@${authorHandle}` : void 0 : void 0,
            authorHandle: isRetweet ? void 0 : authorHandle || currentUser || void 0,
            url: `https://x.com${href.startsWith("/") ? href : `/${href}`}`,
            mediaUrls,
            selected: false,
            status: "idle"
          });
        } catch (err) {
          console.warn("Erro ao processar tweet no DOM:", err);
        }
      });
      return tweets;
    }
    /**
     * Executa rolagem contínua para carregar tweets da timeline.
     */
    static async scanWithScroll(maxScrolls = 10, onProgress, targetUsername) {
      this.isScanning = true;
      const allFound = /* @__PURE__ */ new Map();
      for (let i = 0; i < maxScrolls; i++) {
        if (!this.isScanning) break;
        const batch = this.extractVisibleTweets(targetUsername);
        for (const t of batch) {
          allFound.set(t.id, t);
        }
        if (onProgress) {
          onProgress(Array.from(allFound.values()));
        }
        window.scrollBy({ top: 800, behavior: "smooth" });
        await new Promise((r) => setTimeout(r, 1200));
      }
      this.isScanning = false;
      return Array.from(allFound.values());
    }
    static stopScan() {
      this.isScanning = false;
    }
  };

  // src/content/content-main.ts
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "PING_AUTOMATION") {
      sendResponse({ pong: true });
      return false;
    }
    if (message.type === "REMOVE_AUTOMATION_HUD") {
      AutomationHud.remove();
      sendResponse({ success: true });
      return false;
    }
    if (message.type === "DOM_DELETE_TWEET") {
      DomClicker.deleteTweetByDom(message.tweetId, {
        current: message.current,
        total: message.total,
        targetAuthor: message.targetAuthor
      }).then((res) => sendResponse(res)).catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }
    if (message.type === "DOM_UNRETWEET") {
      DomClicker.unretweetByDom(message.tweetId, {
        current: message.current,
        total: message.total,
        targetAuthor: message.targetAuthor
      }).then((res) => sendResponse(res)).catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }
    if (message.type === "SCAN_TIMELINE_START") {
      DomScanner.scanWithScroll(
        message.maxScrolls || 12,
        (tweets) => {
          chrome.runtime.sendMessage({
            type: "SCAN_TIMELINE_PROGRESS",
            foundCount: tweets.length,
            tweets
          }).catch(() => {
          });
        },
        message.targetUsername
      ).then((allTweets) => {
        sendResponse({ success: true, tweets: allTweets });
      }).catch((err) => {
        sendResponse({ success: false, error: String(err) });
      });
      return true;
    }
    if (message.type === "SCAN_TIMELINE_STOP") {
      DomScanner.stopScan();
      sendResponse({ success: true });
      return false;
    }
  });
})();
//# sourceMappingURL=content.js.map
