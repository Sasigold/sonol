#!/usr/bin/env node
/**
 * Scale guard.
 *
 * The design tokens reset `--spacing-*`, `--radius-*`, `--shadow-*` and
 * `--text-*` to `initial`, so `h-9`, `p-7`, `rounded-xl`, `shadow-md` and
 * `text-4xl` are outside the system. The catch, and the reason this script
 * exists: in a .tsx class string those DO NOT fail the build. Tailwind simply
 * emits no rule and the element silently renders unstyled — passing typecheck,
 * ESLint and `vite build` on the way through. (Inside `@apply` it does throw,
 * which is why the CSS side never needed a guard.)
 *
 * This turns that silent class of bug into a build failure: every utility-shaped
 * class used in the source is compiled against the real token layer, and
 * anything that produces no CSS is reported.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_ENTRY = join(ROOT, 'src/styles/globals.css');
const SRC = join(ROOT, 'src');

/**
 * Only classes shaped like a scale-bearing utility are checked. Restricting to
 * these prefixes keeps ordinary English words in string literals from being
 * mistaken for classes, which is what makes the signal usable.
 */
const SCALE_PREFIXES =
  /^-?(h|w|size|min-h|min-w|max-h|max-w|p|px|py|pt|pb|ps|pe|m|mx|my|mt|mb|ms|me|gap|gap-x|gap-y|inset|inset-x|inset-y|top|bottom|start|end|text|bg|border|rounded|shadow|ring|basis|leading|tracking|translate-x|translate-y)-/;

/** Extract candidate classes from className="…", cn('…'), cva('…') and friends. */
function extractCandidates(source) {
  const found = new Set();
  // Any single- or double-quoted string, plus template-literal chunks.
  const strings = source.match(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g) ?? [];
  for (const raw of strings) {
    const body = raw.slice(1, -1);
    // Bail on anything that is plainly prose rather than a class list.
    if (body.includes('  ') || /[֐-׿]/.test(body)) continue;
    for (const token of body.split(/\s+/)) {
      if (!token) continue;
      // Strip variant prefixes (hover:, dark:, rtl:, sm:, data-[…]:) — the
      // scale lives in the final segment.
      // `*` only appears in token-definition source (e.g. `--text-*`), never
      // in a real class.
      if (token.includes('*')) continue;
      const bare = token.split(':').pop() ?? '';
      if (SCALE_PREFIXES.test(bare)) found.add(token);
    }
  }
  return found;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (['.tsx', '.ts'].includes(extname(path))) yield path;
  }
}

const candidates = new Map(); // class -> [files]
for (const file of walk(SRC)) {
  if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
  if (file.endsWith('database.types.ts')) continue;
  for (const candidate of extractCandidates(readFileSync(file, 'utf8'))) {
    const seen = candidates.get(candidate) ?? [];
    seen.push(file.slice(ROOT.length + 1));
    candidates.set(candidate, seen);
  }
}

/** Resolve `@import 'tailwindcss'` (and its internal partials) from node_modules. */
function loadStylesheet(id, base) {
  if (id === 'tailwindcss') {
    const path = join(ROOT, 'node_modules/tailwindcss/index.css');
    return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
  }
  const path = id.startsWith('.')
    ? resolve(base, id)
    : join(ROOT, 'node_modules', id.replace(/^tailwindcss\//, 'tailwindcss/'));
  return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
}

const compiler = await compile(readFileSync(CSS_ENTRY, 'utf8'), {
  base: dirname(CSS_ENTRY),
  onDependency() {},
  loadStylesheet,
});

/** CSS identifier escaping, so `size-3.5` is looked up as `.size-3\.5`. */
const escapeSelector = (candidate) => candidate.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);

// One build for all candidates — `build()` accumulates across calls, so a
// per-candidate build would report every class as present after the first.
const css = compiler.build([...candidates.keys()]);

const dead = [];
for (const [candidate, files] of candidates) {
  if (!css.includes(`.${escapeSelector(candidate)}`)) dead.push([candidate, files]);
}

if (dead.length > 0) {
  console.error('Classes outside the design system — these emit NO CSS:\n');
  for (const [candidate, files] of dead.sort()) {
    console.error(`  ${candidate}`);
    for (const file of [...new Set(files)]) console.error(`      ${file}`);
  }
  console.error(
    `\n${dead.length} dead class(es). Spacing is 0/px/1/2/3/4/5/6/8/10/12, radii sm/md/lg/full,\n` +
      'shadows card/raised/overlay, type display/h1/h2/h3/body/body-strong/small/caption.',
  );
  process.exit(1);
}

console.log(`check-scale — ${String(candidates.size)} classes checked, all resolve.`);
