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

/**
 * Strip comments before matching.
 *
 * Comments must be skipped so the banned utilities can be *documented* — and
 * that means tracking `/* … *\/` and `<!-- … -->` across lines, not just
 * spotting an opening marker at the start of one. A continuation line of a
 * block comment carries no marker of its own.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');
}

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      for (const [pattern, hint] of PATTERNS) {
        if (pattern.test(line)) {
          console.error(`${file}:${index + 1}  ${line.trim()}\n    -> RTL: ${hint}`);
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
