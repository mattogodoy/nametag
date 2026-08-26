import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Navigation from '@/components/Navigation';
import MergeClient from './MergeClient';

export default async function MergePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/people/merge"
      />
      <MergeClient />
    </div>
  );
}
