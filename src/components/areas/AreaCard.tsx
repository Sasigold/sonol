import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ProgressRing } from '@/components/common/ProgressBar';
import { labels } from '@/lib/copy';
import type { MyArea } from '@/hooks/useAreas';

export function AreaCard({ area }: { area: MyArea }) {
  const remaining = area.remaining_count ?? 0;
  const done = area.done_count ?? 0;
  const total = area.station_count ?? 0;

  return (
    <Link
      to={`/areas/${area.area_id ?? ''}`}
      className="bg-surface border-border shadow-card hover:bg-surface-alt flex items-center gap-4 rounded-lg border p-4 transition-colors"
    >
      <ProgressRing done={done} total={total} />

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-h3 text-text truncate">{area.area_name}</span>
        <span className="text-small text-text-muted">{labels.remaining(remaining)}</span>
      </span>

      {/* A left chevron points the wrong way in RTL — mirror it. */}
      <ChevronLeft className="text-text-muted size-5 shrink-0 rtl:-scale-x-100" aria-hidden />
    </Link>
  );
}
