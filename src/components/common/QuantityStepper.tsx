import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  id?: string | undefined;
  min?: number;
  max?: number;
  'aria-describedby'?: string | undefined;
}

/**
 * Defect 13: the original counters had no minimum, so quantities could go
 * negative. The floor is enforced three ways — here, by the `min` attribute,
 * and by a CHECK constraint in the database. The UI is the convenience; the
 * constraint is the guarantee.
 *
 * The value stays keyboard-enterable (§8.6) rather than being stepper-only,
 * because typing 12 beats tapping + twelve times.
 */
export function QuantityStepper({
  value,
  onChange,
  id,
  min = 0,
  max = 9999,
  'aria-describedby': describedBy,
}: QuantityStepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          onChange(clamp(value - 1));
        }}
        disabled={value <= min}
        aria-label="−"
      >
        <Minus className="size-5" aria-hidden />
      </Button>

      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={String(value)}
        min={min}
        max={max}
        aria-describedby={describedBy}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          onChange(Number.isNaN(parsed) ? min : clamp(parsed));
        }}
        className={cn('w-full text-center')}
      />

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          onChange(clamp(value + 1));
        }}
        disabled={value >= max}
        aria-label="+"
      >
        <Plus className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
