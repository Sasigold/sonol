import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { toHebrewError } from '@/lib/errors';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/schemas';
import { actions, fields, forgotPassword, nav, toasts } from '@/lib/copy';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordValues): Promise<void> {
    setFormError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/signin`,
    });
    // Only claim success when the call actually succeeded (§8.2). The original
    // showed the confirmation unconditionally.
    if (error) {
      setFormError(toHebrewError(error));
      return;
    }
    setSent(true);
  }

  return (
    <div className="bg-brand-800 flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-6 p-6">
          <Link
            to="/signin"
            className="text-small text-primary inline-flex items-center gap-1 self-start underline-offset-4 hover:underline"
          >
            {/* The arrow must point the way "back" goes in RTL. */}
            <ArrowRight className="size-4" aria-hidden />
            {nav.back}
          </Link>

          <h1 className="text-h1 text-text">{nav.forgotPasswordTitle}</h1>

          {sent ? (
            <div className="flex flex-col gap-4">
              <p className="text-body-strong text-success flex items-start gap-2">
                <CheckCircle2 className="size-5 shrink-0" aria-hidden />
                {toasts.resetEmailSent}
              </p>
              <p className="text-small text-text-muted">{forgotPassword.sent}</p>
              <Button asChild size="wide" variant="outline">
                <Link to="/signin">{actions.backToSignIn}</Link>
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
              <p className="text-body text-text-muted">{forgotPassword.intro}</p>

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

              {formError ? (
                <p role="alert" className="bg-danger-bg text-danger text-small rounded-md p-3">
                  {formError}
                </p>
              ) : null}

              <Button type="submit" size="wide" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                {actions.sendResetLink}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
