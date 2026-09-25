const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ICONS_SRC_DIR = path.join(__dirname, '..', 'src', 'icons');
const ICONS_DIST_DIR = path.join(__dirname, '..', 'dist', 'icons');

for (const dir of [ICONS_SRC_DIR, ICONS_DIST_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getIconSvg(size) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${size}px;
      height: ${size}px;
      background: transparent;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    svg {
      width: ${size}px;
      height: ${size}px;
    }
  </style>
</head>
<body>
  <svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f1419" />
        <stop offset="100%" stop-color="#000000" />
      </linearGradient>
      <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1d9bf0" />
        <stop offset="100%" stop-color="#00ba7c" />
      </linearGradient>
      <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="40%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#1d9bf0" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Base Squircle -->
    <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="6"/>

    <!-- Subtle X Background Glyph -->
    <path d="M36 36 L92 92 M92 36 L36 92" stroke="rgba(255, 255, 255, 0.08)" stroke-width="12" stroke-linecap="round"/>

    <!-- Stylized Electric Lightning Bolt (Purge Symbol) -->
    <path d="M72 18 L38 68 H62 L54 110 L94 56 H68 L76 18 Z" 
          fill="url(#boltGrad)" 
          stroke="#ffffff" 
          stroke-width="2" 
          stroke-linejoin="round"
          filter="url(#glow)"/>
  </svg>
</body>
</html>`;
}

const sizes = [16, 48, 128];
const tempHtmlPath = path.join(__dirname, 'temp-icon.html');

console.log('Gerando ícones em alta resolução para a extensão...');

for (const size of sizes) {
  fs.writeFileSync(tempHtmlPath, getIconSvg(size), 'utf-8');
  const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;

  const srcPng = path.join(ICONS_SRC_DIR, `icon${size}.png`);
  const distPng = path.join(ICONS_DIST_DIR, `icon${size}.png`);

  const cmd = `"${CHROME_PATH}" --headless=new --screenshot="${srcPng}" --window-size=${size},${size} --default-background-color=00000000 --hide-scrollbars "${fileUrl}"`;
  try {
    execSync(cmd, { stdio: 'pipe' });
    fs.copyFileSync(srcPng, distPng);
    console.log(`✓ Ícone gerado com sucesso: icon${size}.png (${size}x${size})`);
  } catch (err) {
    console.error(`Erro ao gerar icon${size}.png:`, err.message);
  }
}

if (fs.existsSync(tempHtmlPath)) {
  fs.unlinkSync(tempHtmlPath);
}

console.log('Ícones finalizados em src/icons e dist/icons!');
