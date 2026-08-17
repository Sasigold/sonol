import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Views, type Tables } from '@/lib/supabase';
import type { AreaValues } from '@/lib/schemas';

export type MyArea = Views<'my_areas'>;
export type Area = Tables<'areas'>;

export const areaKeys = {
  mine: ['my_areas'] as const,
  all: ['areas'] as const,
};

/**
 * The signed-in user's areas, from the `my_areas` view — ONE query.
 *
 * Defect 16 of the original app: the home page ran a Firestore `whereIn` over
 * an array of area names, which errors on an empty array and caps at 30. A user
 * with no areas got an infinite spinner. A view with a join has neither
 * problem, and returns an empty array for the no-areas case.
 */
export function useMyAreas() {
  return useQuery({
    queryKey: areaKeys.mine,
    queryFn: async (): Promise<MyArea[]> => {
      const { data, error } = await supabase
        .from('my_areas')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Every area, for the station form's select. Admin-visible by RLS. */
export function useAllAreas() {
  return useQuery({
    queryKey: areaKeys.all,
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Area writes.
 *
 * Direct table writes rather than RPCs, matching how stations are written: the
 * `areas_admin_write` policy plus `public.is_admin()` already refuse a
 * non-admin, and there is no multi-table invariant here for a function to keep.
 * The RPCs in §3 exist for operations that are privileged (privilege flags) or
 * must be atomic across tables (completion, reset) — this is neither.
 *
 * Every mutation invalidates `my_areas` and the dashboard as well: an area's
 * name and order appear on the home screen and in the area table.
 */
function invalidateAreas(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: areaKeys.all });
  void queryClient.invalidateQueries({ queryKey: areaKeys.mine });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useCreateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, existing }: AreaValues & { existing: Area[] }) => {
      // Append: one past the current maximum, so a new area lands at the end
      // of the list instead of colliding with an existing position.
      const nextOrder = existing.reduce((max, area) => Math.max(max, area.sort_order), 0) + 1;
      const { error } = await supabase.from('areas').insert({ name, sort_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAreas(queryClient);
    },
  });
}

export function useRenameArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string } & AreaValues) => {
      const { error } = await supabase.from('areas').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAreas(queryClient);
    },
  });
}

/**
 * Swap two areas' positions.
 *
 * Two updates rather than a renumber of the whole list: `sort_order` has no
 * unique constraint, so a swap cannot collide, and touching two rows keeps the
 * write small enough to be worth doing without an RPC.
 */
export function useSwapAreaOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ a, b }: { a: Area; b: Area }) => {
      const first = await supabase
        .from('areas')
        .update({ sort_order: b.sort_order })
        .eq('id', a.id);
      if (first.error) throw first.error;

      const second = await supabase
        .from('areas')
        .update({ sort_order: a.sort_order })
        .eq('id', b.id);
      if (second.error) throw second.error;
    },
    onSuccess: () => {
      invalidateAreas(queryClient);
    },
  });
}

/**
 * Delete an area.
 *
 * `stations.area_id` is `on delete restrict`, so the database refuses this
 * while the area still holds stations — the screen checks the count first and
 * says so in Hebrew rather than letting the write fail.
 */
export function useDeleteArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('areas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAreas(queryClient);
      // user_areas rows cascade with the area, so assignments changed too.
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
