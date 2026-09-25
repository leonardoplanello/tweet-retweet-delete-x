const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  const isWatch = process.argv.includes('--watch');

  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  // Copy static assets
  const staticFiles = [
    { src: 'src/manifest.json', dest: 'dist/manifest.json' },
    { src: 'src/popup/popup.html', dest: 'dist/popup.html' },
    { src: 'src/popup/popup.css', dest: 'dist/popup.css' }
  ];

  for (const file of staticFiles) {
    if (fs.existsSync(file.src)) {
      fs.copyFileSync(file.src, file.dest);
    }
  }

  // Copy or generate icons if needed
  const iconsDir = path.join('dist', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  if (fs.existsSync('src/icons')) {
    const iconFiles = fs.readdirSync('src/icons');
    for (const icon of iconFiles) {
      fs.copyFileSync(path.join('src/icons', icon), path.join(iconsDir, icon));
    }
  }

  const buildOptions = {
    entryPoints: {
      popup: 'src/popup/popup-main.ts',
      content: 'src/content/content-main.ts',
      background: 'src/background/service-worker.ts'
    },
    bundle: true,
    outdir: 'dist',
    format: 'iife', // Browser compatible bundle
    platform: 'browser',
    target: ['chrome100'],
    sourcemap: true,
    minify: false
  };

  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Build completed successfully in dist/');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
