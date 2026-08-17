import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Download, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StatTile } from '@/components/dashboard/StatTile';
import { AreaTable } from '@/components/dashboard/AreaTable';
import { WorkerChart } from '@/components/dashboard/WorkerChart';
import { useAreaStats, useGlobalStats, useResetRound, useUserStats } from '@/hooks/useDashboard';
import { downloadCsv, toCsv } from '@/lib/csv';
import { toHebrewError } from '@/lib/errors';
import { actions, dialogs, fields, labels, nav, states, toasts } from '@/lib/copy';

export function DashboardPage() {
  const global = useGlobalStats();
  const areas = useAreaStats();
  const users = useUserStats();
  const reset = useResetRound();

  const [resetOpen, setResetOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const isPending = global.isPending || areas.isPending || users.isPending;
  const isError = global.isError || areas.isError || users.isError;

  const done = global.data?.done_count ?? 0;
  const remaining = global.data?.remaining_count ?? 0;
  const total = global.data?.station_count ?? 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  function exportCsv() {
    if (!areas.data) return;
    const csv = toCsv(
      [fields.area, fields.fuelRegular, fields.fuelSuper, fields.flyers, labels.remainingShort],
      areas.data.map((row) => [
        row.area_name,
        row.total_regular,
        row.total_super,
        row.total_flyers,
        row.remaining_count,
      ]),
    );
    downloadCsv('sonol-areas.csv', csv);
  }

  function confirmReset() {
    reset.mutate(null, {
      onSuccess: () => {
        // Only after the RPC resolves — defect 8 was a success toast that
        // appeared before the write had landed.
        setResetOpen(false);
        setTyped('');
        toast.success(toasts.roundReset);
      },
      onError: (error) => {
        toast.error(toHebrewError(error));
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-text">{nav.dashboard}</h1>

      {isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          <div className="flex gap-3">
            <Skeleton className="h-12 flex-1 rounded-lg" />
            <Skeleton className="h-12 flex-1 rounded-lg" />
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          onRetry={() => {
            void global.refetch();
            void areas.refetch();
            void users.refetch();
          }}
        />
      ) : null}

      {!isPending && !isError ? (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex gap-3">
              <StatTile
                label={labels.done}
                value={done}
                icon={CheckCircle2}
                tone="success"
                className="flex-1"
              />
              <StatTile
                label={labels.remainingShort}
                value={remaining}
                icon={Circle}
                tone={remaining > 0 ? 'warning' : 'default'}
                className="flex-1"
              />
            </div>
            <p className="text-body text-text-muted">{labels.roundProgress(done, total)}</p>
            <p className="text-h2 text-text tabular-nums">{percent}%</p>
          </section>

          <section className="bg-surface border-border shadow-card flex flex-col gap-3 rounded-lg border p-4">
            <h2 className="text-h2 text-text">{fields.total}</h2>
            <dl className="grid grid-cols-3 gap-3">
              <Total label={labels.totalRegular} value={global.data.total_regular ?? 0} />
              <Total label={labels.totalSuper} value={global.data.total_super ?? 0} />
              <Total label={labels.totalFlyers} value={global.data.total_flyers ?? 0} />
            </dl>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-h2 text-text">{fields.worker}</h2>
            <WorkerChart stats={users.data} />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-h2 text-text">{fields.area}</h2>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="size-5" aria-hidden />
                {actions.exportCsv}
              </Button>
            </div>
            <AreaTable stats={areas.data} />
          </section>

          <Button
            variant="destructive"
            size="wide"
            onClick={() => {
              setResetOpen(true);
            }}
          >
            <RotateCcw className="size-5" aria-hidden />
            {actions.resetAll}
          </Button>
        </>
      ) : null}

      {/*
        Not the shared ConfirmDialog: this one needs a typed confirmation, and
        forcing that into the shared component would complicate every other
        call site for the sake of one screen.
      */}
      <AlertDialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) setTyped('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogs.resetRound.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogs.resetRound.body}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reset-confirm">{dialogs.resetRound.typeToConfirm}</Label>
            <Input
              id="reset-confirm"
              value={typed}
              autoComplete="off"
              onChange={(event) => {
                setTyped(event.target.value);
              }}
            />
          </div>

          <AlertDialogFooter>
            <Button
              variant="destructive"
              // The typed word is the gate. This is the most destructive action
              // in the app and it clears every counter.
              disabled={typed.trim() !== dialogs.resetRound.confirmWord || reset.isPending}
              onClick={confirmReset}
            >
              {reset.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {actions.confirm}
            </Button>
            <AlertDialogCancel disabled={reset.isPending}>{actions.cancel}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="text-h2 text-text tabular-nums">{value}</dd>
    </div>
  );
}
