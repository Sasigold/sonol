import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PasswordInput } from '@/components/common/PasswordInput';
import { PageLoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { toHebrewError } from '@/lib/errors';
import { newPasswordSchema, type NewPasswordValues } from '@/lib/schemas';
import { actions, fields, nav, resetPassword, toasts } from '@/lib/copy';

/**
 * The screen the §8.2 recovery email opens.
 *
 * Without it the reset flow had no end: `resetPasswordForEmail` pointed at
 * /signin, so the link signed the user in on a recovery session and dropped
 * them on the home screen still holding the old password. Nothing in the app
 * ever called `updateUser({ password })`.
 *
 * PUBLIC on purpose, like /blocked. The recovery session belongs to a user who
 * may well be unauthorised — behind RequireAuth they would be bounced to
 * /blocked before they could choose a password, and would then have no way
 * back in at all.
 *
 * supabase-js consumes the `#access_token=…&type=recovery` fragment itself
 * (`detectSessionInUrl`), so by the time the auth context settles this is
 * either a real session or nothing. An expired or already-used link produces
 * nothing, which is the `signedOut` branch below.
 */
export function ResetPasswordPage() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  async function onSubmit(values: NewPasswordValues): Promise<void> {
    setFormError(null);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setFormError(toHebrewError(error));
      return;
    }
    setDone(true);
  }

  return (
    <div className="bg-brand-800 flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-6 p-6">
          <h1 className="text-h1 text-text">{nav.resetPasswordTitle}</h1>

          {/* Loading — the session is still being read out of the URL. */}
          {state.status === 'loading' ? <PageLoadingSkeleton /> : null}

          {/* No recovery session: the link is expired, already used, or typed. */}
          {state.status === 'signedOut' || state.status === 'error' ? (
            <div className="flex flex-col gap-4">
              <p role="alert" className="bg-danger-bg text-danger text-small rounded-md p-3">
                {resetPassword.invalid}
              </p>
              <Button asChild size="wide">
                <Link to="/forgot-password">{resetPassword.requestNew}</Link>
              </Button>
              <Button asChild size="wide" variant="outline">
                <Link to="/signin">{actions.backToSignIn}</Link>
              </Button>
            </div>
          ) : null}

          {state.status === 'signedIn' ? (
            done ? (
              <div className="flex flex-col gap-4">
                <p className="text-body-strong text-success flex items-start gap-2">
                  <CheckCircle2 className="size-5 shrink-0" aria-hidden />
                  {toasts.passwordChanged}
                </p>
                <p className="text-small text-text-muted">{resetPassword.done}</p>
                <Button
                  size="wide"
                  onClick={() => {
                    // `replace`, so the back button cannot return to a form
                    // whose recovery session has already been spent.
                    navigate('/', { replace: true });
                  }}
                >
                  {resetPassword.continue}
                </Button>
              </div>
            ) : (
              <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  void handleSubmit(onSubmit)(event);
                }}
              >
                <p className="text-body text-text-muted">{resetPassword.intro}</p>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">{fields.newPassword}</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                  />
                  {errors.password ? (
                    <p id="password-error" role="alert" className="text-small text-danger">
                      {errors.password.message}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="passwordConfirm">{fields.newPasswordConfirm}</Label>
                  <PasswordInput
                    id="passwordConfirm"
                    autoComplete="new-password"
                    aria-invalid={errors.passwordConfirm ? true : undefined}
                    aria-describedby={errors.passwordConfirm ? 'confirm-error' : undefined}
                    {...register('passwordConfirm')}
                  />
                  {errors.passwordConfirm ? (
                    <p id="confirm-error" role="alert" className="text-small text-danger">
                      {errors.passwordConfirm.message}
                    </p>
                  ) : null}
                </div>

                {formError ? (
                  <p role="alert" className="bg-danger-bg text-danger text-small rounded-md p-3">
                    {formError}
                  </p>
                ) : null}

                {/* Always visible, only ever disabled. */}
                <Button type="submit" size="wide" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                  {actions.setNewPassword}
                </Button>
              </form>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
