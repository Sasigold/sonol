/**
 * Generates the PWA icons from public/favicon.svg.
 *
 * There is no `sharp` in this project and no wish to add a native binary for
 * three PNGs. Playwright is already a devDependency for the E2E specs, so the
 * SVG is rendered by the same browser engine that will display it — which is
 * the only renderer whose output actually matters here.
 *
 * Run: node scripts/make-icons.mjs
 * The output is committed, so a normal install and build need no browser.
 *
 * The maskable variant is drawn on the brand square with the mark inset to 60%,
 * which keeps it inside Android's safe zone (the outer 20% on each side can be
 * cropped to a circle, a squircle or a rounded square depending on the phone).
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * Honour a Chromium that is already on the machine (CI images and this
 * container ship one whose build number need not match the pinned Playwright).
 * Falls back to Playwright's own download when the variable is unset.
 */
const CHROME_PATH = process.env.CHROME_PATH;
const launchOptions = CHROME_PATH && existsSync(CHROME_PATH) ? { executablePath: CHROME_PATH } : {};
const BRAND = '#1E3A8A';

const TARGETS = [
  { file: 'pwa-192x192.png', size: 192, maskable: false },
  { file: 'pwa-512x512.png', size: 512, maskable: false },
  { file: 'pwa-maskable-512x512.png', size: 512, maskable: true },
  // iOS ignores the manifest icons and reads this one.
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

function page(svg, { size, maskable }) {
  const inset = maskable ? '20%' : '0';
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    #box{width:${size}px;height:${size}px;background:${maskable ? BRAND : 'transparent'};
         display:flex;align-items:center;justify-content:center;padding:${inset};
         box-sizing:border-box}
    #box svg{width:100%;height:100%;display:block}
  </style><div id="box">${svg}</div>`;
}

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch(launchOptions);

try {
  for (const target of TARGETS) {
    const context = await browser.newContext({
      viewport: { width: target.size, height: target.size },
      deviceScaleFactor: 1,
    });
    const tab = await context.newPage();
    await tab.setContent(page(svg, target), { waitUntil: 'load' });
    const png = await tab.locator('#box').screenshot({ omitBackground: !target.maskable });
    await writeFile(new URL(`public/${target.file}`, `file://${root}`), png);
    await context.close();
    console.log(`${target.file}  ${target.size}x${target.size}  ${png.length} B`);
  }
} finally {
  await browser.close();
}
