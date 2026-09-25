"use strict";
(() => {
  // src/types/config.ts
  var DEFAULT_CONFIG = {
    method: "dom",
    // Padrão recomendado: navegação direta na UI do X
    minDelayMs: 1500,
    maxDelayMs: 3e3,
    autoPauseOnRateLimit: true,
    rateLimitCooldownSeconds: 60,
    maxRetries: 2,
    customDeleteQueryId: "",
    customUnretweetQueryId: ""
  };

  // src/services/storage-service.ts
  var STORAGE_KEYS = {
    TWEETS: "x_tweets_list",
    CONFIG: "x_extension_config",
    DELETED_IDS: "x_deleted_tweet_ids",
    LAST_SCAN_USER: "x_last_scan_user",
    JOB_STATE: "x_batch_job_state",
    JOB_LOGS: "x_batch_job_logs"
  };
  var StorageService = class {
    /**
     * Obtém a lista de tweets armazenados localmente.
     */
    static async getTweets() {
      const data = await chrome.storage.local.get(STORAGE_KEYS.TWEETS);
      return data[STORAGE_KEYS.TWEETS] || [];
    }
    /**
     * Salva a lista de tweets atualizada.
     */
    static async saveTweets(tweets) {
      await chrome.storage.local.set({ [STORAGE_KEYS.TWEETS]: tweets });
    }
    /**
     * Remove tweets de terceiros (respostas de outras pessoas) garantindo apenas posts do próprio usuário.
     */
    static filterValidUserTweets(tweets, validUsername) {
      if (!validUsername) return tweets;
      const cleanUser = validUsername.toLowerCase().replace(/^@/, "");
      return tweets.filter((t) => {
        if (t.isRetweet) return true;
        if (t.authorHandle) {
          return t.authorHandle.toLowerCase() === cleanUser;
        }
        const match = t.url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})\/status\//i);
        if (match && match[1] && match[1].toLowerCase() !== "i") {
          return match[1].toLowerCase() === cleanUser;
        }
        return true;
      });
    }
    /**
     * Adiciona ou mescla novos tweets sem duplicar por ID, filtrando tweets inválidos de terceiros.
     */
    static async mergeTweets(newTweets, validUsername) {
      const current = await this.getTweets();
      const map = /* @__PURE__ */ new Map();
      for (const item of current) {
        map.set(item.id, item);
      }
      for (const item of newTweets) {
        const existing = map.get(item.id);
        if (existing && existing.status === "success") {
          continue;
        }
        map.set(item.id, item);
      }
      let merged = Array.from(map.values());
      if (validUsername) {
        merged = this.filterValidUserTweets(merged, validUsername);
      }
      await this.saveTweets(merged);
      return merged;
    }
    /**
     * Limpa a lista de tweets em cache.
     */
    static async clearTweets() {
      await chrome.storage.local.remove(STORAGE_KEYS.TWEETS);
    }
    /**
     * Obtém as configurações salvas ou padrão.
     */
    static async getConfig() {
      const data = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
      return { ...DEFAULT_CONFIG, ...data[STORAGE_KEYS.CONFIG] || {} };
    }
    /**
     * Salva configurações.
     */
    static async saveConfig(config) {
      const current = await this.getConfig();
      const updated = { ...current, ...config };
      await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: updated });
      return updated;
    }
    /**
     * Registra IDs de tweets já apagados com sucesso.
     */
    static async markDeletedId(id) {
      const data = await chrome.storage.local.get(STORAGE_KEYS.DELETED_IDS);
      const deletedIds = data[STORAGE_KEYS.DELETED_IDS] || [];
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        await chrome.storage.local.set({ [STORAGE_KEYS.DELETED_IDS]: deletedIds });
      }
    }
    /**
     * Obtém os IDs já apagados.
     */
    static async getDeletedIds() {
      const data = await chrome.storage.local.get(STORAGE_KEYS.DELETED_IDS);
      return data[STORAGE_KEYS.DELETED_IDS] || [];
    }
    /**
     * Obtém o estado do lote em segundo plano.
     */
    static async getBatchJobState() {
      const data = await chrome.storage.local.get(STORAGE_KEYS.JOB_STATE);
      return data[STORAGE_KEYS.JOB_STATE] || null;
    }
    /**
     * Salva o estado do lote em segundo plano.
     */
    static async saveBatchJobState(state) {
      if (state === null) {
        await chrome.storage.local.remove(STORAGE_KEYS.JOB_STATE);
      } else {
        await chrome.storage.local.set({ [STORAGE_KEYS.JOB_STATE]: state });
      }
    }
    /**
     * Obtém os logs persistidos da sessão de lote.
     */
    static async getBatchJobLogs() {
      const data = await chrome.storage.local.get(STORAGE_KEYS.JOB_LOGS);
      return data[STORAGE_KEYS.JOB_LOGS] || [];
    }
    /**
     * Adiciona uma mensagem aos logs persistidos da sessão de lote (mantém até 150).
     */
    static async appendBatchJobLog(message) {
      const logs = await this.getBatchJobLogs();
      logs.push(message);
      if (logs.length > 150) {
        logs.splice(0, logs.length - 150);
      }
      await chrome.storage.local.set({ [STORAGE_KEYS.JOB_LOGS]: logs });
    }
    /**
     * Limpa os logs persistidos da sessão de lote.
     */
    static async clearBatchJobLogs() {
      await chrome.storage.local.remove(STORAGE_KEYS.JOB_LOGS);
    }
  };

  // src/services/x-session-service.ts
  var XSessionService = class {
    // Bearer Token padrão público do cliente web oficial do X (Twitter)
    static WEB_BEARER_TOKEN = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
    /**
     * Obtém o token CSRF (ct0) e dados de autenticação a partir dos cookies do navegador.
     */
    static async getSession() {
      try {
        const ct0Cookie = await this.getCookie("ct0");
        const authTokenCookie = await this.getCookie("auth_token");
        const twidCookie = await this.getCookie("twid");
        const csrfToken = ct0Cookie?.value || "";
        const isLoggedIn = Boolean(authTokenCookie?.value && csrfToken);
        let userId;
        if (twidCookie?.value) {
          const decoded = decodeURIComponent(twidCookie.value);
          const match = decoded.match(/u=(\d+)/);
          if (match) {
            userId = match[1];
          }
        }
        return {
          isLoggedIn,
          csrfToken,
          userId
        };
      } catch (error) {
        console.warn("Erro ao obter cookies de sess\xE3o do X:", error);
        return {
          isLoggedIn: false,
          csrfToken: ""
        };
      }
    }
    /**
     * Busca um cookie específico tentando primeiro x.com e depois twitter.com.
     */
    static async getCookie(name) {
      const urls = ["https://x.com", "https://twitter.com"];
      for (const url of urls) {
        try {
          const cookie = await chrome.cookies.get({ url, name });
          if (cookie) {
            return cookie;
          }
        } catch {
        }
      }
      return null;
    }
  };

  // src/services/graphql-delete-service.ts
  var GraphqlDeleteService = class {
    // QueryIDs conhecidos para mutação de exclusão no X Web
    static KNOWN_DELETE_QUERY_IDS = [
      "VaenaVgh5q0MAfm4uMmKgA",
      "7_BAEr9FBSS24bh0YVa4kg",
      "bDE2rBtTNuW0W5vD8R1-6A"
    ];
    static KNOWN_UNRETWEET_QUERY_IDS = [
      "iQtK4dl5hBmXewZZUrEOgg",
      "ojPdsPpjeyd1IqfviUfTow",
      "_nL3j0rNq2y_hKq63uC2vw"
    ];
    /**
     * Exclui um Tweet via GraphQL ou endpoint REST interno.
     */
    static async deleteTweet(tweetId, customQueryId) {
      const session = await XSessionService.getSession();
      if (!session.csrfToken) {
        return {
          success: false,
          error: "Sess\xE3o do X n\xE3o encontrada. Abra o x.com no navegador para sincronizar seu login."
        };
      }
      const queryIdsToTry = customQueryId ? [customQueryId, ...this.KNOWN_DELETE_QUERY_IDS] : this.KNOWN_DELETE_QUERY_IDS;
      for (const qId of queryIdsToTry) {
        const url = `https://x.com/i/api/graphql/${qId}/DeleteTweet`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: this.buildHeaders(session.csrfToken),
            credentials: "include",
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
            if (body.errors && body.errors.length > 0) {
              const msg = body.errors[0]?.message || "Erro interno no GraphQL";
              return { success: false, statusCode: 200, error: msg };
            }
            return { success: true, statusCode: 200 };
          }
          if (res.status === 429) {
            return { success: false, statusCode: 429, isRateLimit: true, error: "Rate limit excedido (429)" };
          }
        } catch (err) {
          console.warn(`Tentativa GraphQL DeleteTweet com ${qId} falhou:`, err);
        }
      }
      try {
        const restUrl = `https://x.com/i/api/1.1/statuses/destroy/${tweetId}.json`;
        const res = await fetch(restUrl, {
          method: "POST",
          headers: this.buildHeaders(session.csrfToken),
          credentials: "include"
        });
        if (res.status === 200 || res.status === 204) {
          return { success: true, statusCode: res.status };
        }
        if (res.status === 429) {
          return { success: false, statusCode: 429, isRateLimit: true, error: "Rate limit excedido (429)" };
        }
        if (res.status === 404) {
          return { success: true, statusCode: 404, error: "Tweet j\xE1 exclu\xEDdo ou n\xE3o encontrado (404)" };
        }
        return {
          success: false,
          statusCode: res.status,
          error: `Falha na requisi\xE7\xE3o HTTP: ${res.status} ${res.statusText}`
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
    static async unretweet(tweetId, customQueryId) {
      const session = await XSessionService.getSession();
      if (!session.csrfToken) {
        return {
          success: false,
          error: "Sess\xE3o do X n\xE3o encontrada. Abra o x.com no navegador."
        };
      }
      const queryIdsToTry = customQueryId ? [customQueryId, ...this.KNOWN_UNRETWEET_QUERY_IDS] : this.KNOWN_UNRETWEET_QUERY_IDS;
      for (const qId of queryIdsToTry) {
        const url = `https://x.com/i/api/graphql/${qId}/DeleteRetweet`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: this.buildHeaders(session.csrfToken),
            credentials: "include",
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
            return { success: false, statusCode: 429, isRateLimit: true, error: "Rate limit excedido (429)" };
          }
        } catch (err) {
          console.warn(`Tentativa GraphQL DeleteRetweet com ${qId} falhou:`, err);
        }
      }
      try {
        const restUrl = `https://x.com/i/api/1.1/statuses/unretweet/${tweetId}.json`;
        const res = await fetch(restUrl, {
          method: "POST",
          headers: this.buildHeaders(session.csrfToken),
          credentials: "include"
        });
        if (res.status === 200 || res.status === 204) {
          return { success: true, statusCode: res.status };
        }
        if (res.status === 429) {
          return { success: false, statusCode: 429, isRateLimit: true, error: "Rate limit (429)" };
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
    static buildHeaders(csrfToken) {
      return {
        authorization: XSessionService.WEB_BEARER_TOKEN,
        "x-csrf-token": csrfToken,
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-client-language": "pt",
        "content-type": "application/json"
      };
    }
  };

  // src/services/automation-tab-service.ts
  var AutomationTabService = class _AutomationTabService {
    static instance;
    currentTabId = null;
    openedByUs = false;
    static getInstance() {
      if (!this.instance) {
        this.instance = new _AutomationTabService();
      }
      return this.instance;
    }
    /**
     * Obtém a aba existente ou cria uma nova aba dedicada de automação.
     */
    async getOrCreateTab() {
      if (this.currentTabId !== null) {
        try {
          const tab = await chrome.tabs.get(this.currentTabId);
          if (tab && tab.id) {
            return tab.id;
          }
        } catch {
          this.currentTabId = null;
        }
      }
      const existingTabs = await chrome.tabs.query({
        url: ["https://x.com/*", "https://twitter.com/*"]
      });
      const candidate = existingTabs.find((t) => t.id && !t.url?.startsWith("chrome-extension://"));
      if (candidate && candidate.id) {
        this.currentTabId = candidate.id;
        this.openedByUs = false;
        return candidate.id;
      }
      const newTab = await chrome.tabs.create({
        url: "https://x.com/home",
        active: true
      });
      if (!newTab.id) {
        throw new Error("Falha ao instanciar aba de automa\xE7\xE3o no navegador.");
      }
      this.currentTabId = newTab.id;
      this.openedByUs = true;
      return newTab.id;
    }
    /**
     * Navega para a URL do tweet e aguarda handshake do content script.
     */
    async navigateToTweet(tweetId, tweetUrl) {
      const tabId = await this.getOrCreateTab();
      const targetUrl = tweetUrl && (tweetUrl.includes("x.com") || tweetUrl.includes("twitter.com")) ? tweetUrl : `https://x.com/i/status/${tweetId}`;
      await chrome.tabs.update(tabId, { url: targetUrl, active: true });
      await this.waitForTabLoaded(tabId, 15e3);
      await this.ensureContentScriptReady(tabId, 8e3);
      return tabId;
    }
    /**
     * Executa a exclusão ou desretweet de um post na aba de automação.
     */
    async executeOnTweet(tweetId, isRetweet, progress, tweetUrl, targetAuthor) {
      try {
        const tabId = await this.navigateToTweet(tweetId, tweetUrl);
        const authorFromUrl = tweetUrl?.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})\/status/i)?.[1];
        const effectiveAuthor = targetAuthor || (authorFromUrl && authorFromUrl !== "i" ? authorFromUrl : void 0);
        const messageType = isRetweet ? "DOM_UNRETWEET" : "DOM_DELETE_TWEET";
        const response = await chrome.tabs.sendMessage(tabId, {
          type: messageType,
          tweetId,
          current: progress?.current,
          total: progress?.total,
          targetAuthor: effectiveAuthor
        });
        if (response && response.success) {
          return { success: true };
        }
        if (response && response.alreadyDeleted) {
          return { success: true, statusCode: 404, error: "Tweet j\xE1 exclu\xEDdo ou indispon\xEDvel" };
        }
        return {
          success: false,
          error: response?.error || "A\xE7\xE3o de exclus\xE3o DOM n\xE3o conclu\xEDda com sucesso."
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err)
        };
      }
    }
    /**
     * Fecha ou limpa a aba dedicada ao término do lote.
     */
    async cleanup(closeTab = true) {
      if (this.currentTabId !== null) {
        try {
          if (this.openedByUs && closeTab) {
            await chrome.tabs.remove(this.currentTabId).catch(() => {
            });
          } else {
            await chrome.tabs.sendMessage(this.currentTabId, { type: "REMOVE_AUTOMATION_HUD" }).catch(() => {
            });
          }
        } catch {
        }
        this.currentTabId = null;
        this.openedByUs = false;
      }
    }
    waitForTabLoaded(tabId, timeoutMs) {
      return new Promise((resolve) => {
        const start = Date.now();
        const interval = setInterval(async () => {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (tab.status === "complete" || Date.now() - start > timeoutMs) {
              clearInterval(interval);
              resolve();
            }
          } catch {
            clearInterval(interval);
            resolve();
          }
        }, 300);
      });
    }
    async ensureContentScriptReady(tabId, timeoutMs) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const res = await chrome.tabs.sendMessage(tabId, { type: "PING_AUTOMATION" });
          if (res && res.pong) {
            return;
          }
        } catch {
          if (Date.now() - start > 2e3) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId },
                files: ["content.js"]
              });
            } catch {
            }
          }
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  };

  // src/services/dom-delete-service.ts
  var DomDeleteService = class {
    /**
     * Executa a exclusão de um tweet via automação DOM na aba dedicada.
     */
    static async deleteTweet(tweetId, progress, tweetUrl, targetAuthor) {
      return AutomationTabService.getInstance().executeOnTweet(tweetId, false, progress, tweetUrl, targetAuthor);
    }
    /**
     * Desfaz um Retweet via automação DOM na aba dedicada.
     */
    static async unretweet(tweetId, progress, tweetUrl, targetAuthor) {
      return AutomationTabService.getInstance().executeOnTweet(tweetId, true, progress, tweetUrl, targetAuthor);
    }
    /**
     * Encerra a sessão da aba de automação (limpa HUD ou fecha aba se foi criada pela extensão).
     */
    static async finishSession(closeTab = true) {
      return AutomationTabService.getInstance().cleanup(closeTab);
    }
  };

  // src/services/deletion-executor.ts
  var DeletionExecutor = class {
    /**
     * Exclui um item (tweet ou retweet) de acordo com a estratégia configurada.
     */
    static async execute(item, config, progress) {
      const isRetweet = item.isRetweet;
      let result = { success: false };
      if (config.method === "dom") {
        result = isRetweet ? await DomDeleteService.unretweet(item.id, progress, item.url, item.authorHandle) : await DomDeleteService.deleteTweet(item.id, progress, item.url, item.authorHandle);
      } else if (config.method === "graphql") {
        result = isRetweet ? await GraphqlDeleteService.unretweet(item.id, config.customUnretweetQueryId) : await GraphqlDeleteService.deleteTweet(item.id, config.customDeleteQueryId);
      } else {
        result = isRetweet ? await GraphqlDeleteService.unretweet(item.id, config.customUnretweetQueryId) : await GraphqlDeleteService.deleteTweet(item.id, config.customDeleteQueryId);
        if (!result.success && !result.isRateLimit) {
          console.warn(`Tentativa GraphQL falhou para ${item.id}. Tentando fallback visual via DOM...`);
          result = isRetweet ? await DomDeleteService.unretweet(item.id, progress, item.url, item.authorHandle) : await DomDeleteService.deleteTweet(item.id, progress, item.url, item.authorHandle);
        }
      }
      if (result.success) {
        await StorageService.markDeletedId(item.id);
      }
      return result;
    }
  };

  // src/services/rate-limiter.ts
  var RateLimiter = class {
    isPaused = false;
    isAborted = false;
    /**
     * Aguarda um tempo aleatório entre minMs e maxMs, respeitando pausas, cancelamento e keepalive.
     */
    async wait(minMs, maxMs, onTick, onHeartbeat) {
      if (this.isAborted) {
        throw new Error("Opera\xE7\xE3o cancelada pelo usu\xE1rio.");
      }
      if (this.isPaused) {
        await this.waitForResume(onHeartbeat);
      }
      const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
      const interval = 100;
      let elapsed = 0;
      let lastHeartbeat = Date.now();
      while (elapsed < delay) {
        if (this.isAborted) {
          throw new Error("Opera\xE7\xE3o cancelada pelo usu\xE1rio.");
        }
        if (this.isPaused) {
          await this.waitForResume(onHeartbeat);
        }
        const step = Math.min(interval, delay - elapsed);
        await new Promise((resolve) => setTimeout(resolve, step));
        elapsed += step;
        if (onTick) {
          onTick(delay - elapsed);
        }
        if (onHeartbeat && Date.now() - lastHeartbeat >= 1e4) {
          lastHeartbeat = Date.now();
          onHeartbeat();
        }
      }
    }
    /**
     * Executa cooldown obrigatório após detectar HTTP 429 (Rate Limit) com keepalive.
     */
    async cooldown(seconds, onCountdown, onHeartbeat) {
      for (let s = seconds; s > 0; s--) {
        if (this.isAborted) {
          throw new Error("Opera\xE7\xE3o cancelada pelo usu\xE1rio.");
        }
        if (onCountdown) {
          onCountdown(s);
        }
        if (onHeartbeat && s % 10 === 0) {
          onHeartbeat();
        }
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
    }
    /**
     * Pausa a execução.
     */
    pause() {
      this.isPaused = true;
    }
    /**
     * Retoma a execução.
     */
    resume() {
      this.isPaused = false;
    }
    /**
     * Cancela permanentemente a execução em andamento.
     */
    abort() {
      this.isAborted = true;
      this.isPaused = false;
    }
    /**
     * Reinicia o estado para uma nova execução.
     */
    reset() {
      this.isPaused = false;
      this.isAborted = false;
    }
    get paused() {
      return this.isPaused;
    }
    get aborted() {
      return this.isAborted;
    }
    async waitForResume(onHeartbeat) {
      let lastHeartbeat = Date.now();
      while (this.isPaused && !this.isAborted) {
        if (onHeartbeat && Date.now() - lastHeartbeat >= 5e3) {
          lastHeartbeat = Date.now();
          onHeartbeat();
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  };

  // src/services/batch-deleter.ts
  var BatchDeleter = class {
    rateLimiter = new RateLimiter();
    isRunning = false;
    async start(items, config, callbacks) {
      if (this.isRunning) {
        throw new Error("J\xE1 existe um processo de exclus\xE3o em andamento.");
      }
      this.isRunning = true;
      this.rateLimiter.reset();
      const toProcess = items.filter((t) => t.selected && t.status !== "success");
      const total = toProcess.length;
      let successCount = 0;
      let failCount = 0;
      callbacks.onLog(`[IN\xCDCIO DO LOTE] Iniciando exclus\xE3o de ${total} item(ns)... M\xE9todo: ${config.method.toUpperCase()}`);
      try {
        for (let i = 0; i < total; i++) {
          if (this.rateLimiter.aborted) {
            callbacks.onLog("[CANCELADO] Opera\xE7\xE3o cancelada pelo usu\xE1rio.");
            break;
          }
          const item = toProcess[i];
          item.status = "pending";
          callbacks.onProgress(i + 1, total, item, `Processando ${i + 1} de ${total}: Tweet ${item.id}`);
          callbacks.onLog(`[${i + 1}/${total}] Excluindo ${item.isRetweet ? "Retweet" : "Tweet"} ID: ${item.id}...`);
          let result = await DeletionExecutor.execute(item, config, {
            current: i + 1,
            total
          });
          if (result.isRateLimit && config.autoPauseOnRateLimit) {
            callbacks.onLog(`\u26A0\uFE0F [RATE LIMIT 429 DETECTADO] Pausando por ${config.rateLimitCooldownSeconds} segundos para seguran\xE7a...`);
            await this.rateLimiter.cooldown(
              config.rateLimitCooldownSeconds,
              (sec) => {
                callbacks.onProgress(i + 1, total, item, `Rate Limit atingido. Aguardando ${sec}s para retomar com seguran\xE7a...`);
              },
              callbacks.onHeartbeat
            );
            callbacks.onLog(`Retomando tentativa para o Tweet ${item.id}...`);
            result = await DeletionExecutor.execute(item, config, {
              current: i + 1,
              total
            });
          }
          if (result.success) {
            item.status = "success";
            item.selected = false;
            successCount++;
            callbacks.onLog(`\u2705 [SUCESSO] ${item.isRetweet ? "Retweet" : "Tweet"} ${item.id} removido.`);
          } else {
            item.status = "failed";
            item.errorMessage = result.error || "Falha na exclus\xE3o";
            failCount++;
            callbacks.onLog(`\u274C [FALHA] Tweet ${item.id}: ${item.errorMessage}`);
          }
          callbacks.onItemCompleted(item, result.success);
          await StorageService.mergeTweets(items).catch(() => {
          });
          if (i < total - 1 && !this.rateLimiter.aborted) {
            await this.rateLimiter.wait(
              config.minDelayMs,
              config.maxDelayMs,
              (remainingMs) => {
                callbacks.onProgress(i + 1, total, item, `Aguardando ${(remainingMs / 1e3).toFixed(1)}s (Cad\xEAncia Segura)...`);
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
        await DomDeleteService.finishSession(true).catch(() => {
        });
        callbacks.onDone({ successCount, failCount });
      }
    }
    pause() {
      this.rateLimiter.pause();
    }
    resume() {
      this.rateLimiter.resume();
    }
    abort() {
      this.rateLimiter.abort();
      DomDeleteService.finishSession(false).catch(() => {
      });
    }
    get running() {
      return this.isRunning;
    }
    get paused() {
      return this.rateLimiter.paused;
    }
  };

  // src/services/background-job-service.ts
  var ALARM_KEEPALIVE_NAME = "tweet_purge_keepalive";
  var BackgroundJobService = class _BackgroundJobService {
    static instance;
    batchDeleter = new BatchDeleter();
    currentState = {
      status: "idle",
      total: 0,
      current: 0,
      currentItem: null,
      successCount: 0,
      failCount: 0,
      message: "Nenhum processamento em andamento"
    };
    constructor() {
      this.restoreState();
    }
    static getInstance() {
      if (!this.instance) {
        this.instance = new _BackgroundJobService();
      }
      return this.instance;
    }
    async restoreState() {
      try {
        const saved = await StorageService.getBatchJobState();
        if (saved) {
          this.currentState = saved;
        }
      } catch (e) {
        console.warn("Erro ao restaurar estado do job:", e);
      }
    }
    async getState() {
      const saved = await StorageService.getBatchJobState();
      if (saved) {
        this.currentState = saved;
      }
      return this.currentState;
    }
    async startJob(items, config) {
      if (this.batchDeleter.running) {
        throw new Error("J\xE1 existe uma exclus\xE3o em lote em andamento no plano de fundo.");
      }
      const toProcess = items.filter((t) => t.selected && t.status !== "success");
      if (toProcess.length === 0) {
        throw new Error("Nenhum item v\xE1lido selecionado para exclus\xE3o.");
      }
      try {
        chrome.alarms.create(ALARM_KEEPALIVE_NAME, { periodInMinutes: 0.35 });
      } catch {
      }
      this.currentState = {
        status: "running",
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
      this.executeLoop(items, config).catch(async (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        await this.log(`[ERRO CR\xCDTICO NO BACKGROUND] ${msg}`);
        this.currentState.status = "aborted";
        this.currentState.message = `Erro: ${msg}`;
        await this.updateAndBroadcastState();
      });
    }
    async executeLoop(items, config) {
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
          const itemMsg = {
            type: "BATCH_JOB_ITEM_COMPLETED",
            item,
            success
          };
          this.safeSendMessage(itemMsg);
        },
        onLog: async (msg) => {
          await this.log(msg);
        },
        onDone: async (summary) => {
          this.currentState.status = "completed";
          this.currentState.message = `Conclu\xEDdo: ${summary.successCount} sucesso(s), ${summary.failCount} falha(s).`;
          this.currentState.updatedAt = Date.now();
          await this.updateAndBroadcastState();
          const doneMsg = {
            type: "BATCH_JOB_DONE",
            summary: {
              successCount: summary.successCount,
              failCount: summary.failCount,
              total: this.currentState.total
            }
          };
          this.safeSendMessage(doneMsg);
          try {
            chrome.alarms.clear(ALARM_KEEPALIVE_NAME);
          } catch {
          }
        },
        onHeartbeat: () => {
          chrome.runtime.getPlatformInfo().catch(() => {
          });
        }
      });
    }
    async pauseJob() {
      this.batchDeleter.pause();
      this.currentState.status = "paused";
      this.currentState.message = "Execu\xE7\xE3o em segundo plano pausada.";
      this.currentState.updatedAt = Date.now();
      await this.updateAndBroadcastState();
      await this.log("\u23F8\uFE0F Processo em segundo plano pausado.");
    }
    async resumeJob() {
      this.batchDeleter.resume();
      this.currentState.status = "running";
      this.currentState.message = "Execu\xE7\xE3o em segundo plano retomada.";
      this.currentState.updatedAt = Date.now();
      await this.updateAndBroadcastState();
      await this.log("\u25B6\uFE0F Processo em segundo plano retomado.");
    }
    async cancelJob() {
      this.batchDeleter.abort();
      this.currentState.status = "aborted";
      this.currentState.message = "Opera\xE7\xE3o cancelada pelo usu\xE1rio.";
      this.currentState.updatedAt = Date.now();
      await this.updateAndBroadcastState();
      await this.log("\u274C Cancelamento solicitado pelo usu\xE1rio.");
      try {
        chrome.alarms.clear(ALARM_KEEPALIVE_NAME);
      } catch {
      }
    }
    async handleAlarm(alarm) {
      if (alarm.name === ALARM_KEEPALIVE_NAME) {
        await chrome.storage.local.get("x_keepalive_ping").catch(() => {
        });
      }
    }
    async updateAndBroadcastState() {
      await StorageService.saveBatchJobState(this.currentState);
      const msg = {
        type: "BATCH_JOB_STATE_UPDATE",
        state: this.currentState
      };
      this.safeSendMessage(msg);
    }
    async log(message) {
      const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR");
      const fullMessage = `[${timeStr}] ${message}`;
      await StorageService.appendBatchJobLog(fullMessage);
      const logMsg = {
        type: "BATCH_JOB_LOG",
        message
      };
      this.safeSendMessage(logMsg);
    }
    safeSendMessage(message) {
      try {
        chrome.runtime.sendMessage(message).catch(() => {
        });
      } catch {
      }
    }
  };

  // src/background/service-worker.ts
  var jobService = BackgroundJobService.getInstance();
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      console.log("Tweet Purge Extension instalada com sucesso.");
      await StorageService.getConfig();
    }
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    jobService.handleAlarm(alarm).catch(console.error);
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_SESSION_AUTH") {
      XSessionService.getSession().then((session) => sendResponse(session)).catch((err) => sendResponse({ isLoggedIn: false, error: String(err) }));
      return true;
    }
    if (message.type === "START_BATCH_JOB") {
      jobService.startJob(message.items, message.config).then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }
    if (message.type === "PAUSE_BATCH_JOB") {
      jobService.pauseJob().then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }
    if (message.type === "RESUME_BATCH_JOB") {
      jobService.resumeJob().then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }
    if (message.type === "CANCEL_BATCH_JOB") {
      jobService.cancelJob().then(() => sendResponse({ success: true })).catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }
    if (message.type === "GET_BATCH_JOB_STATE") {
      jobService.getState().then((state) => sendResponse(state)).catch((err) => sendResponse({ error: String(err) }));
      return true;
    }
    if (message.type === "OPEN_FULL_TAB") {
      const url = chrome.runtime.getURL("popup.html");
      chrome.tabs.create({ url }).then((tab) => sendResponse({ success: true, tabId: tab.id })).catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }
    if (message.type === "OPEN_STANDALONE_WINDOW") {
      const url = chrome.runtime.getURL("popup.html");
      chrome.windows.create({
        url,
        type: "popup",
        width: 860,
        height: 720
      }).then((win) => sendResponse({ success: true, windowId: win?.id })).catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }
  });
})();
//# sourceMappingURL=background.js.map
