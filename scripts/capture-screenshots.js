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

// 1. Template base
function getHtmlTemplate(title, tabNavHtml, activeTabContent, bannerHtml = '', footerHtml = '', loggerHtml = '') {
  return `<!DOCTYPE html>
<html lang="pt-BR">
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
    /* Estilização refinada para screenshots */
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
        <h1>Tweet Purge</h1>
      </div>
      <div class="header-actions">
        <button class="btn-icon" title="Abrir em aba inteira">⤢ Aba</button>
        <button class="btn-icon" title="Abrir em janela independente">🗗 Janela</button>
        <span class="session-status-badge logged-in">🟢 @leoplanello</span>
        <button class="btn-primary-sm">🔍 Varrer Perfil</button>
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
          <span id="bulk-selection-label">3 tweets selecionados</span>
        </div>
        <button class="btn-danger">
          🗑️ Apagar Selecionados (3)
        </button>
      </div>
    </footer>
    `}

    ${loggerHtml || `
    <aside class="logger-container collapsed">
      <div class="logger-header">
        <span class="logger-title">📜 Console de Execução</span>
        <div class="logger-header-actions">
          <button class="btn-xs">Limpar</button>
          <button class="btn-xs">Alternar</button>
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
<html lang="pt-BR">
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
      max-width: 680px;
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
    <h1>Tweet & Retweet Purge for X</h1>
    <p>Leitura inteligente, filtros finos por data/texto e exclusão em lote com separação estrita de Tweets e Retweets — sem depender da API oficial paga.</p>
    <div class="feature-pills">
      <div class="pill"><span class="pill-icon">💬</span> Filtro Preciso de Tweets</div>
      <div class="pill"><span class="pill-icon">🔁</span> Desfazer Retweets em Massa</div>
      <div class="pill"><span class="pill-icon">🛡️</span> Fila Resiliente em Segundo Plano</div>
      <div class="pill"><span class="pill-icon">⏱️</span> Anti-Rate Limit Inteligente</div>
      <div class="pill"><span class="pill-icon">📁</span> Importador de Arquivo Oficial</div>
    </div>
  </div>
</body>
</html>`;
}

// 3. Telas
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
      <button class="tab-nav-btn">🎯 Teste / URL</button>
      <button class="tab-nav-btn">📁 Arquivo .js</button>
      <button class="tab-nav-btn">⚙️ Ajustes</button>
      `,
      `
      <section class="tab-pane active">
        <div class="list-controls">
          <input type="text" class="search-input" value="projeto" placeholder="Buscar texto no tweet...">
          <div class="date-filter-group">
            <input type="date" class="date-input" value="2022-01-01">
            <span>até</span>
            <input type="date" class="date-input" value="2024-12-31">
          </div>
          <div class="selection-actions">
            <button class="btn-subtle">Marcar todos</button>
            <button class="btn-subtle">Desmarcar</button>
            <span class="selection-counter">3 de 38 selecionados</span>
          </div>
        </div>

        <div class="tweets-scroll-container">
          <!-- Card 1 (Selecionado) -->
          <div class="tweet-card selected">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox" checked>
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">14/10/2023 18:42</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Iniciando o desenvolvimento da nova arquitetura modular do projeto. Clean architecture e zero dependências pesadas fazem total diferença! 🚀</div>
            </div>
            <div class="tweet-card-actions">
              <button class="btn-single-delete" title="Apagar apenas este">🗑️</button>
            </div>
          </div>

          <!-- Card 2 (Selecionado) -->
          <div class="tweet-card selected">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox" checked>
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">09/06/2023 11:15</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Ajustando alguns testes automatizados antes de subir o deploy para produção. A cobertura de testes salvou o fim de semana.</div>
            </div>
            <div class="tweet-card-actions">
              <button class="btn-single-delete">🗑️</button>
            </div>
          </div>

          <!-- Card 3 (Não selecionado) -->
          <div class="tweet-card">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox">
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">22/02/2022 09:30</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Estudando novas funcionalidades do Manifest V3 para extensões no Google Chrome. Muita coisa mudou com os service workers!</div>
            </div>
            <div class="tweet-card-actions">
              <button class="btn-single-delete">🗑️</button>
            </div>
          </div>

          <!-- Card 4 (Já apagado) -->
          <div class="tweet-card success">
            <div class="tweet-card-header">
              <label class="tweet-checkbox-container">
                <input type="checkbox" class="tweet-checkbox" disabled>
                <span class="checkmark"></span>
              </label>
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">10/01/2022 14:05</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Testando endpoint de mutação no X.</div>
              <div class="tweet-status-label success">✅ Excluído com sucesso</div>
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
      <button class="tab-nav-btn">🎯 Teste / URL</button>
      <button class="tab-nav-btn">📁 Arquivo .js</button>
      <button class="tab-nav-btn">⚙️ Ajustes</button>
      `,
      `
      <section class="tab-pane active">
        <div class="list-controls">
          <input type="text" class="search-input" placeholder="Buscar texto ou autor retweetado...">
          <div class="date-filter-group">
            <input type="date" class="date-input">
            <span>até</span>
            <input type="date" class="date-input">
          </div>
          <div class="selection-actions">
            <button class="btn-subtle">Marcar todos</button>
            <button class="btn-subtle">Desmarcar</button>
            <span class="selection-counter">2 de 14 selecionados</span>
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
              <span class="tweet-date">18/08/2024 16:20</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="retweet-author">Retweetado de <strong>@paulg</strong></div>
              <div class="tweet-text">The most impressive people I know are not the ones who never fail, but the ones who iterate tenaciously until they find something that works.</div>
            </div>
            <div class="tweet-card-actions">
              <button class="btn-single-delete" title="Desfazer Retweet">🗑️</button>
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
              <span class="tweet-date">02/05/2023 21:05</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="retweet-author">Retweetado de <strong>@sama</strong></div>
              <div class="tweet-text">the future will be shaped by the people who build things rather than the people who talk about building things.</div>
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
              <span class="tweet-date">15/11/2021 12:45</span>
              <a href="#" class="tweet-link">🔗</a>
            </div>
            <div class="tweet-card-body">
              <div class="retweet-author">Retweetado de <strong>@github</strong></div>
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
            <span>2 retweets selecionados</span>
          </div>
          <button class="btn-danger">
            🔁 Desfazer Retweets (2)
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
      <button class="tab-nav-btn active">🎯 Teste / URL</button>
      <button class="tab-nav-btn">📁 Arquivo .js</button>
      <button class="tab-nav-btn">⚙️ Ajustes</button>
      `,
      `
      <section class="tab-pane active">
        <div class="test-runner-panel">
          <div class="test-header">
            <h3>Exclusão Direta / Tweet de Teste</h3>
            <p class="section-desc">Exclua um tweet específico informando sua URL ou ID diretamente sem precisar varrer a timeline.</p>
          </div>

          <div class="test-tweet-preview-box">
            <div class="preview-title">Tweet alvo de teste:</div>
            <div class="preview-url">https://x.com/leoplanello/status/1088925139268526085</div>
            <div class="preview-quote">"Clima assim é muuuito melhor"</div>
          </div>

          <div class="form-group">
            <label for="test-url-input">URL ou ID do Tweet:</label>
            <input type="text" class="text-input" value="https://x.com/leoplanello/status/1088925139268526085">
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label for="test-method-select">Método de Exclusão:</label>
              <select class="select-input">
                <option selected>Navegação Direta na UI (Recomendado)</option>
                <option>Híbrido (GraphQL com fallback DOM)</option>
                <option>GraphQL / REST Interno</option>
              </select>
            </div>
            <div class="form-group half checkbox-group" style="padding-top: 20px;">
              <label>
                <input type="checkbox">
                É um Retweet (Unretweet)
              </label>
            </div>
          </div>

          <button class="btn-danger-lg" style="margin-top: 8px;">
            🗑️ Apagar Este Tweet Agora
          </button>

          <div class="test-status-output success" style="display: block; margin-top: 12px;">
            ✅ Sucesso: O tweet foi localizado e excluído com confirmação visual no X!
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
      <button class="tab-nav-btn">🎯 Teste / URL</button>
      <button class="tab-nav-btn active">📁 Arquivo .js</button>
      <button class="tab-nav-btn">⚙️ Ajustes</button>
      `,
      `
      <section class="tab-pane active">
        <div class="archive-panel">
          <h3>Carregar Twitter Archive Oficial</h3>
          <p class="section-desc">
            O X exibe apenas até 3.200 tweets no perfil da web. Para apagar todo o histórico ilimitado da sua conta, importe o arquivo <code>tweets.js</code> exportado pelo X.
          </p>

          <div class="dropzone drag-over">
            <span class="dropzone-icon">📁</span>
            <div class="dropzone-text">
              <strong>Arquivo carregado: tweets.js</strong>
              <span style="color: #00ba7c; font-weight: 600;">✓ 4.820 tweets e 930 retweets indexados com sucesso!</span>
            </div>
          </div>

          <div class="archive-status success" style="display: block;">
            🎉 Sucesso! 5.750 postagens carregadas na memória local prontas para filtragem e exclusão.
          </div>

          <div class="archive-instructions">
            <h4>Como obter seus dados do X:</h4>
            <ol>
              <li>No X, acesse <em>Mais &gt; Configurações e privacidade &gt; Sua conta &gt; Baixar um arquivo com seus dados</em>.</li>
              <li>Aguarde o e-mail de confirmação do X e baixe o arquivo <code>.zip</code>.</li>
              <li>Descompacte o arquivo, abra a pasta <code>data/</code> e arraste o arquivo <code>tweets.js</code> aqui.</li>
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
      <button class="tab-nav-btn">🎯 Teste / URL</button>
      <button class="tab-nav-btn">📁 Arquivo .js</button>
      <button class="tab-nav-btn active">⚙️ Ajustes</button>
      `,
      `
      <section class="tab-pane active">
        <div class="settings-panel">
          <h3>Configurações de Exclusão</h3>

          <div class="form-group">
            <label>Método Padrão:</label>
            <select class="select-input">
              <option selected>Navegação Direta na UI (Recomendado - 100% Funcional)</option>
              <option>Híbrido (GraphQL + Fallback UI)</option>
              <option>GraphQL / REST Interno (Experimental)</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label>Atraso Mínimo (ms):</label>
              <input type="number" class="text-input" value="1500">
            </div>
            <div class="form-group half">
              <label>Atraso Máximo (ms):</label>
              <input type="number" class="text-input" value="3000">
            </div>
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" checked>
              Pausa automática de segurança se atingir Rate Limit (HTTP 429)
            </label>
          </div>

          <div class="form-group">
            <label>Tempo de Cooldown após Rate Limit (segundos):</label>
            <input type="number" class="text-input" value="60">
          </div>

          <div class="background-mode-info">
            <h4>💡 Execução em Segundo Plano & Janela Fixa</h4>
            <p>A exclusão é executada no Service Worker em segundo plano. Mesmo fechando este popup ou minimizando o Chrome, a fila continua sem interrupções.</p>
            <div class="window-action-buttons">
              <button class="btn-subtle">⤢ Abrir em Aba Permanente</button>
              <button class="btn-subtle">🗗 Abrir em Janela Própria</button>
            </div>
          </div>

          <div class="settings-actions" style="margin-top: 10px;">
            <button class="btn-subtle-danger">Limpar Tweets em Cache Local</button>
            <span class="save-feedback visible">Configurações salvas!</span>
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
      <button class="tab-nav-btn">🎯 Teste / URL</button>
      <button class="tab-nav-btn">📁 Arquivo .js</button>
      <button class="tab-nav-btn">⚙️ Ajustes</button>
      `,
      `
      <section class="tab-pane active">
        <div class="tweets-scroll-container">
          <!-- Card Excluído 1 -->
          <div class="tweet-card success">
            <div class="tweet-card-header">
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">12/03/2023 10:14</span>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Finalizando refatoração da camada de dados do projeto.</div>
              <div class="tweet-status-label success">✅ Excluído com sucesso</div>
            </div>
          </div>

          <!-- Card Excluído 2 -->
          <div class="tweet-card success">
            <div class="tweet-card-header">
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">11/03/2023 22:50</span>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Testando integração contínua no GitHub Actions.</div>
              <div class="tweet-status-label success">✅ Excluído com sucesso</div>
            </div>
          </div>

          <!-- Card Atualmente em Exclusão -->
          <div class="tweet-card selected" style="border-color: #1d9bf0;">
            <div class="tweet-card-header">
              <span class="badge badge-tweet">💬 Tweet</span>
              <span class="tweet-date">10/03/2023 15:30</span>
            </div>
            <div class="tweet-card-body">
              <div class="tweet-text">Configurando regras de rate limiting e delay randômico.</div>
              <div class="tweet-status-label pending">⏳ Apagando... (Aguardando confirmação DOM)</div>
            </div>
          </div>
        </div>
      </section>
      `,
      `
      <div class="bg-running-banner">
        <span class="pulse-dot"></span>
        <span>Executando em segundo plano. Você pode clicar fora ou minimizar com segurança.</span>
      </div>
      `,
      `
      <footer class="app-footer">
        <div class="progress-container visible">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: 68%;"></div>
          </div>
          <div class="progress-info">
            <span>Processando: 34 de 50 tweets (68%)</span>
            <div class="progress-buttons">
              <button class="btn-xs">⏸️ Pausar</button>
              <button class="btn-xs btn-danger">❌ Cancelar</button>
            </div>
          </div>
        </div>
        <div class="action-bar-content">
          <div class="selection-summary">
            <span>Cadência segura: 2.1s entre requisições</span>
          </div>
          <button class="btn-danger" disabled style="opacity: 0.6;">
            ⏳ Em Andamento...
          </button>
        </div>
      </footer>
      `,
      `
      <aside class="logger-container">
        <div class="logger-header">
          <span class="logger-title">📜 Console de Execução</span>
          <div class="logger-header-actions">
            <button class="btn-xs">Limpar</button>
            <button class="btn-xs">Alternar</button>
          </div>
        </div>
        <div class="logger-output" style="display: block;">
          <div class="log-line" style="color: #1d9bf0;">[22:15:02] [BackgroundJob] Iniciando lote com 50 itens...</div>
          <div class="log-line" style="color: #00ba7c;">[22:15:04] [DOM] Tweet 163459... excluído com sucesso!</div>
          <div class="log-line" style="color: #8b98a5;">[22:15:06] [Cadence] Aguardando intervalo de 2.180ms...</div>
          <div class="log-line" style="color: #00ba7c;">[22:15:09] [DOM] Tweet 163462... excluído com sucesso!</div>
          <div class="log-line" style="color: #1d9bf0;">[22:15:11] [DOM] Localizando caret no menu do tweet 163470...</div>
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

console.log('Gerando capturas de tela via Headless Chrome...');

for (const sc of screens) {
  const tempHtmlPath = path.join(tempDir, `${sc.name}.html`);
  fs.writeFileSync(tempHtmlPath, sc.html, 'utf-8');

  const outPngPath = path.join(OUTPUT_DIR, sc.name);
  const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;

  const cmd = `"${CHROME_PATH}" --headless=new --screenshot="${outPngPath}" --window-size=${sc.width},${sc.height} --hide-scrollbars "${fileUrl}"`;
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log(`✓ Gerado: ${sc.name} (${sc.width}x${sc.height})`);
  } catch (err) {
    console.error(`Erro ao gerar ${sc.name}:`, err.message);
  }
}

// Limpeza de arquivos temporários
try {
  const tempFiles = fs.readdirSync(tempDir);
  for (const f of tempFiles) {
    fs.unlinkSync(path.join(tempDir, f));
  }
  fs.rmdirSync(tempDir);
} catch {
  // Ignora
}

console.log('Todas as capturas de tela foram salvas com sucesso em docs/screenshots/!');
