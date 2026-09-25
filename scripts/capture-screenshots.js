const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const CSS_FILE = path.join(__dirname, '..', 'dist', 'popup.css');
const cssContent = fs.readFileSync(CSS_FILE, 'utf-8');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Base Template
function getHtmlTemplate(title, tabNavHtml, activeTabContent, bannerHtml = '', footerHtml = '', loggerHtml = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    ${cssContent}
    body {
      width: 540px;
      height: 700px;
      margin: 0;
      padding: 0;
      background: #000000;
      box-shadow: 0 0 24px rgba(0, 0, 0, 0.9);
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .app-container {
      height: 100%;
      border: 1px solid #2f3336;
      border-radius: 8px;
    }
    .session-status-badge.logged-in {
      background-color: rgba(0, 186, 124, 0.18);
      color: #00ba7c;
      border: 1px solid rgba(0, 186, 124, 0.4);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  </style>
</head>
<body>
  <div class="app-container">
    <header class="app-header">
      <div class="header-brand">
        <span class="brand-icon">⚡</span>
        <h1>Tweet Delete</h1>
      </div>
      <div class="header-actions">
        <button class="btn-icon" title="Open in permanent tab">⤢ Tab</button>
        <button class="btn-icon" title="Open in standalone window">🗗 Window</button>
        <span class="session-status-badge logged-in">🟢 @leoplanello</span>
        <button class="btn-primary-sm">🔍 Scan Profile</button>
      </div>
    </header>

    ${bannerHtml}

    <nav class="tab-nav">
      ${tabNavHtml}
    </nav>

    <main class="app-main">
      ${activeTabContent}
    </main>

    ${footerHtml || `
    <footer class="app-footer">
      <div class="action-bar-content">
        <div class="selection-summary">
          <span id="bulk-selection-label">3 tweets selected</span>
        </div>
        <button class="btn-danger">
          🗑️ Delete Selected (3)
        </button>
      </div>
    </footer>
    `}

    ${loggerHtml || `
    <aside class="logger-container collapsed">
      <div class="logger-header">
        <span class="logger-title">📜 Execution Console</span>
        <div class="logger-header-actions">
          <button class="btn-xs">Clear</button>
          <button class="btn-xs">Toggle</button>
        </div>
      </div>
    </aside>
    `}
  </div>
</body>
</html>`;
}

// 2. Banner HTML Generator
function getBannerHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 1000px;
      height: 440px;
      background: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      overflow: hidden;
      position: relative;
    }
    .banner-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 80% 20%, rgba(29, 155, 240, 0.25) 0%, transparent 50%),
                  radial-gradient(circle at 20% 80%, rgba(0, 186, 124, 0.18) 0%, transparent 50%),
                  linear-gradient(135deg, #050709 0%, #0d1117 100%);
      z-index: 1;
    }
    .grid-lines {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 32px 32px;
      z-index: 2;
    }
    .banner-content {
      position: relative;
      z-index: 10;
      text-align: center;
      max-width: 860px;
      padding: 40px;
    }
    .banner-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(29, 155, 240, 0.15);
      border: 1px solid rgba(29, 155, 240, 0.4);
      color: #1d9bf0;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    h1 {
      font-size: 42px;
      font-weight: 800;
      margin: 0 0 14px 0;
      background: linear-gradient(135deg, #ffffff 40%, #1d9bf0 80%, #00ba7c 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }
    p {
      font-size: 17px;
      color: #8b98a5;
      margin: 0 auto 28px auto;
      max-width: 720px;
      line-height: 1.5;
    }
    .feature-pills {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .pill {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(8px);
      padding: 8px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      color: #e7e9ea;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pill-icon {
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="banner-bg"></div>
  <div class="grid-lines"></div>
  <div class="banner-content">
    <div class="banner-badge">
      <span>⚡ Chrome Extension Manifest V3</span>
    </div>
    <h1>Tweet & Retweet Delete for X</h1>
    <p>Smart timeline scanning, fine filters by date/keyword, and batch deletion with strict separation of Tweets and Retweets — without paying for the official API.</p>
    <div class="feature-pills">
      <div class="pill"><span class="pill-icon">💬</span> Fine Tweet Filters</div>
      <div class="pill"><span class="pill-icon">🔁</span> Bulk Unretweet</div>
      <div class="pill"><span class="pill-icon">🛡️</span> Resilient Background Queue</div>
      <div class="pill"><span class="pill-icon">⏱️</span> Smart Anti-Rate Limit</div>
      <div class="pill"><span class="pill-icon">📁</span> Official Archive Importer</div>
    </div>
  </div>
</body>
</html>`;
}

// 3. Screens Definitions in English
const screens = [
  {
    name: 'hero-banner.png',
    width: 1000,
    height: 440,
    html: getBannerHtml()
  },
  {
    name: '01-tweets-list.png',
    width: 540,
    height: 700,
    html: getHtmlTemplate(
      'Tweets Tab',
      `
      <button class="tab-nav-btn active">💬 Tweets <span class="tab-counter">38</span></button>
      <button class="tab-nav-btn">🔁 Retweets <span class="tab-counter">14</span></button>
      <button class="tab-nav-btn">🎯 Test / URL</button>
      <button class="tab-nav-btn">📁 .js Archive</button>
      <button class="tab-nav-btn">⚙️ Settings</button>
      `,
      `
      <section class="tab-pane active">
        <div class="list-controls">
          <input type="text" class="search-input" value="project" placeholder="Search tweet text...">
          <div class="date-filter-group">
            <input type="date" class="date-input" value="2022-01-01">
            <span>to</span>
            <input type="date" class="date-input" value="2024-12-31">
          </div>
          <div class="selection-actions">
            <button class="btn-subtle">Select all</button>
            <button class="btn-subtle">Deselect</button>
            <span class="selection-counter">3 of 38 selected</span>
          </div>
        </div>

        <div class="tweets-scroll-container">
          <!-- Card 1 (Selected) -->
          <div class="tweet-card selected">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox" checked>
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">10/14/2023 6:42 PM</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Starting development on the new modular architecture for this project. Clean architecture and zero heavy dependencies make all the difference! 🚀</div>
            </div>
            <div class="tweet-card-actions">
              <button class="btn-single-delete" title="Delete only this">🗑️</button>
            </div>
          </div>

          <!-- Card 2 (Selected) -->
          <div class="tweet-card selected">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox" checked>
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">06/09/2023 11:15 AM</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Fine-tuning automated tests before pushing the production deploy. Test coverage saved the weekend.</div>
            </div>
            <div class="tweet-card-actions">
              <button class="btn-single-delete">🗑️</button>
            </div>
          </div>

          <!-- Card 3 (Not Selected) -->
          <div class="tweet-card">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox">
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">02/22/2022 9:30 AM</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Studying new Manifest V3 features for Google Chrome extensions. The transition to service workers changes a lot!</div>
            </div>
            <div class="tweet-card-actions">
              <button class="btn-single-delete">🗑️</button>
            </div>
          </div>

          <!-- Card 4 (Already Deleted) -->
          <div class="tweet-card success">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox" disabled>
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">01/10/2022 2:05 PM</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Testing mutation endpoint on X.</div>
              <div class="tweet-status-label success">✅ Deleted successfully</div>
            </div>
          </div>
        </div>
      </section>
      `
    )
  },
  {
    name: '02-retweets-list.png',
    width: 540,
    height: 700,
    html: getHtmlTemplate(
      'Retweets Tab',
      `
      <button class="tab-nav-btn">💬 Tweets <span class="tab-counter">38</span></button>
      <button class="tab-nav-btn active">🔁 Retweets <span class="tab-counter">14</span></button>
      <button class="tab-nav-btn">🎯 Test / URL</button>
      <button class="tab-nav-btn">📁 .js Archive</button>
      <button class="tab-nav-btn">⚙️ Settings</button>
      `,
      `
      <section class="tab-pane active">
        <div class="list-controls">
          <input type="text" class="search-input" placeholder="Search text or retweeted author...">
          <div class="date-filter-group">
            <input type="date" class="date-input">
            <span>to</span>
            <input type="date" class="date-input">
          </div>
          <div class="selection-actions">
            <button class="btn-subtle">Select all</button>
            <button class="btn-subtle">Deselect</button>
            <span class="selection-counter">2 of 14 selected</span>
          </div>
        </div>

        <div class="tweets-scroll-container">
          <!-- Retweet Card 1 -->
          <div class="tweet-card selected">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox" checked>
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-retweet">🔁 Retweet</span>
              <span class="tweet-date">08/18/2024 4:20 PM</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="retweet-author">Retweeted from <strong>@paulg</strong></div>
              <div class="tweet-text">The most impressive people I know are not the ones who never fail, but the ones who iterate tenaciously until they find something that works.</div>
            </div>
            <div class="tweet-card-actions">
              <button class="btn-single-delete" title="Undo Retweet">🗑️</button>
            </div>
          </div>

          <!-- Retweet Card 2 -->
          <div class="tweet-card selected">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox" checked>
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-retweet">🔁 Retweet</span>
              <span class="tweet-date">05/02/2023 9:05 PM</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="retweet-author">Retweeted from <strong>@sama</strong></div>
              <div class="tweet-text">The future will be shaped by the people who build things rather than the people who talk about building things.</div>
            </div>
            <div class="tweet-card-actions">
              <button class="btn-single-delete">🗑️</button>
            </div>
          </div>

          <!-- Retweet Card 3 -->
          <div class="tweet-card">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox">
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-retweet">🔁 Retweet</span>
              <span class="tweet-date">11/15/2021 12:45 PM</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="retweet-author">Retweeted from <strong>@github</strong></div>
              <div class="tweet-text">Did you know? You can customize your profile README with live GitHub actions and pinned projects.</div>
            </div>
            <div class="tweet-card-actions">
              <button class="btn-single-delete">🗑️</button>
            </div>
          </div>
        </div>
      </section>
      `,
      '',
      `
      <footer class="app-footer">
        <div class="action-bar-content">
          <div class="selection-summary">
            <span>2 retweets selected</span>
          </div>
          <button class="btn-danger">
            🔁 Undo Retweets (2)
          </button>
        </div>
      </footer>
      `
    )
  },
  {
    name: '03-direct-url-delete.png',
    width: 540,
    height: 700,
    html: getHtmlTemplate(
      'Direct URL Tab',
      `
      <button class="tab-nav-btn">💬 Tweets <span class="tab-counter">38</span></button>
      <button class="tab-nav-btn">🔁 Retweets <span class="tab-counter">14</span></button>
      <button class="tab-nav-btn active">🎯 Test / URL</button>
      <button class="tab-nav-btn">📁 .js Archive</button>
      <button class="tab-nav-btn">⚙️ Settings</button>
      `,
      `
      <section class="tab-pane active">
        <div class="test-runner-panel">
          <div class="test-header">
            <h3>Direct Deletion / Test Tweet</h3>
            <p class="section-desc">Delete a specific tweet by providing its URL or ID directly without needing to scan your timeline.</p>
          </div>

          <div class="test-tweet-preview-box">
            <div class="preview-title">Target test tweet:</div>
            <div class="preview-url">https://x.com/leoplanello/status/1088925139268526085</div>
            <div class="preview-quote">"Clima assim é muuuito melhor"</div>
          </div>

          <div class="form-group">
            <label for="test-url-input">Tweet URL or ID:</label>
            <input type="text" class="text-input" value="https://x.com/leoplanello/status/1088925139268526085">
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label for="test-method-select">Deletion Method:</label>
              <select class="select-input">
                <option selected>Direct UI Navigation (Recommended)</option>
                <option>Hybrid (GraphQL with DOM fallback)</option>
                <option>Internal GraphQL / REST</option>
              </select>
            </div>
            <div class="form-group half checkbox-group" style="padding-top: 20px;">
              <label>
                <input type="checkbox">
                Is a Retweet (Unretweet)
              </label>
            </div>
          </div>

          <button class="btn-danger-lg" style="margin-top: 8px;">
            🗑️ Delete This Tweet Now
          </button>

          <div class="test-status-output success" style="display: block; margin-top: 12px;">
            ✅ Success: Post located and confirmed deleted via DOM automation on X!
          </div>
        </div>
      </section>
      `
    )
  },
  {
    name: '04-archive-importer.png',
    width: 540,
    height: 700,
    html: getHtmlTemplate(
      'Archive Tab',
      `
      <button class="tab-nav-btn">💬 Tweets <span class="tab-counter">38</span></button>
      <button class="tab-nav-btn">🔁 Retweets <span class="tab-counter">14</span></button>
      <button class="tab-nav-btn">🎯 Test / URL</button>
      <button class="tab-nav-btn active">📁 .js Archive</button>
      <button class="tab-nav-btn">⚙️ Settings</button>
      `,
      `
      <section class="tab-pane active">
        <div class="archive-panel">
          <h3>Load Official Twitter Archive</h3>
          <p class="section-desc">
            X only displays up to 3,200 tweets on web profiles. To delete your entire account history, import the official <code>tweets.js</code> file exported from X.
          </p>

          <div class="dropzone drag-over">
            <span class="dropzone-icon">📁</span>
            <div class="dropzone-text">
              <strong>File loaded: tweets.js</strong>
              <span style="color: #00ba7c; font-weight: 600;">✓ 4,820 tweets and 930 retweets indexed successfully!</span>
            </div>
          </div>

          <div class="archive-status success" style="display: block;">
            🎉 Success! 5,750 posts loaded into local memory ready for filtering and batch deletion.
          </div>

          <div class="archive-instructions">
            <h4>How to download your archive from X:</h4>
            <ol>
              <li>On X, navigate to <em>More &gt; Settings and privacy &gt; Your account &gt; Download an archive of your data</em>.</li>
              <li>Wait for confirmation email from X and download the <code>.zip</code> file.</li>
              <li>Extract the archive, open the <code>data/</code> folder, and drag <code>tweets.js</code> here.</li>
            </ol>
          </div>
        </div>
      </section>
      `
    )
  },
  {
    name: '05-settings-cadence.png',
    width: 540,
    height: 700,
    html: getHtmlTemplate(
      'Settings Tab',
      `
      <button class="tab-nav-btn">💬 Tweets <span class="tab-counter">38</span></button>
      <button class="tab-nav-btn">🔁 Retweets <span class="tab-counter">14</span></button>
      <button class="tab-nav-btn">🎯 Test / URL</button>
      <button class="tab-nav-btn">📁 .js Archive</button>
      <button class="tab-nav-btn active">⚙️ Settings</button>
      `,
      `
      <section class="tab-pane active">
        <div class="settings-panel">
          <h3>Deletion Settings</h3>

          <div class="form-group">
            <label>Default Method:</label>
            <select class="select-input">
              <option selected>Direct UI Navigation (Recommended - 100% Functional)</option>
              <option>Hybrid (GraphQL + UI Fallback)</option>
              <option>Internal GraphQL / REST (Experimental)</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label>Min Delay (ms):</label>
              <input type="number" class="text-input" value="1500">
            </div>
            <div class="form-group half">
              <label>Max Delay (ms):</label>
              <input type="number" class="text-input" value="3000">
            </div>
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" checked>
              Automatic safety pause on Rate Limit (HTTP 429)
            </label>
          </div>

          <div class="form-group">
            <label>Cooldown Time after Rate Limit (seconds):</label>
            <input type="number" class="text-input" value="60">
          </div>

          <div class="background-mode-info">
            <h4>💡 Background Execution & Persistent Window</h4>
            <p>Deletion is executed in the Background Service Worker. Even if you close this popup or minimize Chrome, the queue continues processing uninterrupted.</p>
            <div class="window-action-buttons">
              <button class="btn-subtle">⤢ Open in Permanent Tab</button>
              <button class="btn-subtle">🗗 Open in Standalone Window</button>
            </div>
          </div>

          <div class="settings-actions" style="margin-top: 10px;">
            <button class="btn-subtle-danger">Clear Local Cached Tweets</button>
            <span class="save-feedback visible">Settings saved!</span>
          </div>
        </div>
      </section>
      `
    )
  },
  {
    name: '06-live-background-progress.png',
    width: 540,
    height: 700,
    html: getHtmlTemplate(
      'Live Execution Tab',
      `
      <button class="tab-nav-btn active">💬 Tweets <span class="tab-counter">38</span></button>
      <button class="tab-nav-btn">🔁 Retweets <span class="tab-counter">14</span></button>
      <button class="tab-nav-btn">🎯 Test / URL</button>
      <button class="tab-nav-btn">📁 .js Archive</button>
      <button class="tab-nav-btn">⚙️ Settings</button>
      `,
      `
      <section class="tab-pane active">
        <div class="tweets-scroll-container">
          <!-- Deleted Card 1 -->
          <div class="tweet-card success">
            <div class="tweet-card-header">
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">03/12/2023 10:14 AM</span>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Finishing data layer refactoring for the project.</div>
              <div class="tweet-status-label success">✅ Deleted successfully</div>
            </div>
          </div>

          <!-- Deleted Card 2 -->
          <div class="tweet-card success">
            <div class="tweet-card-header">
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">03/11/2023 10:50 PM</span>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Testing continuous integration in GitHub Actions.</div>
              <div class="tweet-status-label success">✅ Deleted successfully</div>
            </div>
          </div>

          <!-- Currently Deleting Card -->
          <div class="tweet-card selected" style="border-color: #1d9bf0;">
            <div class="tweet-card-header">
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">03/10/2023 3:30 PM</span>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Configuring rate limiting rules and randomized delays.</div>
              <div class="tweet-status-label pending">⏳ Deleting... (Waiting for DOM confirmation)</div>
            </div>
          </div>
        </div>
      </section>
      `,
      `
      <div class="bg-running-banner">
        <span class="pulse-dot"></span>
        <span>Running in background. You can safely click away or minimize.</span>
      </div>
      `,
      `
      <footer class="app-footer">
        <div class="progress-container visible">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: 68%;"></div>
          </div>
          <div class="progress-info">
            <span>Processing: 34 of 50 tweets (68%)</span>
            <div class="progress-buttons">
              <button class="btn-xs">⏸️ Pause</button>
              <button class="btn-xs btn-danger">❌ Cancel</button>
            </div>
          </div>
        </div>
        <div class="action-bar-content">
          <div class="selection-summary">
            <span>Safe cadence: 2.1s between requests</span>
          </div>
          <button class="btn-danger" disabled style="opacity: 0.6;">
            ⏳ In Progress...
          </button>
        </div>
      </footer>
      `,
      `
      <aside class="logger-container">
        <div class="logger-header">
          <span class="logger-title">📜 Execution Console</span>
          <div class="logger-header-actions">
            <button class="btn-xs">Clear</button>
            <button class="btn-xs">Toggle</button>
          </div>
        </div>
        <div class="logger-output" style="display: block;">
          <div class="log-line" style="color: #1d9bf0;">[22:15:02] [BackgroundJob] Starting batch with 50 items...</div>
          <div class="log-line" style="color: #00ba7c;">[22:15:04] [DOM] Tweet 163459... deleted successfully!</div>
          <div class="log-line" style="color: #8b98a5;">[22:15:06] [Cadence] Waiting safe delay of 2,180ms...</div>
          <div class="log-line" style="color: #00ba7c;">[22:15:09] [DOM] Tweet 163462... deleted successfully!</div>
          <div class="log-line" style="color: #1d9bf0;">[22:15:11] [DOM] Locating caret menu for tweet 163470...</div>
        </div>
      </aside>
      `
    )
  }
];

const tempDir = path.join(__dirname, '..', 'docs', 'temp-html');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log('Generating high-res screenshots via Headless Chrome in English...');

for (const sc of screens) {
  const tempHtmlPath = path.join(tempDir, `${sc.name}.html`);
  fs.writeFileSync(tempHtmlPath, sc.html, 'utf-8');

  const outPngPath = path.join(OUTPUT_DIR, sc.name);
  const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;

  const cmd = `"${CHROME_PATH}" --headless=new --screenshot="${outPngPath}" --window-size=${sc.width},${sc.height} --hide-scrollbars "${fileUrl}"`;
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log(`✓ Generated: ${sc.name} (${sc.width}x${sc.height})`);
  } catch (err) {
    console.error(`Error generating ${sc.name}:`, err.message);
  }
}

// Cleanup
try {
  const tempFiles = fs.readdirSync(tempDir);
  for (const f of tempFiles) {
    fs.unlinkSync(path.join(tempDir, f));
  }
  fs.rmdirSync(tempDir);
} catch {
  // Ignore
}

console.log('All screenshots saved successfully in English to docs/screenshots/!');
