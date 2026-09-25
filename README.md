<div align="center">

  <img src="docs/screenshots/hero-banner.png" alt="Tweet & Retweet Delete for X" width="100%" />

  <br />

  <h1>⚡ Tweet & Retweet Delete for X (Twitter)</h1>

  <p>
    <strong>The ultimate tool to scan, filter, select, and bulk delete Tweets and Retweets on X (Twitter)</strong><br />
    <em>Without requiring the paid official API, featuring strict post-type separation, human anti-ban cadence, and resilient background execution.</em>
  </p>

  <p>
    <a href="#-step-by-step-installation"><img src="https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Chrome MV3" /></a>
    <a href="#-software-architecture"><img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="#-privacy--security"><img src="https://img.shields.io/badge/Privacy-100%25_Local-00BA7C?style=for-the-badge&logo=shield&logoColor=white" alt="100% Local Privacy" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge" alt="MIT License" /></a>
  </p>

  <p>
    <a href="#-why-this-project-exists">Why This Project</a> •
    <a href="#-visual-tour">Visual Tour</a> •
    <a href="#-key-features">Key Features</a> •
    <a href="#-step-by-step-installation">Installation</a> •
    <a href="#-usage-guide">Usage Guide</a> •
    <a href="#-software-architecture">Architecture</a> •
    <a href="#-privacy--security">Security</a>
  </p>
</div>

---

## 💡 Why This Project Exists

With recent changes to **X (Twitter)** policies, official API access requires expensive subscription tiers (costing hundreds or thousands of dollars per month) simply to delete posts from your own account. In addition, standard web interfaces restrict timeline scrolling to only about **3,200 tweets**.

**Tweet & Retweet Delete for X** was built to restore complete control over your account and privacy:
- **100% Free & Unlimited**: Runs directly within your existing browser session without relying on paid developer API keys.
- **Strict Separation**: Rigorously separates original tweets and replies from retweets (unretweet).
- **Overcomes the 3,200 Tweet Limit**: Native support for the official X data export archive (`tweets.js` / `.json`), allowing you to clean accounts with tens of thousands of tweets dating back to account creation.
- **Human-Like Cadence**: Configurable randomized intervals and automatic cooldown upon encountering Rate Limits (HTTP 429).
- **Does Not Freeze on Minimize**: Background execution via Manifest V3 Service Worker with keep-awake mechanisms, persistent full tab mode, standalone windows, and Chrome Side Panel support.

---

## 📸 Visual Tour

### 💬 1. Read, Search, and Fine-Tune Tweet Selection
Filter by any keyword or date range (From / To). Bulk select with one click or pick specific posts.
<div align="center">
  <img src="docs/screenshots/01-tweets-list.png" alt="Tweet List and Filter Controls" width="600" />
</div>

<br />

### 🔁 2. Dedicated Retweet Management
Review who each retweet originated from before deletion. Undo old retweets without putting your own original content at risk.
<div align="center">
  <img src="docs/screenshots/02-retweets-list.png" alt="Retweets Management Tab" width="600" />
</div>

<br />

### 🎯 3. Direct Deletion & Test Tweet Runner
Need to delete a specific post without scanning your entire timeline? Paste the URL or status ID and trigger immediate deletion.
<div align="center">
  <img src="docs/screenshots/03-direct-url-delete.png" alt="Direct URL Deletion Tab" width="600" />
</div>

<br />

### 📁 4. Official Twitter Archive Importer (`tweets.js`)
Bypass the web timeline 3,200 tweet limitation. Drag and drop your official backup file to index your complete account history.
<div align="center">
  <img src="docs/screenshots/04-archive-importer.png" alt="Archive File Importer" width="600" />
</div>

<br />

### ⚙️ 5. Cadence Control & Anti-Rate Limit Protection
Configure minimum and maximum delays between requests. Automatically pauses and cools down when receiving HTTP 429 status codes.
<div align="center">
  <img src="docs/screenshots/05-settings-cadence.png" alt="Settings and Cadence Controls" width="600" />
</div>

<br />

### 🛡️ 6. Resilient Background Processing & Live Execution Console
Track your batch in real time with progress indicators, Pause/Cancel controls, and color-coded timestamped logs.
<div align="center">
  <img src="docs/screenshots/06-live-background-progress.png" alt="Live Background Processing" width="600" />
</div>

---

## ✨ Key Features

| Feature | Details |
| :--- | :--- |
| **Dual Deletion Engines** | ⚡ **Internal GraphQL/REST** (fast authenticated requests using active web session cookies) and 🖱️ **DOM Automation** (real user click emulation on X UI, immune to GraphQL query ID changes). |
| **Hybrid Mode with Auto-Fallback** | Attempts rapid GraphQL deletion first; automatically falls back to visual DOM navigation if query IDs change. |
| **Strict Separation (Tweets vs. Retweets)** | Dedicated tabs with independent counters for loaded and selected items. |
| **Advanced Filtering** | Instant keyword search and date range filters (`From` and `To`). |
| **Archive Importer (.js / .json)** | Directly parses official X account dumps (`tweets.js`), unlocking unlimited history deletion. |
| **Background Execution** | Managed by a Manifest V3 `Service Worker`. The process continues uninterrupted even if the popup closes or the browser is minimized. |
| **Keep-Awake & Anti-Throttling** | Inaudible Web Audio and Screen Wake Lock helpers prevent Chrome from putting background tasks to sleep. |
| **Flexible Display Modes** | Standard popup, `⤢ Tab` button for permanent full-screen use, `🗗 Window` for standalone floating window, and Chrome Side Panel support. |
| **Live Execution Console** | Built-in terminal log with real-time timestamps, HTTP statuses, and step-by-step diagnostic information. |

---

## 📦 Step-by-Step Installation

### Quick Method (Using the pre-built `dist` folder)

1. Clone or download this repository to your machine:
   ```bash
   git clone https://github.com/leonardoplanello/tweet-retweet-delete-x.git
   ```
2. Open Google Chrome and navigate to the extensions page:
   ```text
   chrome://extensions
   ```
3. In the top-right corner, enable **"Developer mode"**.
4. Click the **"Load unpacked"** button.
5. Select the **`dist`** directory inside the cloned project folder.
6. The **"Tweet & Retweet Delete for X"** extension will appear installed and ready. Pin it to your Chrome toolbar for quick access!

---

### Building from Source (For Developers)

If you want to modify or compile the TypeScript code yourself:

```bash
# 1. Install development dependencies
npm install

# 2. Build production bundles with esbuild
npm run build

# 3. Run strict TypeScript type checks
npm run typecheck

# 4. Watch mode (Hot rebuild on save)
npm run watch

# 5. Generate high-resolution icons or documentation screenshots
npm run generate-icons
npm run screenshots
```

---

## 🚀 Usage Guide

### Scenario A: Scan and delete posts from your live profile timeline
1. Open [x.com](https://x.com) in any tab and make sure you are logged in.
2. Navigate to your profile page (`https://x.com/your_username`).
3. Open the extension popup. The badge in the header will show: `🟢 @your_username`.
4. Click **`🔍 Scan Profile`**. The extension will scroll your timeline automatically, collecting tweets and retweets.
5. Apply text or date range filters to select the posts you want removed.
6. Click **"🗑️ Delete Selected"** and monitor progress in real time.

### Scenario B: Delete your entire unlimited account history (Twitter Archive)
1. On X, go to: *More > Settings and privacy > Your account > Download an archive of your data*.
2. Once you receive the email notification from X, download and extract the `.zip` archive.
3. Open the extension and switch to the **📁 .js Archive** tab.
4. Drag and drop the `data/tweets.js` file into the upload zone.
5. All your historical tweets will be indexed locally, ready for filtering and mass deletion.

### Scenario C: Delete a specific tweet directly via URL
1. Switch to the **🎯 Test / URL** tab.
2. Paste the URL or status ID (e.g., `https://x.com/your_username/status/1234567890`).
3. Select your preferred deletion method (we recommend *Direct UI Navigation*).
4. Click **"🗑️ Delete This Tweet Now"**.

---

## 🏗️ Software Architecture

This project is built following strict **Clean Architecture** and **Modular Component** principles, completely avoiding monolithic files:

```text
tweet-retweet-delete-x/
├── dist/                      # Packaged extension ready to load in Chrome
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── background.js
│   ├── content.js
│   └── icons/
├── src/
│   ├── background/            # Manifest V3 Background Service Worker
│   │   └── service-worker.ts  # Background job lifecycle, alarms, message handlers
│   ├── components/            # Decoupled UI presentation components
│   │   ├── tab-manager.ts
│   │   ├── tweet-card.ts
│   │   ├── tweet-list-view.ts
│   │   ├── test-runner-view.ts
│   │   ├── archive-uploader-view.ts
│   │   ├── settings-view.ts
│   │   ├── progress-bar-view.ts
│   │   ├── window-mode-view.ts
│   │   └── logger-view.ts
│   ├── content/               # Content scripts injected into X.com
│   │   ├── content-main.ts
│   │   ├── dom-scanner.ts     # Timeline DOM scanner and scroll automation
│   │   ├── dom-clicker.ts     # Real-click emulation and confirmation handler
│   │   └── automation-hud.ts  # Non-intrusive floating status HUD
│   ├── services/              # Business logic & use cases
│   │   ├── x-session-service.ts       # Cookie extraction & CSRF token reader
│   │   ├── graphql-delete-service.ts  # Direct GraphQL mutations & REST endpoints
│   │   ├── dom-delete-service.ts      # Dedicated tab DOM deletion orchestrator
│   │   ├── automation-tab-service.ts  # Browser tab management for DOM actions
│   │   ├── background-job-service.ts  # Persistent background job processor
│   │   ├── rate-limiter.ts            # Randomized delay & HTTP 429 cooldown
│   │   ├── archive-parser-service.ts  # Parsing logic for tweets.js / JSON
│   │   ├── storage-service.ts         # Chrome storage persistence layer
│   │   └── keep-awake-service.ts      # Browser throttling prevention
│   └── types/                 # Strict TypeScript interface contracts
│       ├── tweet.ts
│       ├── config.ts
│       ├── messages.ts
│       └── batch-job.ts
├── scripts/                   # Build, asset, and screenshot utilities
│   ├── generate-icons.js      # High-definition icon renderer
│   └── capture-screenshots.js # Automated Chrome Headless screenshot capture
├── docs/                      # High-resolution screenshots and visual documentation
│   └── screenshots/
├── build.js                   # Fast esbuild bundle pipeline
├── package.json
└── tsconfig.json
```

---

## 🔒 Privacy & Security

- 🛡️ **100% Local Execution**: All logic runs exclusively inside your browser. No tokens, cookies, account credentials, or tweet contents are ever sent to third-party servers.
- 🔑 **No Secret Keys Required**: You do not need to register a developer account or create API keys on the X Developer Portal.
- 📜 **Auditable Open Source**: The entire codebase is open, modular, and freely available for community review.

---

## 📄 License

Distributed under the **MIT** License. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">
  Crafted with care by <a href="https://github.com/leonardoplanello"><strong>Leonardo Planello</strong></a> 🚀
</div>
