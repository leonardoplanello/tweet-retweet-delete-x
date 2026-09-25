/**
 * Background Service Worker da extensão.
 * Gerencia a execução em segundo plano de exclusões e mantém o processo vivo.
 */
import { StorageService } from '../services/storage-service';
import { XSessionService } from '../services/x-session-service';
import { BackgroundJobService } from '../services/background-job-service';

const jobService = BackgroundJobService.getInstance();

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Tweet Purge Extension instalada com sucesso.');
    await StorageService.getConfig(); // Inicializa configs padrão
  }
});

// Listener de alarmes para manter o Service Worker acordado durante lotes
chrome.alarms.onAlarm.addListener((alarm) => {
  jobService.handleAlarm(alarm).catch(console.error);
});

// Listener para solicitações de credenciais, controle de lote e janelas
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SESSION_AUTH') {
    XSessionService.getSession()
      .then((session) => sendResponse(session))
      .catch((err) => sendResponse({ isLoggedIn: false, error: String(err) }));
    return true;
  }

  if (message.type === 'START_BATCH_JOB') {
    jobService.startJob(message.items, message.config)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  if (message.type === 'PAUSE_BATCH_JOB') {
    jobService.pauseJob()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  if (message.type === 'RESUME_BATCH_JOB') {
    jobService.resumeJob()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  if (message.type === 'CANCEL_BATCH_JOB') {
    jobService.cancelJob()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  if (message.type === 'GET_BATCH_JOB_STATE') {
    jobService.getState()
      .then((state) => sendResponse(state))
      .catch((err) => sendResponse({ error: String(err) }));
    return true;
  }

  if (message.type === 'OPEN_FULL_TAB') {
    const url = chrome.runtime.getURL('popup.html');
    chrome.tabs.create({ url })
      .then((tab) => sendResponse({ success: true, tabId: tab.id }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  if (message.type === 'OPEN_STANDALONE_WINDOW') {
    const url = chrome.runtime.getURL('popup.html');
    chrome.windows.create({
      url,
      type: 'popup',
      width: 860,
      height: 720
    })
      .then((win) => sendResponse({ success: true, windowId: win?.id }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }
});
