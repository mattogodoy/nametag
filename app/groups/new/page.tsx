import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import GroupForm from '@/components/GroupForm';
import Navigation from '@/components/Navigation';

export default async function NewGroupPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/groups"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold mb-6">
            Create New Group
          </h1>

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <GroupForm mode="create" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
