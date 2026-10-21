import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-types';
import { fieldErrors, toastError } from '@/lib/errors';
import { useLogin } from './auth.api';
import { loginSchema } from './schemas';

export function LoginPage() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
          return setError('root', { message: err.message });
        }
        const fields = Object.entries(fieldErrors(err));
        if (!fields.length) return toastError(err);
        for (const [field, message] of fields) {
          if (field === 'email' || field === 'password') setError(field, { message });
        }
      },
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3.5">
      <h1 className="text-[21px]">Log in</h1>
      <FormField
        id="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        error={errors.email?.message}
        {...register('email')}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      {errors.root && <p className="text-[13px] text-danger">{errors.root.message}</p>}
      <Button type="submit" className="mt-1.5 w-full" disabled={login.isPending}>
        {login.isPending ? 'Logging in…' : 'Log in'}
      </Button>
      <p className="text-center text-[13px] text-muted">
        New to Drape?{' '}
        <Link to="/signup" className="font-medium text-accent underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </form>
  );
}
