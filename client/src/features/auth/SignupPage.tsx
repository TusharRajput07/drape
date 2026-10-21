import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-types';
import { fieldErrors, toastError } from '@/lib/errors';
import { useSignup } from './auth.api';
import { signupSchema } from './schemas';

const FIELDS = ['name', 'username', 'email', 'password'] as const;
type Field = (typeof FIELDS)[number];
const isField = (f: string): f is Field => (FIELDS as readonly string[]).includes(f);

export function SignupPage() {
  const signup = useSignup();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', username: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) =>
    signup.mutate(values, {
      onError: (err) => {
        // Taken email/username show under their field (03 §6.1).
        if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
          return setError('email', { message: err.message }, { shouldFocus: true });
        }
        if (err instanceof ApiError && err.code === 'USERNAME_TAKEN') {
          return setError('username', { message: err.message }, { shouldFocus: true });
        }
        const fields = Object.entries(fieldErrors(err)).filter(([f]) => isField(f));
        if (!fields.length) return toastError(err);
        for (const [field, message] of fields) setError(field as Field, { message });
      },
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3.5">
      <h1 className="text-[21px]">Create your account</h1>
      <FormField
        id="name"
        label="Name"
        autoComplete="name"
        maxLength={60}
        error={errors.name?.message}
        {...register('name')}
      />
      <FormField
        id="username"
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={24}
        error={errors.username?.message}
        {...register('username')}
      />
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
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" className="mt-1.5 w-full" disabled={signup.isPending}>
        {signup.isPending ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="text-center text-[13px] text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-accent underline underline-offset-2">
          Log in
        </Link>
      </p>
    </form>
  );
}
