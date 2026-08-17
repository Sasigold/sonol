import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Area } from '@/hooks/useAreas';

interface AreaChipsProps {
  areas: Area[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean | undefined;
}

/**
 * Multi-select area assignment. Chips rather than a multi-select listbox:
 * on a phone, chips are 48px targets that show the whole selection at once.
 */
export function AreaChips({ areas, selected, onChange, disabled = false }: AreaChipsProps) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {areas.map((area) => {
        const isSelected = selected.includes(area.id);
        return (
          <button
            key={area.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              toggle(area.id);
            }}
            aria-pressed={isSelected}
            className={cn(
              // Selection is never colour-alone — the check icon carries it too.
              'text-body inline-flex h-12 items-center gap-2 rounded-full border px-4 transition-colors',
              isSelected
                ? 'border-primary bg-brand-100 text-brand-800'
                : 'border-border bg-surface text-text-muted',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {isSelected ? <Check className="size-4" aria-hidden /> : null}
            {area.name}
          </button>
        );
      })}
    </div>
  );
}
