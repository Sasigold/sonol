import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { fields } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * A password field with the show/hide toggle §8.1 requires.
 *
 * `dir="ltr"` with `text-start`: a password is a Latin run, and typing one into
 * an RTL field puts the caret on the wrong side and reorders the dots. The
 * toggle sits at `end-0` — the logical end, which is the LEFT edge under
 * `dir="rtl"` — and is a full 48x48 target like every other control.
 *
 * The visibility state is local on purpose. Sharing one flag across a password
 * and its confirmation reveals both at once, which defeats the point of asking
 * twice.
 */
export function PasswordInput({ className, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative flex items-center">
      <Input
        type={visible ? 'text' : 'password'}
        dir="ltr"
        className={cn('pe-12 text-start', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          setVisible((current) => !current);
        }}
        aria-label={visible ? fields.hidePassword : fields.showPassword}
        className="text-text-muted hover:text-text absolute end-0 flex size-12 items-center justify-center"
      >
        {visible ? (
          <EyeOff className="size-5" aria-hidden />
        ) : (
          <Eye className="size-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
