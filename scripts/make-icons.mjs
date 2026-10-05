/**
 * Generates the PWA icons and the iOS launch screens from public/logo.svg.
 *
 * There is no `sharp` in this project and no wish to add a native binary for
 * a handful of PNGs. Playwright is already a devDependency for the E2E specs,
 * so the SVG is rendered by the same browser engine that will display it —
 * which is the only renderer whose output actually matters here.
 *
 * Run: node scripts/make-icons.mjs
 * The output is committed, so a normal install and build need no browser.
 *
 * One drawing, three uses. `logo.svg` is the lockup on a transparent 512 grid
 * with everything inside the central 80% circle, so:
 *
 * - the maskable icon and the apple-touch-icon are the brand gradient,
 *   full-bleed, with the logo at full size — Android and iOS crop the corners
 *   themselves, and the safe zone survives any mask;
 * - the plain ("any") icons are the same on a rounded square, for the places
 *   that show an icon unmasked;
 * - the iOS launch screens are the gradient with the logo centred at the size
 *   the in-app splash in index.html draws it, so the native launch image hands
 *   over to the HTML splash without a jump.
 *
 * `favicon.svg` (the browser tab) is drawn separately: no wordmark survives
 * 16-32 px, so it is the pump alone.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/**
 * Honour a Chromium that is already on the machine (CI images and this
 * container ship one whose build number need not match the pinned Playwright).
 * Falls back to Playwright's own download when the variable is unset.
 */
const CHROME_PATH = process.env.CHROME_PATH;
const launchOptions = CHROME_PATH && existsSync(CHROME_PATH) ? { executablePath: CHROME_PATH } : {};

/** Same two stops as favicon.svg and the #splash rule in index.html. */
const GRADIENT = 'linear-gradient(180deg, #2447A8 0%, #14286B 100%)';

const ICONS = [
  { file: 'pwa-192x192.png', size: 192, rounded: true },
  { file: 'pwa-512x512.png', size: 512, rounded: true },
  { file: 'pwa-maskable-512x512.png', size: 512, rounded: false },
  // iOS ignores the manifest icons and reads this one. It applies its own mask.
  { file: 'apple-touch-icon.png', size: 180, rounded: false },
];

/**
 * iPhone launch screens, portrait only (the manifest locks orientation).
 * iOS shows one only on an exact match of CSS size and pixel ratio, so each
 * screen class needs its own file; index.html carries the matching
 * <link rel="apple-touch-startup-image"> for every entry.
 */
const SPLASH_SCREENS = [
  { width: 440, height: 956, ratio: 3 }, // 16 Pro Max, 17 Pro Max
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15 Plus / Pro Max, 16 Plus
  { width: 428, height: 926, ratio: 3 }, // 12 / 13 Pro Max, 14 Plus
  { width: 420, height: 912, ratio: 3 }, // Air
  { width: 414, height: 896, ratio: 3 }, // XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 414, height: 736, ratio: 3 }, // 8 Plus
  { width: 402, height: 874, ratio: 3 }, // 16 Pro, 17, 17 Pro
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14, 16e
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12 / 13 mini
  { width: 375, height: 667, ratio: 2 }, // 8, SE 2nd / 3rd gen
];

/** Must match `#splash img` in index.html: min(64vw, 280px). */
function splashLogoSize(width) {
  return Math.min(width * 0.64, 280);
}

function iconPage(svg, { size, rounded }) {
  // 22.5% is the corner of an iOS / macOS app tile — a familiar silhouette
  // wherever the plain icon is shown without a mask.
  const radius = rounded ? `${Math.round(size * 0.225)}px` : '0';
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    #box{width:${size}px;height:${size}px;background:${GRADIENT};border-radius:${radius};overflow:hidden}
    #box svg{width:100%;height:100%;display:block}
  </style><div id="box">${svg}</div>`;
}

function splashPage(svg, { width, height }) {
  const logo = splashLogoSize(width);
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    #box{width:${width}px;height:${height}px;background:${GRADIENT};
         display:flex;align-items:center;justify-content:center}
    #box svg{width:${logo}px;height:${logo}px;display:block}
  </style><div id="box">${svg}</div>`;
}

async function shoot(browser, html, { width, height, ratio = 1, transparent = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: ratio,
  });
  const tab = await context.newPage();
  await tab.setContent(html, { waitUntil: 'load' });
  const png = await tab.locator('#box').screenshot({ omitBackground: transparent });
  await context.close();
  return png;
}

const svg = await readFile(new URL('../public/logo.svg', import.meta.url), 'utf8');
const browser = await chromium.launch(launchOptions);

try {
  for (const icon of ICONS) {
    const png = await shoot(browser, iconPage(svg, icon), {
      width: icon.size,
      height: icon.size,
      transparent: icon.rounded,
    });
    await writeFile(new URL(`../public/${icon.file}`, import.meta.url), png);
    console.log(`${icon.file}  ${icon.size}x${icon.size}  ${png.length} B`);
  }

  await mkdir(new URL('../public/splash/', import.meta.url), { recursive: true });
  for (const device of SPLASH_SCREENS) {
    const png = await shoot(browser, splashPage(svg, device), device);
    const file = `splash/apple-splash-${device.width * device.ratio}x${device.height * device.ratio}.png`;
    await writeFile(new URL(`../public/${file}`, import.meta.url), png);
    console.log(`${file}  ${png.length} B`);
  }
} finally {
  await browser.close();
}
