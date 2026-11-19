import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import { COMPLETE_PATH, PENDING_COOKIE, verifyPending } from '@/lib/native-auth/browser-cookie';

interface LoginPageProps {
  searchParams: Promise<{ error?: string | string[] }>;
}

/**
 * NextAuth sends provider failures here as ?error=... During a native app
 * sign-in, forward to the completion step, which reports the failure to the
 * app instead of leaving the sheet on the web form.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  if (error) {
    const store = await cookies();
    if (verifyPending(store.get(PENDING_COOKIE)?.value)) {
      redirect(COMPLETE_PATH);
    }
  }
  return <LoginForm initialError={Boolean(error)} />;
}
