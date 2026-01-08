import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ProfileForm from '@/components/ProfileForm';

export default async function ProfileSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-foreground mb-4">
        Profile
      </h2>
      <p className="text-muted mb-6">
        Manage your personal information and how others see you.
      </p>
      <ProfileForm
        userId={session.user.id}
        currentName={session.user.name || ''}
        currentSurname={session.user.surname || ''}
        currentNickname={session.user.nickname || ''}
        currentEmail={session.user.email || ''}
      />
    </div>
  );
}
