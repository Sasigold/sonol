import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/common/PasswordInput';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { PageLoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { RoleBadge } from '@/components/users/RoleBadge';
import { useAuth, type Profile } from '@/contexts/auth-context';
import {
  useChangePassword,
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from '@/hooks/useProfile';
import { toHebrewError } from '@/lib/errors';
import {
  newPasswordSchema,
  profileSchema,
  type NewPasswordValues,
  type ProfileValues,
} from '@/lib/schemas';
import { actions, dialogs, fields, labels, nav, profile as copy, toasts } from '@/lib/copy';

/**
 * The user's own profile — the screen the schema always anticipated and the
 * app never had.
 *
 * `display_name` is not cosmetic: `complete_station` stamps it into
 * `stations.completed_by_name`, so it appears beside every station the user
 * completes and in the admin dashboard. A user created without one had no way
 * to fix it — the admin's edit screen shows the name read-only, by design.
 */
export function ProfilePage() {
  const { state, refresh } = useAuth();

  if (state.status === 'loading') return <PageLoadingSkeleton />;
  if (state.status === 'error') {
    return (
      <ErrorState
        description={state.message}
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }
  // RequireAuth guarantees a session above this route; this is the guard the
  // union forces rather than a case that can happen.
  if (state.status !== 'signedIn') return <PageLoadingSkeleton />;

  return (
    <ProfileForms
      // Remount when the signed-in user changes, so the forms seed from props
      // instead of syncing in an effect.
      key={state.profile.id}
      profile={state.profile}
      onSaved={() => {
        void refresh();
      }}
    />
  );
}

function ProfileForms({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const updateProfile = useUpdateProfile(profile.id);
  const uploadAvatar = useUploadAvatar(profile.id);
  const removeAvatar = useRemoveAvatar(profile.id);
  const changePassword = useChangePassword();

  const details = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile.display_name,
      phone_number: profile.phone_number ?? '',
    },
  });

  const password = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  function saveDetails(values: ProfileValues) {
    updateProfile.mutate(values, {
      onSuccess: () => {
        toast.success(toasts.profileUpdated);
        onSaved();
      },
      onError: (error) => {
        toast.error(toHebrewError(error));
      },
    });
  }

  function savePassword(values: NewPasswordValues) {
    changePassword.mutate(values.password, {
      onSuccess: () => {
        // Clear the fields — leaving a password sitting in a form on a shared
        // tablet is exactly the situation §7 keeps warning about.
        password.reset({ password: '', passwordConfirm: '' });
        setPasswordSaved(true);
        toast.success(toasts.passwordChanged);
      },
      onError: (error) => {
        toast.error(toHebrewError(error));
      },
    });
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    uploadAvatar.mutate(file, {
      onSuccess: () => {
        toast.success(toasts.photoUpdated);
        onSaved();
      },
      onError: (error) => {
        toast.error(toHebrewError(error));
      },
    });
  }

  const initials = profile.display_name.trim().charAt(0) || '?';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            navigate('/');
          }}
          aria-label={nav.back}
        >
          {/* "Back" in RTL points right. */}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
        <h1 className="text-h1 text-text">{nav.profile}</h1>
      </header>

      {/* --- Identity ------------------------------------------------------ */}
      <section className="bg-surface border-border shadow-card flex items-center gap-4 rounded-lg border p-4">
        {profile.photo_url ? (
          <img
            src={profile.photo_url}
            alt=""
            className="size-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="bg-brand-100 text-brand-800 text-body-strong flex size-12 shrink-0 items-center justify-center rounded-full"
          >
            {initials}
          </span>
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-h3 text-text truncate">{profile.display_name}</span>
          <span className="text-caption text-text-muted ltr-isolate truncate">{profile.email}</span>
          <RoleBadge isAdmin={profile.is_admin} className="self-start" />
        </div>
      </section>

      <p className="text-small text-text-muted">{labels.myCompletions(profile.completed_count)}</p>

      {/* --- Photo --------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-h2 text-text">{fields.photo}</h2>
        <p className="text-caption text-text-muted">{copy.photoHint}</p>

        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            pickFile(event.target.files?.[0]);
            // Reset, so choosing the same file twice fires change again.
            event.target.value = '';
          }}
        />

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={uploadAvatar.isPending}
            onClick={() => {
              fileInput.current?.click();
            }}
          >
            {uploadAvatar.isPending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-5" aria-hidden />
            )}
            {actions.uploadPhoto}
          </Button>

          {profile.photo_url ? (
            <Button
              variant="ghost"
              disabled={removeAvatar.isPending}
              onClick={() => {
                setConfirmRemove(true);
              }}
            >
              <Trash2 className="text-danger size-5" aria-hidden />
              {actions.removePhoto}
            </Button>
          ) : null}
        </div>
      </section>

      {/* --- Contact details ------------------------------------------------ */}
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void details.handleSubmit(saveDetails)(event);
        }}
      >
        <h2 className="text-h2 text-text">{nav.profile}</h2>
        <p className="text-caption text-text-muted">{copy.contactIntro}</p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="display_name">{fields.fullName}</Label>
          <Input
            id="display_name"
            autoComplete="name"
            aria-invalid={details.formState.errors.display_name ? true : undefined}
            {...details.register('display_name')}
          />
          {details.formState.errors.display_name ? (
            <p role="alert" className="text-small text-danger">
              {details.formState.errors.display_name.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone_number">{fields.phone}</Label>
          {/* A phone number is a Latin run: LTR field, start-aligned. */}
          <Input
            id="phone_number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            className="text-start"
            aria-invalid={details.formState.errors.phone_number ? true : undefined}
            {...details.register('phone_number')}
          />
          {details.formState.errors.phone_number ? (
            <p role="alert" className="text-small text-danger">
              {details.formState.errors.phone_number.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{fields.email}</Label>
          <Input
            id="email"
            value={profile.email}
            readOnly
            disabled
            dir="ltr"
            className="text-start"
          />
          <p className="text-caption text-text-muted">{copy.emailReadOnly}</p>
        </div>

        <Button type="submit" size="wide" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {actions.save}
        </Button>
      </form>

      {/* --- Password ------------------------------------------------------- */}
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void password.handleSubmit(savePassword)(event);
        }}
      >
        <h2 className="text-h2 text-text">{actions.changePassword}</h2>
        <p className="text-caption text-text-muted">{copy.passwordIntro}</p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">{fields.newPassword}</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            aria-invalid={password.formState.errors.password ? true : undefined}
            {...password.register('password')}
          />
          {password.formState.errors.password ? (
            <p role="alert" className="text-small text-danger">
              {password.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password-confirm">{fields.newPasswordConfirm}</Label>
          <PasswordInput
            id="new-password-confirm"
            autoComplete="new-password"
            aria-invalid={password.formState.errors.passwordConfirm ? true : undefined}
            {...password.register('passwordConfirm')}
          />
          {password.formState.errors.passwordConfirm ? (
            <p role="alert" className="text-small text-danger">
              {password.formState.errors.passwordConfirm.message}
            </p>
          ) : null}
        </div>

        {passwordSaved ? (
          <p className="text-small text-success flex items-center gap-2">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            {toasts.passwordChanged}
          </p>
        ) : null}

        <Button type="submit" size="wide" variant="outline" disabled={changePassword.isPending}>
          {changePassword.isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : null}
          {actions.setNewPassword}
        </Button>
      </form>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={dialogs.removePhoto.title}
        description={dialogs.removePhoto.body}
        confirmLabel={actions.removePhoto}
        destructive
        pending={removeAvatar.isPending}
        onConfirm={() => {
          removeAvatar.mutate(undefined, {
            onSuccess: () => {
              setConfirmRemove(false);
              toast.success(toasts.photoRemoved);
              onSaved();
            },
            onError: (error) => {
              setConfirmRemove(false);
              toast.error(toHebrewError(error));
            },
          });
        }}
      />
    </div>
  );
}
