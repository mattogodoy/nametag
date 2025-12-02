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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        currentPath="/groups"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Create New Group
          </h1>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <GroupForm mode="create" />
          </div>
        </div>
      </main>
    </div>
  );
}
