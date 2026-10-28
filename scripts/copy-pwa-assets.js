const fs = require('fs');
const path = require('path');

const filesToCopy = [
  'manifest.json',
  'firebase-messaging-sw.js',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'favicon.ico',
];

const publicDir = path.resolve(__dirname, '..', 'public');
const distDir = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

console.log('\n📦 Copiando assets PWA a dist/...\n');

if (!fs.existsSync(distDir)) {
  console.error(`❌ No existe ${distDir}. Ejecuta primero el build de Expo.`);
  process.exit(1);
}

let copied = 0, missing = 0;
for (const file of filesToCopy) {
  const src = path.join(publicDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✅ ${file}`);
    copied++;
  } else {
    console.warn(`  ⚠️  ${file} — no encontrado en public/`);
    missing++;
  }
}

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('manifest.json')) {
    const tags = `
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta name="theme-color" content="#2563eb" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="Inventario" />
`;
    html = html.replace('</head>', `${tags}</head>`);
    fs.writeFileSync(indexPath, html);
    console.log('  ✅ manifest + meta tags inyectados en index.html');
  } else {
    console.log('  ℹ️  index.html ya tiene el manifest');
  }
} else {
  console.warn('  ⚠️  dist/index.html no existe');
}

console.log(`\n📊 Copiados: ${copied} | Faltantes: ${missing}\n`);
