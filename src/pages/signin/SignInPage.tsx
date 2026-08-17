import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { isAuthorized, useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { toHebrewError } from '@/lib/errors';
import { signInSchema, type SignInValues } from '@/lib/schemas';
import { app, fields, nav } from '@/lib/copy';

export function SignInPage() {
  const { state } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  // Already signed in — never show the form again (and never push history).
  if (state.status === 'loading') return <PageLoadingSkeleton />;
  if (state.status === 'signedIn') {
    return <Navigate to={isAuthorized(state.profile) ? '/' : '/blocked'} replace />;
  }

  async function onSubmit(values: SignInValues): Promise<void> {
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    // On success the auth listener updates the context and the redirect above
    // takes over — no imperative navigation needed.
    if (error) setFormError(toHebrewError(error));
  }

  return (
    <div className="bg-brand-800 flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-1 text-center">
            <span className="text-display text-primary">{app.name}</span>
            <h1 className="text-h2 text-text">{nav.signInTitle}</h1>
          </div>

          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              void handleSubmit(onSubmit)(event);
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{fields.email}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                className="text-start"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              {errors.email ? (
                <p id="email-error" role="alert" className="text-small text-danger">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{fields.password}</Label>
              <div className="relative flex items-center">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  dir="ltr"
                  className="pe-12 text-start"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowPassword((visible) => !visible);
                  }}
                  aria-label={showPassword ? fields.hidePassword : fields.showPassword}
                  className="text-text-muted hover:text-text absolute end-0 flex size-12 items-center justify-center"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" aria-hidden />
                  ) : (
                    <Eye className="size-5" aria-hidden />
                  )}
                </button>
              </div>
              {errors.password ? (
                <p id="password-error" role="alert" className="text-small text-danger">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p role="alert" className="bg-danger-bg text-danger text-small rounded-md p-3">
                {formError}
              </p>
            ) : null}

            {/* Always visible, only ever disabled — never hidden. */}
            <Button type="submit" size="wide" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {nav.signIn}
            </Button>
          </form>

          <Link
            to="/forgot-password"
            className="text-small text-primary self-center underline-offset-4 hover:underline"
          >
            {nav.forgotPasswordLink}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
