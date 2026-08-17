import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge has to be taught our type scale, or it silently destroys it.
 *
 * Its heuristic for `text-*` is: t-shirt size or arbitrary value → font-size,
 * anything else → text-COLOR. Our scale is named `display h1 h2 h3 body
 * body-strong small caption`, none of which look like sizes, so every one of
 * them was classified as a colour and then dropped as "conflicting" the moment
 * a real colour appeared beside it:
 *
 *   cn('text-h1', 'text-danger')   ->  'text-danger'        (size lost)
 *   cn('text-body-strong', ...)    ->  the weight vanished from every Button
 *
 * No error, no warning — the class just stopped being emitted. Registering the
 * scale under `font-size` restores both halves while keeping genuine conflicts
 * resolving correctly (`cn('text-h1','text-h2')` is still `text-h2`).
 *
 * The spacing, radius and shadow scales need no equivalent: they keep
 * Tailwind's own naming (or, for shadows, are matched by position), and were
 * verified to merge correctly as-is.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: ['display', 'h1', 'h2', 'h3', 'body', 'body-strong', 'small', 'caption'],
        },
      ],
    },
  },
});

/** Merge Tailwind classes, letting later classes win genuine conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
