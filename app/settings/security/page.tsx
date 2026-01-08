import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PasswordChangeForm from '@/components/PasswordChangeForm';

export default async function SecuritySettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-foreground mb-4">
        Password
      </h2>
      <p className="text-muted mb-6">
        Update your password to keep your account secure.
      </p>
      <PasswordChangeForm userId={session.user.id} />
    </div>
  );
}
