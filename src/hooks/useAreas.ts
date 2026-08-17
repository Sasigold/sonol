import { useQuery } from '@tanstack/react-query';
import { supabase, type Views, type Tables } from '@/lib/supabase';

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
