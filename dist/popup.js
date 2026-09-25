"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/services/automation-tab-service.ts
  var AutomationTabService;
  var init_automation_tab_service = __esm({
    "src/services/automation-tab-service.ts"() {
      "use strict";
      AutomationTabService = class _AutomationTabService {
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
    }
  });

  // src/services/dom-delete-service.ts
  var dom_delete_service_exports = {};
  __export(dom_delete_service_exports, {
    DomDeleteService: () => DomDeleteService
  });
  var DomDeleteService;
  var init_dom_delete_service = __esm({
    "src/services/dom-delete-service.ts"() {
      "use strict";
      init_automation_tab_service();
      DomDeleteService = class {
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
    }
  });

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

  // src/services/timeline-scanner-service.ts
  var TimelineScannerService = class {
    /**
     * Extrai o nome de usuário da URL da aba ativa caso esteja em uma página do X.
     */
    static extractUsernameFromUrl(url) {
      try {
        const parsed = new URL(url);
        if (!parsed.hostname.includes("x.com") && !parsed.hostname.includes("twitter.com")) {
          return null;
        }
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length === 0) return null;
        const candidate = parts[0].toLowerCase();
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
        if (reserved.has(candidate)) return null;
        if (/^[a-zA-Z0-9_]{1,15}$/.test(candidate)) {
          return candidate;
        }
        return null;
      } catch {
        return null;
      }
    }
    /**
     * Inicia a varredura na aba ativa do X.
     */
    static async startScan(callbacks) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id || !activeTab.url || !activeTab.url.includes("x.com") && !activeTab.url.includes("twitter.com")) {
        throw new Error("Please open your X profile page (e.g. x.com/your_username) before starting the scan.");
      }
      const targetUsername = this.extractUsernameFromUrl(activeTab.url);
      if (targetUsername) {
        callbacks.onLog(`[SCAN] Target identified: @${targetUsername}. Only your posts and retweets will be collected.`);
      } else {
        callbacks.onLog(`[SCAN] Starting tweet scan on active tab (${activeTab.url})...`);
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["content.js"]
        });
      } catch {
      }
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          activeTab.id,
          { type: "SCAN_TIMELINE_START", maxScrolls: 15, targetUsername: targetUsername || void 0 },
          async (response) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (response && response.success) {
              const tweets = response.tweets || [];
              callbacks.onLog(`[SCAN COMPLETED] Identified ${tweets.length} valid tweets/retweets belonging to the user.`);
              const saved = await StorageService.mergeTweets(tweets, targetUsername || void 0);
              resolve(saved);
            } else {
              reject(new Error(response?.error || "Failed to scan timeline"));
            }
          }
        );
      });
    }
    /**
     * Interrompe a varredura em andamento.
     */
    static async stopScan() {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { type: "SCAN_TIMELINE_STOP" }).catch(() => {
        });
      }
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
          error: "X session not found. Open x.com in your browser to sync your login."
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
              const msg = body.errors[0]?.message || "Internal GraphQL error";
              return { success: false, statusCode: 200, error: msg };
            }
            return { success: true, statusCode: 200 };
          }
          if (res.status === 429) {
            return { success: false, statusCode: 429, isRateLimit: true, error: "Rate limit exceeded (429)" };
          }
        } catch (err) {
          console.warn(`GraphQL DeleteTweet attempt with ${qId} failed:`, err);
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
          return { success: false, statusCode: 429, isRateLimit: true, error: "Rate limit exceeded (429)" };
        }
        if (res.status === 404) {
          return { success: true, statusCode: 404, error: "Tweet already deleted or not found (404)" };
        }
        return {
          success: false,
          statusCode: res.status,
          error: `HTTP request failed: ${res.status} ${res.statusText}`
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
          error: "X session not found. Open x.com in your browser."
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
            return { success: false, statusCode: 429, isRateLimit: true, error: "Rate limit exceeded (429)" };
          }
        } catch (err) {
          console.warn(`GraphQL DeleteRetweet attempt with ${qId} failed:`, err);
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
          return { success: false, statusCode: 429, isRateLimit: true, error: "Rate limit exceeded (429)" };
        }
        return {
          success: false,
          statusCode: res.status,
          error: `HTTP failure: ${res.status}`
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

  // src/services/deletion-executor.ts
  init_dom_delete_service();
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

  // src/popup/popup-main.ts
  init_dom_delete_service();

  // src/services/keep-awake-service.ts
  var KeepAwakeService = class {
    static audioCtx = null;
    static oscillator = null;
    static wakeLock = null;
    static active = false;
    /**
     * Ativa a reprodução de áudio silencioso e Wake Lock para manter o Chrome ativo em segundo plano/minimizado.
     */
    static async enable() {
      if (this.active) return;
      this.active = true;
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          if (!this.audioCtx || this.audioCtx.state === "closed") {
            this.audioCtx = new AudioCtxClass();
          }
          if (this.audioCtx.state === "suspended") {
            await this.audioCtx.resume();
          }
          const osc = this.audioCtx.createOscillator();
          const gainNode = this.audioCtx.createGain();
          gainNode.gain.value = 1e-5;
          osc.connect(gainNode);
          gainNode.connect(this.audioCtx.destination);
          osc.start();
          this.oscillator = osc;
        }
      } catch (err) {
        console.warn("[KeepAwake] Erro ao iniciar AudioContext:", err);
      }
      try {
        if ("wakeLock" in navigator && !this.wakeLock) {
          this.wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
      }
    }
    /**
     * Desativa o keep-awake e libera recursos do navegador.
     */
    static disable() {
      this.active = false;
      try {
        if (this.oscillator) {
          this.oscillator.stop();
          this.oscillator.disconnect();
          this.oscillator = null;
        }
        if (this.audioCtx) {
          this.audioCtx.close().catch(() => {
          });
          this.audioCtx = null;
        }
        if (this.wakeLock) {
          this.wakeLock.release().catch(() => {
          });
          this.wakeLock = null;
        }
      } catch (err) {
        console.warn("[KeepAwake] Erro ao desativar KeepAwake:", err);
      }
    }
    static get isRunning() {
      return this.active;
    }
  };

  // src/components/tab-manager.ts
  var TabManager = class {
    navButtons;
    tabPanes;
    onTabChangeCallback;
    constructor(navButtonsSelector = ".tab-nav-btn", tabPanesSelector = ".tab-pane", onTabChange) {
      this.navButtons = document.querySelectorAll(navButtonsSelector);
      this.tabPanes = document.querySelectorAll(tabPanesSelector);
      this.onTabChangeCallback = onTabChange;
      this.init();
    }
    init() {
      this.navButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetTab = btn.getAttribute("data-tab");
          if (targetTab) {
            this.switchTab(targetTab);
          }
        });
      });
    }
    switchTab(targetTabId) {
      this.navButtons.forEach((btn) => {
        if (btn.getAttribute("data-tab") === targetTabId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      this.tabPanes.forEach((pane) => {
        if (pane.id === targetTabId) {
          pane.classList.add("active");
        } else {
          pane.classList.remove("active");
        }
      });
      if (this.onTabChangeCallback) {
        this.onTabChangeCallback(targetTabId);
      }
    }
  };

  // src/components/tweet-card.ts
  var TweetCard = class {
    /**
     * Renderiza o elemento HTML de um item da lista.
     */
    static render(tweet, onToggleSelect, onDeleteSingle) {
      const card = document.createElement("div");
      card.className = `tweet-card ${tweet.status} ${tweet.selected ? "selected" : ""}`;
      card.id = `tweet-card-${tweet.id}`;
      const dateStr = this.formatDate(tweet.createdAt);
      const badgeType = tweet.isRetweet ? "\u{1F501} Retweet" : "\u{1F4AC} Tweet";
      const badgeClass = tweet.isRetweet ? "badge-retweet" : "badge-tweet";
      let statusText = "";
      if (tweet.status === "pending") statusText = "\u23F3 Deleting...";
      else if (tweet.status === "success") statusText = "\u2705 Deleted";
      else if (tweet.status === "failed") statusText = `\u274C Error: ${tweet.errorMessage || "Failed"}`;
      card.innerHTML = `
      <div class="tweet-card-header">
        <label class="tweet-checkbox-container">
          <input type="checkbox" class="tweet-checkbox" data-id="${tweet.id}" ${tweet.selected ? "checked" : ""} ${tweet.status === "success" ? "disabled" : ""}/>
          <span class="checkmark"></span>
        </label>
        <span class="badge ${badgeClass}">${badgeType}</span>
        <span class="tweet-date">${dateStr}</span>
        <a href="${tweet.url}" target="_blank" rel="noopener noreferrer" class="tweet-link" title="Open on X">\u{1F517}</a>
      </div>
      <div class="tweet-card-body">
        ${tweet.retweetedFrom ? `<div class="retweet-author">Retweeted from <strong>${tweet.retweetedFrom}</strong></div>` : ""}
        ${!tweet.isRetweet && tweet.authorHandle ? `<div class="tweet-author-tag" style="font-size: 11px; color: #8899a6; margin-bottom: 4px;">By <strong>@${tweet.authorHandle}</strong></div>` : ""}
        <div class="tweet-text">${this.escapeHtml(tweet.text)}</div>
        ${statusText ? `<div class="tweet-status-label ${tweet.status}">${statusText}</div>` : ""}
      </div>
      <div class="tweet-card-actions">
        ${tweet.status !== "success" && onDeleteSingle ? `<button type="button" class="btn-single-delete" title="Delete only this">\u{1F5D1}\uFE0F</button>` : ""}
      </div>
    `;
      const checkbox = card.querySelector(".tweet-checkbox");
      checkbox?.addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        card.classList.toggle("selected", isChecked);
        onToggleSelect(tweet.id, isChecked);
      });
      const singleDelBtn = card.querySelector(".btn-single-delete");
      singleDelBtn?.addEventListener("click", () => {
        if (onDeleteSingle) {
          onDeleteSingle(tweet);
        }
      });
      return card;
    }
    static formatDate(dateStr) {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${d.toLocaleDateString("en-US")} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
      } catch {
        return dateStr;
      }
    }
    static escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
  };

  // src/components/tweet-list-view.ts
  var TweetListView = class {
    options;
    tweets = [];
    filter = { keyword: "" };
    constructor(options) {
      this.options = options;
      this.bindEvents();
    }
    bindEvents() {
      if (this.options.filterInput) {
        this.options.filterInput.addEventListener("input", (e) => {
          this.filter.keyword = e.target.value.toLowerCase();
          this.render();
        });
      }
      if (this.options.startDateInput) {
        this.options.startDateInput.addEventListener("change", (e) => {
          this.filter.startDate = e.target.value;
          this.render();
        });
      }
      if (this.options.endDateInput) {
        this.options.endDateInput.addEventListener("change", (e) => {
          this.filter.endDate = e.target.value;
          this.render();
        });
      }
      if (this.options.selectAllBtn) {
        this.options.selectAllBtn.addEventListener("click", () => {
          this.setSelectAllVisible(true);
        });
      }
      if (this.options.deselectAllBtn) {
        this.options.deselectAllBtn.addEventListener("click", () => {
          this.setSelectAllVisible(false);
        });
      }
    }
    setTweets(allTweets) {
      this.tweets = allTweets.filter((t) => t.isRetweet === this.options.isRetweetList);
      this.render();
    }
    getVisibleTweets() {
      return this.tweets.filter((t) => {
        if (this.filter.keyword) {
          const textMatch = t.text.toLowerCase().includes(this.filter.keyword);
          const authorMatch = t.retweetedFrom?.toLowerCase().includes(this.filter.keyword);
          if (!textMatch && !authorMatch) return false;
        }
        if (this.filter.startDate) {
          const itemDate = new Date(t.createdAt).getTime();
          const startDate = new Date(this.filter.startDate).getTime();
          if (itemDate < startDate) return false;
        }
        if (this.filter.endDate) {
          const itemDate = new Date(t.createdAt).getTime();
          const endDate = new Date(this.filter.endDate).setHours(23, 59, 59, 999);
          if (itemDate > endDate) return false;
        }
        return true;
      });
    }
    setSelectAllVisible(select) {
      const visible = this.getVisibleTweets();
      visible.forEach((t) => {
        if (t.status !== "success") {
          t.selected = select;
        }
      });
      this.render();
      this.options.onSelectionChange();
    }
    render() {
      const container = this.options.containerElement;
      container.innerHTML = "";
      const visibleTweets = this.getVisibleTweets();
      this.updateCounter(visibleTweets);
      if (visibleTweets.length === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "empty-state";
        emptyDiv.innerHTML = `
        <p>No ${this.options.isRetweetList ? "retweets" : "tweets"} found.</p>
        <span class="empty-hint">Use the profile scan button or import your Twitter archive.</span>
      `;
        container.appendChild(emptyDiv);
        return;
      }
      const fragment = document.createDocumentFragment();
      visibleTweets.forEach((tweet) => {
        const card = TweetCard.render(
          tweet,
          (id, selected) => {
            const item = this.tweets.find((t) => t.id === id);
            if (item) {
              item.selected = selected;
              this.updateCounter(visibleTweets);
              this.options.onSelectionChange();
            }
          },
          (t) => this.options.onDeleteSingle(t)
        );
        fragment.appendChild(card);
      });
      container.appendChild(fragment);
    }
    updateCounter(visible) {
      if (!this.options.counterElement) return;
      const selectedCount = visible.filter((t) => t.selected && t.status !== "success").length;
      const totalCount = visible.length;
      this.options.counterElement.textContent = `${selectedCount} selected of ${totalCount}`;
    }
  };

  // src/components/test-runner-view.ts
  var TestRunnerView = class {
    options;
    constructor(options) {
      this.options = options;
      this.init();
    }
    init() {
      if (!this.options.urlInput.value) {
        this.options.urlInput.value = "https://x.com/leoplanello/status/1088925139268526085";
      }
      this.options.executeBtn.addEventListener("click", () => {
        this.executeTest();
      });
      this.checkSession();
    }
    async checkSession() {
      const session = await XSessionService.getSession();
      const sessionStatusEl = this.options.containerElement.querySelector(".session-status-badge");
      if (sessionStatusEl) {
        if (session.isLoggedIn) {
          sessionStatusEl.className = "session-status-badge logged-in";
          sessionStatusEl.textContent = "\u{1F7E2} Active X session (ct0 detected)";
        } else {
          sessionStatusEl.className = "session-status-badge logged-out";
          sessionStatusEl.textContent = "\u{1F7E1} Session not detected (open x.com in a browser tab)";
        }
      }
    }
    async executeTest() {
      const rawInput = this.options.urlInput.value.trim();
      if (!rawInput) {
        this.showStatus("Please provide a tweet URL or ID.", "error");
        return;
      }
      const match = rawInput.match(/status\/(\d+)/) || rawInput.match(/^(\d+)$/);
      if (!match) {
        this.showStatus("Invalid URL. Could not extract tweet ID.", "error");
        return;
      }
      const tweetId = match[1];
      const isRetweet = rawInput.includes("/retweet") || this.options.containerElement.querySelector("#test-is-retweet")?.checked || false;
      const baseConfig = this.options.getConfig();
      const selectedMethod = this.options.methodSelect.value;
      const config = {
        ...baseConfig,
        method: selectedMethod || baseConfig.method
      };
      const authorMatch = rawInput.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})\/status/i);
      const authorHandle = authorMatch && authorMatch[1] !== "i" ? authorMatch[1] : void 0;
      const mockItem = {
        id: tweetId,
        text: tweetId === "1088925139268526085" ? "Clima assim \xE9 muuuito melhor" : `Test tweet ${tweetId}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        isRetweet,
        url: rawInput.startsWith("http") ? rawInput : `https://x.com/i/status/${tweetId}`,
        authorHandle,
        selected: true,
        status: "pending"
      };
      this.options.executeBtn.disabled = true;
      this.showStatus(`\u23F3 Starting deletion of tweet ${tweetId} via method ${config.method.toUpperCase()}...`, "info");
      this.options.onLog(`[TEST] Triggering deletion of tweet ${tweetId} using method: ${config.method}`);
      try {
        const result = await DeletionExecutor.execute(mockItem, config, { current: 1, total: 1 });
        if (result.success) {
          this.showStatus(`\u2705 Tweet ${tweetId} deleted successfully! (Status: ${result.statusCode || 200})`, "success");
          this.options.onLog(`[TEST SUCCESS] Tweet ${tweetId} was deleted.`);
          this.options.onSuccess(tweetId);
        } else {
          const errText = result.error || "Unknown error during deletion.";
          this.showStatus(`\u274C Failed to delete tweet: ${errText}`, "error");
          this.options.onLog(`[TEST ERROR] Tweet ${tweetId} failed: ${errText}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.showStatus(`\u274C Unexpected error: ${msg}`, "error");
        this.options.onLog(`[TEST ERROR EXCEPTION] ${msg}`);
      } finally {
        this.options.executeBtn.disabled = false;
        this.checkSession();
        Promise.resolve().then(() => (init_dom_delete_service(), dom_delete_service_exports)).then(({ DomDeleteService: DomDeleteService2 }) => {
          DomDeleteService2.finishSession(false).catch(() => {
          });
        });
      }
    }
    showStatus(msg, type) {
      this.options.statusOutput.textContent = msg;
      this.options.statusOutput.className = `test-status-output ${type}`;
    }
  };

  // src/services/archive-parser-service.ts
  var ArchiveParserService = class {
    /**
     * Processa o conteúdo de um arquivo de arquivo do Twitter (tweets.js / tweet.js ou JSON puro).
     */
    static parse(fileContent) {
      let cleanJson = fileContent.trim();
      if (cleanJson.startsWith("window.YTD")) {
        const equalsIdx = cleanJson.indexOf("=");
        if (equalsIdx !== -1) {
          cleanJson = cleanJson.substring(equalsIdx + 1).trim();
        }
      }
      if (cleanJson.endsWith(";")) {
        cleanJson = cleanJson.slice(0, -1).trim();
      }
      let parsedArray;
      try {
        parsedArray = JSON.parse(cleanJson);
      } catch (e) {
        throw new Error("Formato de arquivo inv\xE1lido. Certifique-se de selecionar o arquivo tweets.js ou .json da exporta\xE7\xE3o do X.");
      }
      if (!Array.isArray(parsedArray)) {
        throw new Error("Conte\xFAdo do arquivo n\xE3o \xE9 uma lista de tweets v\xE1lida.");
      }
      const items = [];
      for (const entry of parsedArray) {
        const t = entry.tweet || entry;
        const id = String(t.id_str || t.id || "");
        if (!id) continue;
        const fullText = t.full_text || t.text || "";
        const isRetweet = Boolean(
          t.retweeted || fullText.startsWith("RT @") || t.retweeted_status || t.retweeted_status_id_str
        );
        let retweetedFrom;
        if (isRetweet && fullText.startsWith("RT @")) {
          const match = fullText.match(/^RT @([a-zA-Z0-9_]+):/);
          if (match) {
            retweetedFrom = `@${match[1]}`;
          }
        }
        const mediaUrls = [];
        const mediaEntities = t.entities?.media || t.extended_entities?.media || [];
        for (const m of mediaEntities) {
          if (m.media_url_https) {
            mediaUrls.push(m.media_url_https);
          }
        }
        items.push({
          id,
          text: fullText,
          createdAt: t.created_at ? new Date(t.created_at).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
          isRetweet,
          retweetedFrom,
          mediaUrls,
          url: `https://x.com/i/status/${id}`,
          selected: false,
          status: "idle"
        });
      }
      return items;
    }
  };

  // src/components/archive-uploader-view.ts
  var ArchiveUploaderView = class {
    options;
    constructor(options) {
      this.options = options;
      this.init();
    }
    init() {
      this.options.fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          this.processFile(file);
        }
      });
      const dropZone = this.options.dropZone;
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
      });
      dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
      });
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        const file = e.dataTransfer?.files?.[0];
        if (file) {
          this.processFile(file);
        }
      });
      dropZone.addEventListener("click", () => {
        this.options.fileInput.click();
      });
    }
    async processFile(file) {
      this.showStatus(`Reading file "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`, "info");
      this.options.onLog(`[ARCHIVE] Processing data file: ${file.name}`);
      try {
        const content = await file.text();
        const items = ArchiveParserService.parse(content);
        if (items.length === 0) {
          this.showStatus("No tweets were found in this file.", "error");
          return;
        }
        const tweetsCount = items.filter((t) => !t.isRetweet).length;
        const rtsCount = items.filter((t) => t.isRetweet).length;
        const merged = await StorageService.mergeTweets(items);
        this.showStatus(
          `\u2705 Import complete! Loaded ${tweetsCount} Tweets and ${rtsCount} Retweets (${items.length} total).`,
          "success"
        );
        this.options.onLog(`[ARCHIVE SUCCESS] ${tweetsCount} tweets and ${rtsCount} retweets cached locally.`);
        this.options.onArchiveLoaded(merged);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.showStatus(`Error processing file: ${msg}`, "error");
        this.options.onLog(`[ARCHIVE ERROR] ${msg}`);
      }
    }
    showStatus(msg, type) {
      this.options.statusElement.textContent = msg;
      this.options.statusElement.className = `archive-status ${type}`;
    }
  };

  // src/components/settings-view.ts
  var SettingsView = class {
    options;
    currentConfig;
    constructor(options) {
      this.options = options;
      this.init();
    }
    async init() {
      this.currentConfig = await StorageService.getConfig();
      this.populateForm();
      this.bindEvents();
    }
    populateForm() {
      this.options.methodSelect.value = this.currentConfig.method;
      this.options.minDelayInput.value = String(this.currentConfig.minDelayMs);
      this.options.maxDelayInput.value = String(this.currentConfig.maxDelayMs);
      this.options.autoPauseCheckbox.checked = this.currentConfig.autoPauseOnRateLimit;
      this.options.cooldownInput.value = String(this.currentConfig.rateLimitCooldownSeconds);
      this.options.customDeleteQueryIdInput.value = this.currentConfig.customDeleteQueryId || "";
    }
    bindEvents() {
      const save = async () => {
        const updated = {
          method: this.options.methodSelect.value,
          minDelayMs: Math.max(200, parseInt(this.options.minDelayInput.value, 10) || 1500),
          maxDelayMs: Math.max(500, parseInt(this.options.maxDelayInput.value, 10) || 3e3),
          autoPauseOnRateLimit: this.options.autoPauseCheckbox.checked,
          rateLimitCooldownSeconds: Math.max(10, parseInt(this.options.cooldownInput.value, 10) || 60),
          maxRetries: 2,
          customDeleteQueryId: this.options.customDeleteQueryIdInput.value.trim()
        };
        this.currentConfig = await StorageService.saveConfig(updated);
        this.options.onConfigChange(this.currentConfig);
        this.showSaveFeedback();
      };
      this.options.methodSelect.addEventListener("change", save);
      this.options.minDelayInput.addEventListener("change", save);
      this.options.maxDelayInput.addEventListener("change", save);
      this.options.autoPauseCheckbox.addEventListener("change", save);
      this.options.cooldownInput.addEventListener("change", save);
      this.options.customDeleteQueryIdInput.addEventListener("change", save);
      this.options.clearCacheBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to clear all loaded tweets from local cache?")) {
          await StorageService.clearTweets();
          this.options.onClearCache();
        }
      });
    }
    showSaveFeedback() {
      this.options.saveFeedbackEl.textContent = "Settings saved!";
      this.options.saveFeedbackEl.classList.add("visible");
      setTimeout(() => {
        this.options.saveFeedbackEl.classList.remove("visible");
      }, 2e3);
    }
    getConfig() {
      return this.currentConfig;
    }
  };

  // src/components/progress-bar-view.ts
  var ProgressBarView = class {
    options;
    constructor(options) {
      this.options = options;
      this.init();
    }
    init() {
      this.options.pauseBtn.addEventListener("click", () => {
        this.options.onTogglePause();
      });
      this.options.cancelBtn.addEventListener("click", () => {
        this.options.onCancel();
      });
    }
    show() {
      this.options.containerElement.classList.add("visible");
    }
    hide() {
      this.options.containerElement.classList.remove("visible");
    }
    update(current, total, customMessage) {
      const percent = total > 0 ? Math.round(current / total * 100) : 0;
      this.options.fillElement.style.width = `${percent}%`;
      this.options.textElement.textContent = customMessage || `Progress: ${current} of ${total} (${percent}%)`;
    }
    setPaused(isPaused) {
      this.options.pauseBtn.textContent = isPaused ? "\u25B6\uFE0F Resume" : "\u23F8\uFE0F Pause";
    }
  };

  // src/components/logger-view.ts
  var LoggerView = class {
    options;
    maxLogs = 200;
    constructor(options) {
      this.options = options;
      this.init();
    }
    init() {
      if (this.options.clearBtn) {
        this.options.clearBtn.addEventListener("click", () => {
          this.clear();
        });
      }
      if (this.options.toggleBtn) {
        this.options.toggleBtn.addEventListener("click", () => {
          this.options.containerElement.classList.toggle("collapsed");
        });
      }
    }
    log(message) {
      const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR");
      const logLine = document.createElement("div");
      logLine.className = "log-line";
      logLine.textContent = `[${timeStr}] ${message}`;
      this.options.logsOutputElement.appendChild(logLine);
      while (this.options.logsOutputElement.children.length > this.maxLogs) {
        this.options.logsOutputElement.removeChild(this.options.logsOutputElement.firstChild);
      }
      this.options.logsOutputElement.scrollTop = this.options.logsOutputElement.scrollHeight;
    }
    clear() {
      this.options.logsOutputElement.innerHTML = "";
    }
  };

  // src/components/window-mode-view.ts
  var WindowModeView = class {
    options;
    constructor(options) {
      this.options = options;
      this.init();
    }
    init() {
      const isFullTab = window.innerWidth > 650 || window.location.search.includes("mode=tab");
      if (isFullTab && this.options.modeBadge) {
        this.options.modeBadge.textContent = "\u{1F5A5}\uFE0F Full Tab Mode";
        this.options.modeBadge.classList.add("visible");
      }
      if (this.options.openTabBtn) {
        this.options.openTabBtn.addEventListener("click", () => {
          this.openInNewTab();
        });
      }
      if (this.options.openWindowBtn) {
        this.options.openWindowBtn.addEventListener("click", () => {
          this.openInStandaloneWindow();
        });
      }
    }
    openInNewTab() {
      const url = chrome.runtime.getURL("popup.html?mode=tab");
      chrome.tabs.create({ url }).then(() => {
        this.options.onLog?.("Extension opened in a permanent full tab (will not close when clicking away).");
      }).catch((err) => {
        console.error("Error opening tab:", err);
      });
    }
    openInStandaloneWindow() {
      const url = chrome.runtime.getURL("popup.html?mode=window");
      chrome.windows.create({
        url,
        type: "popup",
        width: 860,
        height: 720
      }).then(() => {
        this.options.onLog?.("Extension opened in a standalone window.");
      }).catch((err) => {
        console.error("Error opening window:", err);
      });
    }
  };

  // src/popup/popup-main.ts
  var PopupController = class {
    allTweets = [];
    isBatchPaused = false;
    // Subcomponentes
    tabManager;
    loggerView;
    progressBarView;
    settingsView;
    testRunnerView;
    archiveUploaderView;
    tweetsListView;
    retweetsListView;
    windowModeView;
    // Elementos globais do DOM
    sessionBadgeEl;
    scanBtn;
    bulkDeleteBtn;
    bulkSelectionLabel;
    badgeTweetsCount;
    badgeRtsCount;
    bgRunningBanner;
    bgRunningText;
    async init() {
      this.bindGlobalElements();
      this.initComponents();
      this.setupBackgroundMessageListeners();
      await this.loadInitialData();
      await this.checkSession();
      await this.checkOngoingBackgroundJob();
    }
    bindGlobalElements() {
      this.sessionBadgeEl = document.getElementById("session-badge");
      this.scanBtn = document.getElementById("btn-scan-timeline");
      this.bulkDeleteBtn = document.getElementById("btn-delete-selected");
      this.bulkSelectionLabel = document.getElementById("bulk-selection-label");
      this.badgeTweetsCount = document.getElementById("badge-tweets-count");
      this.badgeRtsCount = document.getElementById("badge-rts-count");
      this.bgRunningBanner = document.getElementById("bg-running-banner");
      this.bgRunningText = document.getElementById("bg-running-text");
      this.scanBtn.addEventListener("click", () => this.handleScanTimeline());
      this.bulkDeleteBtn.addEventListener("click", () => this.handleBulkDelete());
    }
    initComponents() {
      this.tabManager = new TabManager(".tab-nav-btn", ".tab-pane");
      this.loggerView = new LoggerView({
        containerElement: document.getElementById("logger-container"),
        logsOutputElement: document.getElementById("logger-output"),
        clearBtn: document.getElementById("btn-clear-logs"),
        toggleBtn: document.getElementById("btn-toggle-logs")
      });
      this.progressBarView = new ProgressBarView({
        containerElement: document.getElementById("progress-container"),
        fillElement: document.getElementById("progress-bar-fill"),
        textElement: document.getElementById("progress-text"),
        pauseBtn: document.getElementById("btn-pause-process"),
        cancelBtn: document.getElementById("btn-cancel-process"),
        onTogglePause: () => {
          if (this.isBatchPaused) {
            chrome.runtime.sendMessage({ type: "RESUME_BATCH_JOB" });
            this.progressBarView.setPaused(false);
            this.isBatchPaused = false;
            this.loggerView.log("Background resume requested.");
          } else {
            chrome.runtime.sendMessage({ type: "PAUSE_BATCH_JOB" });
            this.progressBarView.setPaused(true);
            this.isBatchPaused = true;
            this.loggerView.log("Background pause requested.");
          }
        },
        onCancel: () => {
          chrome.runtime.sendMessage({ type: "CANCEL_BATCH_JOB" });
          this.progressBarView.hide();
          this.hideRunningBanner();
          KeepAwakeService.disable();
          this.bulkDeleteBtn.disabled = false;
          this.loggerView.log("Cancellation requested.");
        }
      });
      this.settingsView = new SettingsView({
        methodSelect: document.getElementById("settings-method"),
        minDelayInput: document.getElementById("settings-min-delay"),
        maxDelayInput: document.getElementById("settings-max-delay"),
        autoPauseCheckbox: document.getElementById("settings-auto-pause"),
        cooldownInput: document.getElementById("settings-cooldown"),
        customDeleteQueryIdInput: document.getElementById("settings-query-id"),
        clearCacheBtn: document.getElementById("btn-clear-cache"),
        saveFeedbackEl: document.getElementById("settings-save-feedback"),
        onConfigChange: (cfg) => {
          this.loggerView.log(`Settings saved: Method ${cfg.method.toUpperCase()} | Delay ${cfg.minDelayMs}-${cfg.maxDelayMs}ms`);
        },
        onClearCache: () => {
          this.allTweets = [];
          this.syncTweetsToLists();
          this.loggerView.log("Tweet cache cleared.");
        }
      });
      this.windowModeView = new WindowModeView({
        openTabBtn: document.getElementById("btn-open-tab"),
        openWindowBtn: document.getElementById("btn-open-window"),
        modeBadge: document.getElementById("mode-badge"),
        onLog: (msg) => this.loggerView.log(msg)
      });
      const settingsTabBtn = document.getElementById("btn-settings-open-tab");
      const settingsWinBtn = document.getElementById("btn-settings-open-window");
      if (settingsTabBtn) {
        settingsTabBtn.addEventListener("click", () => this.windowModeView.openInNewTab());
      }
      if (settingsWinBtn) {
        settingsWinBtn.addEventListener("click", () => this.windowModeView.openInStandaloneWindow());
      }
      this.testRunnerView = new TestRunnerView({
        containerElement: document.getElementById("tab-test"),
        urlInput: document.getElementById("test-url-input"),
        methodSelect: document.getElementById("test-method-select"),
        executeBtn: document.getElementById("btn-run-test-delete"),
        statusOutput: document.getElementById("test-status-output"),
        getConfig: () => this.settingsView.getConfig(),
        onSuccess: (deletedId) => {
          this.markTweetAsDeleted(deletedId);
        },
        onLog: (msg) => this.loggerView.log(msg)
      });
      this.archiveUploaderView = new ArchiveUploaderView({
        fileInput: document.getElementById("archive-file-input"),
        dropZone: document.getElementById("archive-dropzone"),
        statusElement: document.getElementById("archive-status"),
        onArchiveLoaded: (items) => {
          this.allTweets = items;
          this.syncTweetsToLists();
          this.tabManager.switchTab("tab-tweets");
        },
        onLog: (msg) => this.loggerView.log(msg)
      });
      this.tweetsListView = new TweetListView({
        containerElement: document.getElementById("tweets-list-container"),
        filterInput: document.getElementById("tweets-filter-input"),
        startDateInput: document.getElementById("tweets-date-start"),
        endDateInput: document.getElementById("tweets-date-end"),
        selectAllBtn: document.getElementById("tweets-select-all"),
        deselectAllBtn: document.getElementById("tweets-deselect-all"),
        counterElement: document.getElementById("tweets-selection-counter"),
        isRetweetList: false,
        onSelectionChange: () => this.updateBulkSelectionState(),
        onDeleteSingle: (t) => this.handleDeleteSingle(t)
      });
      this.retweetsListView = new TweetListView({
        containerElement: document.getElementById("rts-list-container"),
        filterInput: document.getElementById("rts-filter-input"),
        startDateInput: document.getElementById("rts-date-start"),
        endDateInput: document.getElementById("rts-date-end"),
        selectAllBtn: document.getElementById("rts-select-all"),
        deselectAllBtn: document.getElementById("rts-deselect-all"),
        counterElement: document.getElementById("rts-selection-counter"),
        isRetweetList: true,
        onSelectionChange: () => this.updateBulkSelectionState(),
        onDeleteSingle: (t) => this.handleDeleteSingle(t)
      });
    }
    setupBackgroundMessageListeners() {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "BATCH_JOB_STATE_UPDATE") {
          this.handleStateUpdate(message.state);
        } else if (message.type === "BATCH_JOB_ITEM_COMPLETED") {
          const item = message.item;
          const local = this.allTweets.find((t) => t.id === item.id);
          if (local) {
            local.status = item.status;
            local.selected = false;
            local.errorMessage = item.errorMessage;
          }
          const el = document.getElementById(`tweet-card-${item.id}`);
          if (el) {
            el.className = `tweet-card ${item.status}`;
          }
          this.updateBulkSelectionState();
        } else if (message.type === "BATCH_JOB_LOG") {
          this.loggerView.log(message.message);
        } else if (message.type === "BATCH_JOB_DONE") {
          this.progressBarView.hide();
          this.hideRunningBanner();
          KeepAwakeService.disable();
          this.bulkDeleteBtn.disabled = false;
          StorageService.getTweets().then((tweets) => {
            this.allTweets = tweets;
            this.syncTweetsToLists();
          });
          this.loggerView.log(
            `[BATCH COMPLETE] Done! ${message.summary.successCount} deleted, ${message.summary.failCount} failed.`
          );
        }
      });
    }
    async checkOngoingBackgroundJob() {
      const savedLogs = await StorageService.getBatchJobLogs();
      if (savedLogs && savedLogs.length > 0) {
        for (const l of savedLogs.slice(-15)) {
          this.loggerView.log(l);
        }
      }
      chrome.runtime.sendMessage({ type: "GET_BATCH_JOB_STATE" }, (state) => {
        if (chrome.runtime.lastError || !state) return;
        if (state.status === "running" || state.status === "paused") {
          this.handleStateUpdate(state);
        }
      });
    }
    handleStateUpdate(state) {
      if (state.status === "running") {
        this.progressBarView.show();
        this.progressBarView.setPaused(false);
        this.progressBarView.update(state.current, state.total, state.message);
        this.showRunningBanner();
        this.bulkDeleteBtn.disabled = true;
        this.isBatchPaused = false;
        KeepAwakeService.enable();
      } else if (state.status === "paused") {
        this.progressBarView.show();
        this.progressBarView.setPaused(true);
        this.progressBarView.update(state.current, state.total, state.message);
        this.showRunningBanner("Process paused in background.");
        this.bulkDeleteBtn.disabled = true;
        this.isBatchPaused = true;
      } else if (state.status === "completed" || state.status === "aborted") {
        this.progressBarView.hide();
        this.hideRunningBanner();
        KeepAwakeService.disable();
        this.bulkDeleteBtn.disabled = false;
        this.isBatchPaused = false;
        StorageService.getTweets().then((tweets) => {
          this.allTweets = tweets;
          this.syncTweetsToLists();
        });
      }
    }
    showRunningBanner(text) {
      if (this.bgRunningBanner) {
        this.bgRunningBanner.style.display = "flex";
      }
      if (this.bgRunningText && text) {
        this.bgRunningText.textContent = text;
      } else if (this.bgRunningText) {
        this.bgRunningText.textContent = "Running in background. Safe to click away or minimize.";
      }
    }
    hideRunningBanner() {
      if (this.bgRunningBanner) {
        this.bgRunningBanner.style.display = "none";
      }
    }
    async loadInitialData() {
      this.allTweets = await StorageService.getTweets();
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (activeTab?.url) {
          const usernameMatch = activeTab.url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})/i);
          const candidate = usernameMatch?.[1]?.toLowerCase();
          const reserved = /* @__PURE__ */ new Set(["home", "explore", "notifications", "messages", "i", "compose", "search", "settings"]);
          if (candidate && !reserved.has(candidate)) {
            const beforeCount = this.allTweets.length;
            this.allTweets = StorageService.filterValidUserTweets(this.allTweets, candidate);
            if (this.allTweets.length < beforeCount) {
              await StorageService.saveTweets(this.allTweets);
              this.loggerView.log(
                `[AUTO CLEANUP] ${beforeCount - this.allTweets.length} third-party reply(ies) removed from local history.`
              );
            }
          }
        }
      } catch {
      }
      this.syncTweetsToLists();
      this.loggerView.log(`Extension loaded. ${this.allTweets.length} items in local cache.`);
    }
    async checkSession() {
      const session = await XSessionService.getSession();
      if (session.isLoggedIn) {
        this.sessionBadgeEl.className = "session-status-badge logged-in";
        this.sessionBadgeEl.textContent = "\u{1F7E2} Connected to X";
      } else {
        this.sessionBadgeEl.className = "session-status-badge logged-out";
        this.sessionBadgeEl.textContent = "\u{1F7E1} Not logged in to X";
      }
    }
    syncTweetsToLists() {
      this.tweetsListView.setTweets(this.allTweets);
      this.retweetsListView.setTweets(this.allTweets);
      const tweetsCount = this.allTweets.filter((t) => !t.isRetweet && t.status !== "success").length;
      const rtsCount = this.allTweets.filter((t) => t.isRetweet && t.status !== "success").length;
      this.badgeTweetsCount.textContent = String(tweetsCount);
      this.badgeRtsCount.textContent = String(rtsCount);
      this.updateBulkSelectionState();
    }
    updateBulkSelectionState() {
      const selectedItems = this.allTweets.filter((t) => t.selected && t.status !== "success");
      const selectedCount = selectedItems.length;
      if (selectedCount > 0) {
        this.bulkDeleteBtn.disabled = false;
        this.bulkDeleteBtn.textContent = `\u{1F5D1}\uFE0F Delete Selected (${selectedCount})`;
        const tweetsSel = selectedItems.filter((t) => !t.isRetweet).length;
        const rtsSel = selectedItems.filter((t) => t.isRetweet).length;
        this.bulkSelectionLabel.textContent = `${selectedCount} item(s) selected (${tweetsSel} tweets, ${rtsSel} retweets)`;
      } else {
        this.bulkDeleteBtn.disabled = true;
        this.bulkDeleteBtn.textContent = "\u{1F5D1}\uFE0F Delete Selected (0)";
        this.bulkSelectionLabel.textContent = "No tweets selected";
      }
    }
    async handleScanTimeline() {
      this.scanBtn.disabled = true;
      this.scanBtn.textContent = "\u23F3 Scanning...";
      this.loggerView.log("Starting scan of open profile timeline...");
      await KeepAwakeService.enable();
      try {
        const tweets = await TimelineScannerService.startScan({
          onProgress: (found) => {
            this.loggerView.log(`Scan in progress: ${found} visible tweets found...`);
          },
          onLog: (msg) => this.loggerView.log(msg)
        });
        this.allTweets = tweets;
        this.syncTweetsToLists();
        this.loggerView.log(`Scan completed successfully. Total in cache: ${tweets.length}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.loggerView.log(`[SCAN ERROR] ${msg}`);
        alert(`Notice: ${msg}`);
      } finally {
        this.scanBtn.disabled = false;
        this.scanBtn.textContent = "\u{1F50D} Scan Profile";
        KeepAwakeService.disable();
      }
    }
    async handleDeleteSingle(tweet) {
      if (!confirm(`Are you sure you want to permanently delete this ${tweet.isRetweet ? "retweet" : "tweet"}?
"${tweet.text.slice(0, 80)}..."`)) {
        return;
      }
      tweet.status = "pending";
      this.syncTweetsToLists();
      this.loggerView.log(`Starting single deletion of ${tweet.id}...`);
      const config = this.settingsView.getConfig();
      const res = await DeletionExecutor.execute(tweet, config, { current: 1, total: 1 });
      if (res.success) {
        this.markTweetAsDeleted(tweet.id);
        this.loggerView.log(`\u2705 Tweet ${tweet.id} deleted successfully.`);
      } else {
        tweet.status = "failed";
        tweet.errorMessage = res.error;
        this.syncTweetsToLists();
        this.loggerView.log(`\u274C Failed to delete ${tweet.id}: ${res.error}`);
      }
      await DomDeleteService.finishSession(false).catch(() => {
      });
    }
    async handleBulkDelete() {
      const selected = this.allTweets.filter((t) => t.selected && t.status !== "success");
      if (selected.length === 0) return;
      const confirmMsg = `WARNING: Irreversible action!

Are you sure you want to permanently delete the ${selected.length} selected items?

(The process will continue running in the background even if you click away or minimize the browser.)`;
      if (!confirm(confirmMsg)) return;
      const config = this.settingsView.getConfig();
      this.bulkDeleteBtn.disabled = true;
      this.progressBarView.show();
      this.progressBarView.setPaused(false);
      this.progressBarView.update(0, selected.length, `Starting batch of ${selected.length} items in background...`);
      this.showRunningBanner();
      await KeepAwakeService.enable();
      this.loggerView.log(`[BACKGROUND BATCH] Dispatching ${selected.length} item(s) to background processor...`);
      const req = {
        type: "START_BATCH_JOB",
        items: this.allTweets,
        config
      };
      chrome.runtime.sendMessage(req, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          const err = chrome.runtime.lastError?.message || response?.error || "Unknown error starting background batch";
          this.loggerView.log(`\u274C [BATCH START FAILED] ${err}`);
          this.progressBarView.hide();
          this.hideRunningBanner();
          KeepAwakeService.disable();
          this.bulkDeleteBtn.disabled = false;
          alert(`Could not start batch: ${err}`);
        } else {
          this.loggerView.log("\u26A1 Batch started in background. You can safely close the popup, browse, or minimize the browser!");
        }
      });
    }
    markTweetAsDeleted(id) {
      const item = this.allTweets.find((t) => t.id === id);
      if (item) {
        item.status = "success";
        item.selected = false;
      }
      StorageService.saveTweets(this.allTweets);
      this.syncTweetsToLists();
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    const controller = new PopupController();
    controller.init().catch(console.error);
  });
})();
//# sourceMappingURL=popup.js.map
