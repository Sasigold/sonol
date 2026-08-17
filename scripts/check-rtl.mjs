#!/usr/bin/env node
/**
 * RTL guard for places ESLint cannot see.
 *
 * ESLint's `no-restricted-syntax` rules in eslint.config.js cover class strings
 * inside .ts/.tsx. They cannot see Tailwind classes written inside CSS
 * (`@apply`) or inside index.html. This script closes that gap.
 *
 * Exits non-zero and prints every offending line.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['src', 'index.html'];
const EXTENSIONS = new Set(['.css', '.html']);

/** Physical Tailwind utilities that do not mirror under dir="rtl". */
const PATTERNS = [
  [/(^|[\s'"`])-?(m[lr]|p[lr])-/, 'use ms-/me-/ps-/pe-'],
  [/(^|[\s'"`])(space-x|divide-x)-/, 'use gap-* (space-x/divide-x emit physical margins)'],
  [/(^|[\s'"`])(left|right)-[0-9a-z]/, 'use start-/end-'],
  [/border-[lr]-/, 'use border-s-/border-e-'],
  [/rounded-([tb])?[lr]-/, 'use rounded-s-/rounded-e-'],
  [/text-(left|right)\b/, 'use text-start/text-end'],
  [/(float|clear|origin)-(left|right)\b/, 'use the -start/-end variant'],
];

function* walk(path) {
  let info;
  try {
    info = statSync(path);
  } catch {
    return;
  }
  if (info.isDirectory()) {
    for (const entry of readdirSync(path)) yield* walk(join(path, entry));
  } else if (EXTENSIONS.has(extname(path))) {
    yield path;
  }
}

let failures = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      // Skip comment lines so we can *document* the banned utilities.
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return;
      if (trimmed.startsWith('<!--')) return;

      for (const [pattern, hint] of PATTERNS) {
        if (pattern.test(line)) {
          console.error(`${file}:${index + 1}  ${trimmed}\n    -> RTL: ${hint}`);
          failures += 1;
          break;
        }
      }
    });
  }
}

if (failures > 0) {
  console.error(`\n${failures} physical-property violation(s). This app is dir="rtl".`);
  process.exit(1);
}

console.log('lint:rtl — no physical properties found.');
