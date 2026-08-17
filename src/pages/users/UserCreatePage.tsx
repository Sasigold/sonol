import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AreaChips } from '@/components/users/AreaChips';
import { useAllAreas } from '@/hooks/useAreas';
import { useCreateUser } from '@/hooks/useUsers';
import { createUserSchema, type CreateUserValues } from '@/lib/schemas';
import { toHebrewError } from '@/lib/errors';
import { actions, app, fields, nav, toasts } from '@/lib/copy';
import { cn } from '@/lib/utils';

/** 0-4. Deliberately simple and explainable, not an entropy estimate. */
function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function UserCreatePage() {
  const navigate = useNavigate();
  const { data: areas } = useAllAreas();
  const createUser = useCreateUser();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    mode: 'onChange',
    defaultValues: {
      display_name: '',
      email: '',
      password: '',
      passwordConfirm: '',
      is_admin: false,
      // Every area selected by default (§8.8).
      area_ids: [],
    },
  });

  // useWatch rather than watch(): watch() returns a new function each render,
  // which opts the component out of memoization.
  const password = useWatch({ control, name: 'password' });
  const score = passwordScore(password);

  function onSubmit(values: CreateUserValues) {
    createUser.mutate(
      {
        email: values.email,
        password: values.password,
        display_name: values.display_name,
        is_admin: values.is_admin,
        area_ids: values.area_ids.length > 0 ? values.area_ids : (areas ?? []).map((a) => a.id),
      },
      {
        onSuccess: () => {
          toast.success(toasts.userCreated);
          navigate('/users', { replace: true });
        },
        onError: (error) => {
          toast.error(toHebrewError(error));
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            navigate('/users');
          }}
          aria-label={nav.back}
        >
          <ArrowRight className="size-5" aria-hidden />
        </Button>
        <h1 className="text-h1 text-text">{nav.newUser}</h1>
      </header>

      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="display_name">{fields.fullName}</Label>
          <Input id="display_name" autoComplete="off" {...register('display_name')} />
          {errors.display_name ? (
            <p role="alert" className="text-small text-danger">
              {errors.display_name.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{fields.email}</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            dir="ltr"
            className="text-start"
            {...register('email')}
          />
          {errors.email ? (
            <p role="alert" className="text-small text-danger">
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
              autoComplete="new-password"
              dir="ltr"
              className="pe-12 text-start"
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

          {/* Strength meter: colour plus a filled-segment count, never colour alone. */}
          <div className="flex items-center gap-2">
            <span className="text-caption text-text-muted">{app.passwordStrength}</span>
            <span
              className="flex flex-1 gap-1"
              role="meter"
              aria-valuenow={score}
              aria-valuemin={0}
              aria-valuemax={4}
            >
              {[0, 1, 2, 3].map((segment) => (
                <span
                  key={segment}
                  className={cn(
                    'h-2 flex-1 rounded-full',
                    segment < score
                      ? score <= 1
                        ? 'bg-danger'
                        : score === 2
                          ? 'bg-warning'
                          : 'bg-success'
                      : 'bg-surface-alt',
                  )}
                />
              ))}
            </span>
          </div>

          {errors.password ? (
            <p role="alert" className="text-small text-danger">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="passwordConfirm">{fields.passwordConfirm}</Label>
          <Input
            id="passwordConfirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            dir="ltr"
            className="text-start"
            {...register('passwordConfirm')}
          />
          {errors.passwordConfirm ? (
            <p role="alert" className="text-small text-danger">
              {errors.passwordConfirm.message}
            </p>
          ) : null}
        </div>

        <div className="border-border flex items-center justify-between gap-4 rounded-md border p-4">
          <Label htmlFor="is_admin">{fields.admin}</Label>
          <Controller
            control={control}
            name="is_admin"
            render={({ field }) => (
              <Switch id="is_admin" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Label>{fields.area}</Label>
          <Controller
            control={control}
            name="area_ids"
            render={({ field }) => (
              <AreaChips
                areas={areas ?? []}
                // Empty means "all", which is the documented default.
                selected={field.value.length > 0 ? field.value : (areas ?? []).map((a) => a.id)}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <Button type="submit" size="wide" disabled={!isValid || createUser.isPending}>
          {createUser.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {actions.add}
        </Button>
      </form>
    </div>
  );
}
