import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Navigation from '@/components/Navigation';
import MapPageClient from '@/components/map/MapPageClient';

export default async function MapPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/map"
      />
      <main className="flex-1 flex flex-col">
        <MapPageClient />
      </main>
    </div>
  );
}
