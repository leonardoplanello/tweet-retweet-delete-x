/**
 * Ponto de entrada do Content Script injetado nas páginas do x.com e twitter.com.
 */
import { DomClicker } from './dom-clicker';
import { DomScanner } from './dom-scanner';
import { AutomationHud } from './automation-hud';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING_AUTOMATION') {
    sendResponse({ pong: true });
    return false;
  }

  if (message.type === 'REMOVE_AUTOMATION_HUD') {
    AutomationHud.remove();
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'DOM_DELETE_TWEET') {
    DomClicker.deleteTweetByDom(message.tweetId, {
      current: message.current,
      total: message.total,
      targetAuthor: message.targetAuthor
    })
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true; // Resposta assíncrona
  }

  if (message.type === 'DOM_UNRETWEET') {
    DomClicker.unretweetByDom(message.tweetId, {
      current: message.current,
      total: message.total,
      targetAuthor: message.targetAuthor
    })
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  if (message.type === 'SCAN_TIMELINE_START') {
    DomScanner.scanWithScroll(
      message.maxScrolls || 12,
      (tweets) => {
        chrome.runtime.sendMessage({
          type: 'SCAN_TIMELINE_PROGRESS',
          foundCount: tweets.length,
          tweets
        }).catch(() => {});
      },
      message.targetUsername
    )
      .then((allTweets) => {
        sendResponse({ success: true, tweets: allTweets });
      })
      .catch((err) => {
        sendResponse({ success: false, error: String(err) });
      });
    return true;
  }

  if (message.type === 'SCAN_TIMELINE_STOP') {
    DomScanner.stopScan();
    sendResponse({ success: true });
    return false;
  }
});
