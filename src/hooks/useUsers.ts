import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';

export type Profile = Tables<'profiles'>;

export interface UserRow extends Profile {
  area_ids: string[];
}

export const userKeys = {
  all: ['users'] as const,
  one: (id: string) => ['user', id] as const,
};

/**
 * Every user plus their area assignments, in ONE round trip via the embedded
 * junction rows.
 */
export function useUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: async (): Promise<UserRow[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, user_areas(area_id)')
        .order('display_name', { ascending: true });
      if (error) throw error;

      // The embedded relation is typed loosely by PostgREST; name it so the
      // destructure is not an implicit `any`.
      return data.map((row) => {
        const { user_areas: links, ...profile }: Profile & { user_areas: { area_id: string }[] } =
          row;
        return { ...profile, area_ids: links.map((link) => link.area_id) };
      });
    },
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: userKeys.one(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<UserRow> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, user_areas(area_id)')
        .eq('id', id ?? '')
        .single();
      if (error) throw error;

      const { user_areas: links, ...profile }: Profile & { user_areas: { area_id: string }[] } =
        data;
      return { ...profile, area_ids: links.map((link) => link.area_id) };
    },
  });
}

/**
 * Permission flags and area assignments, both via RPCs.
 *
 * The client CANNOT write these columns — the grants forbid it — so there is
 * no client-side path that could bypass the checks inside the functions.
 */
export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      isAuthorized,
      isAdmin,
      areaIds,
    }: {
      isAuthorized?: boolean;
      isAdmin?: boolean;
      areaIds?: string[];
    }) => {
      if (isAuthorized !== undefined || isAdmin !== undefined) {
        // Omit rather than send undefined: the RPC coalesces a missing
        // argument to the current value.
        const args: { p_user_id: string; p_is_authorized?: boolean; p_is_admin?: boolean } = {
          p_user_id: id,
        };
        if (isAuthorized !== undefined) args.p_is_authorized = isAuthorized;
        if (isAdmin !== undefined) args.p_is_admin = isAdmin;

        const { error } = await supabase.rpc('admin_set_user_flags', args);
        if (error) throw error;
      }

      if (areaIds !== undefined) {
        const { error } = await supabase.rpc('admin_set_user_areas', {
          p_user_id: id,
          p_area_ids: areaIds,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      void queryClient.invalidateQueries({ queryKey: userKeys.one(id) });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * Create / delete go through Edge Functions holding the service-role key.
 *
 * Defect 3: creating a user client-side replaced the ADMIN'S OWN session with
 * the new user's. Defect 4: deleting removed only the profile row, leaving the
 * auth account able to sign back in.
 *
 * `supabase.functions.invoke` sends the caller's JWT, which the function
 * verifies before doing anything.
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      display_name: string;
      is_admin: boolean;
      area_ids: string[];
    }) => {
      const response = await supabase.functions.invoke<{ error?: string }>('admin-create-user', {
        body: input,
      });
      if (response.error) throw response.error;
      // The function answers 200 with a Hebrew message for expected failures
      // (duplicate email, weak password) so the text reaches the toast intact.
      const message = response.data?.error;
      if (typeof message === 'string') throw new Error(message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke<{ error?: string }>('admin-delete-user', {
        body: { user_id: userId },
      });
      if (response.error) throw response.error;
      const message = response.data?.error;
      if (typeof message === 'string') throw new Error(message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
