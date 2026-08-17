import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Views } from '@/lib/supabase';

export type AreaStat = Views<'area_stats'>;
export type GlobalStat = Views<'global_stats'>;
export type UserStat = Views<'user_stats'>;
export type WorkerPaceStat = Views<'worker_pace_stats'>;
export type CompletionGap = Views<'completion_gaps'>;
export type RoundDailyStat = Views<'round_daily_stats'>;

/**
 * The dashboard is FOUR queries, one per view — not `1 + 3 x areas` realtime
 * listeners summing on the client, which is what the original did (defect 20).
 */
export function useGlobalStats() {
  return useQuery({
    queryKey: ['dashboard', 'global'],
    queryFn: async (): Promise<GlobalStat> => {
      const { data, error } = await supabase.from('global_stats').select('*').single();
      if (error) throw error;
      return data;
    },
  });
}

export function useAreaStats() {
  return useQuery({
    queryKey: ['dashboard', 'areas'],
    queryFn: async (): Promise<AreaStat[]> => {
      const { data, error } = await supabase
        .from('area_stats')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: ['dashboard', 'users'],
    queryFn: async (): Promise<UserStat[]> => {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .order('stations_completed_now', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * The open round's id, for the pace and daily sections which key on it.
 *
 * `maybeSingle` on purpose: between a `reset_round` closing the old round and
 * the new one being seeded there is a blink with no open round, and that must
 * resolve to `null`, not throw.
 */
export function useCurrentRound() {
  return useQuery({
    queryKey: ['dashboard', 'round'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('rounds')
        .select('id')
        .is('ended_at', null)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });
}

/**
 * Per-worker pace for one round: median gap, worst gap, anomaly count.
 *
 * `security_invoker` on the view means an admin sees every worker; the screen
 * is admin-only regardless. Worst offenders first so a scanning manager sees
 * the anomalies at the top.
 */
export function useWorkerPace(roundId: string | null) {
  return useQuery({
    queryKey: ['dashboard', 'pace', roundId ?? ''],
    enabled: roundId !== null,
    queryFn: async (): Promise<WorkerPaceStat[]> => {
      const { data, error } = await supabase
        .from('worker_pace_stats')
        .select('*')
        .eq('round_id', roundId ?? '')
        .order('anomaly_count', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * The anomalous legs of one round, longest gap first.
 *
 * Lazy like `useRoundUserStats`: enabled only once the manager expands the
 * anomalies disclosure, so the per-leg rows are not fetched for a dashboard
 * that is only glanced at. Capped at 50 — a longer list is a data problem, not
 * something to scroll.
 */
export function useAnomalousLegs(roundId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'anomalies', roundId ?? ''],
    enabled: roundId !== null && enabled,
    queryFn: async (): Promise<CompletionGap[]> => {
      const { data, error } = await supabase
        .from('completion_gaps')
        .select('*')
        .eq('round_id', roundId ?? '')
        .eq('is_anomaly', true)
        .order('gap_seconds', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Completions per day for one round, oldest day first. Buckets are already in
 * Asia/Jerusalem (the view does the `at time zone`), so `day` is a plain
 * 'YYYY-MM-DD' string and no timezone maths runs in the browser.
 */
export function useRoundDailyStats(roundId: string | null) {
  return useQuery({
    queryKey: ['dashboard', 'daily', roundId ?? ''],
    enabled: roundId !== null,
    queryFn: async (): Promise<RoundDailyStat[]> => {
      const { data, error } = await supabase
        .from('round_daily_stats')
        .select('*')
        .eq('round_id', roundId ?? '')
        .order('day', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Reset the round.
 *
 * Defect 8: the original ran a client-side WriteBatch that silently failed
 * past 500 documents and did not await its own commit, so the success toast
 * appeared before the write landed. This is ONE atomic RPC, awaited, and the
 * caller only reports success once it resolves.
 */
export function useResetRound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (label: string | null) => {
      // Omit the label rather than sending undefined; the RPC defaults it to
      // today's date.
      const args: { p_label?: string } = {};
      if (label !== null) args.p_label = label;

      const { error } = await supabase.rpc('reset_round', args);
      if (error) throw error;
    },
    onSuccess: () => {
      // Everything moved: stations, area counts, per-user counters.
      void queryClient.invalidateQueries();
    },
  });
}
