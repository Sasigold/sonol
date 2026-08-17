import { useQuery } from '@tanstack/react-query';
import { supabase, type Views } from '@/lib/supabase';

export type RoundStat = Views<'round_stats'>;
export type RoundUserStat = Views<'round_user_stats'>;

export const roundKeys = {
  all: ['rounds'] as const,
  users: (roundId: string) => ['rounds', roundId, 'users'] as const,
};

/**
 * Every round, newest first — one query against the view.
 *
 * `security_invoker` means RLS still applies: an admin gets every worker's
 * completions counted, a worker gets only their own. The screen is admin-only
 * today, but the view does not depend on that being true.
 */
export function useRoundStats() {
  return useQuery({
    queryKey: roundKeys.all,
    queryFn: async (): Promise<RoundStat[]> => {
      const { data, error } = await supabase
        .from('round_stats')
        .select('*')
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * The per-worker breakdown for ONE round, fetched when that round is opened.
 *
 * Loading every round's breakdown up front would pull the entire completion
 * history to render a list that shows totals — the whole point of reading
 * aggregates from a view rather than summing rows on the client.
 */
export function useRoundUserStats(roundId: string | null) {
  return useQuery({
    queryKey: roundKeys.users(roundId ?? ''),
    enabled: roundId !== null,
    queryFn: async (): Promise<RoundUserStat[]> => {
      const { data, error } = await supabase
        .from('round_user_stats')
        .select('*')
        .eq('round_id', roundId ?? '')
        .order('completed_count', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
