import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProfileValues } from '@/lib/schemas';
import { errors } from '@/lib/copy';

/**
 * Self-service profile edits.
 *
 * These are the only three columns `authenticated` may write on its own row —
 * not by policy but by grant (`grant update (display_name, photo_url,
 * phone_number)`), so there is no client path that could reach `is_admin` or
 * `completed_count` even by mistake.
 *
 * Nothing here is queued for offline replay. §7 keeps exactly one mutation in
 * the durable queue — completing a station — because that is the only thing
 * done away from a desk. Editing your own name fails loudly instead.
 */

/** The avatars bucket is public-read and writable only inside `<uid>/`. */
const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** One object per user, so an upload replaces the previous file rather than
 *  accumulating orphans. The path must start with the uid — the storage policy
 *  matches on `(storage.foldername(name))[1]`. */
function avatarPath(userId: string): string {
  return `${userId}/avatar`;
}

export function useUpdateProfile(userId: string) {
  return useMutation({
    mutationFn: async (values: ProfileValues) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: values.display_name,
          // An empty field clears the column rather than storing '' — the
          // column is nullable and "no number on file" is a real state.
          phone_number: values.phone_number.length > 0 ? values.phone_number : null,
        })
        .eq('id', userId);
      if (error) throw error;
    },
  });
}

export function useUploadAvatar(userId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      // Checked here as well as by the input's `accept`: `accept` is a filter
      // in the file picker, not a constraint, and drag-and-drop ignores it.
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error(errors.unsupportedImage);
      if (file.size > MAX_AVATAR_BYTES) throw new Error(errors.fileTooLarge);

      const path = avatarPath(userId);
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

      // The path never changes, so the CDN would keep serving the previous
      // image. The query string is ignored by storage and busts that cache.
      const versioned = `${publicUrl}?v=${String(Date.now())}`;

      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: versioned })
        .eq('id', userId);
      if (error) throw error;

      return versioned;
    },
  });
}

export function useRemoveAvatar(userId: string) {
  return useMutation({
    mutationFn: async () => {
      // Column first: if the delete fails the profile still stops pointing at
      // a file, which is the state the user asked for. The reverse order can
      // leave a row referencing an object that is already gone.
      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: null })
        .eq('id', userId);
      if (error) throw error;

      await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(userId)]);
    },
  });
}

/**
 * Change the signed-in user's password.
 *
 * Supabase re-authenticates from the session, so there is no current-password
 * field to send. The 8-character rule is enforced by `newPasswordSchema` on
 * the client only — the server minimum stays at its default of 6.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
  });
}
