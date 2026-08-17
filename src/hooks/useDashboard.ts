import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Views } from '@/lib/supabase';

export type AreaStat = Views<'area_stats'>;
export type GlobalStat = Views<'global_stats'>;
export type UserStat = Views<'user_stats'>;

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
