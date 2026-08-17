import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/hooks/useTheme';

/**
 * Defect 17 of the original app: several toasts had a fully transparent
 * background and were unreadable. Every surface here is an opaque token, and
 * `richColors` is deliberately OFF so success/error keep our palette rather
 * than sonner's.
 */
export function Toaster() {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      dir="rtl"
      position="top-center"
      // 6s: this is read one-handed, in a moving vehicle, in sunlight.
      duration={6000}
      toastOptions={{
        classNames: {
          toast:
            'bg-surface text-text border border-border shadow-overlay rounded-md text-body gap-3',
          description: 'text-text-muted text-small',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-surface-alt text-text',
          success: 'text-success',
          error: 'text-danger',
        },
      }}
    />
  );
}
