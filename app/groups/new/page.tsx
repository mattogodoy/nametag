import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import GroupForm from '@/components/GroupForm';
import Navigation from '@/components/Navigation';
import LimitReachedMessage from '@/components/LimitReachedMessage';
import { canCreateResource } from '@/lib/billing/subscription';
import { TIER_INFO } from '@/lib/billing/constants';

export default async function NewGroupPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user can create more groups
  const usageCheck = await canCreateResource(session.user.id, 'groups');
  const tierName = TIER_INFO[usageCheck.tier].name;

  // Fetch available people to add to the group
  const availablePeople = await prisma.person.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      surname: true,
      nickname: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/groups"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-foreground mb-6">
            Create New Group
          </h1>

          {!usageCheck.allowed ? (
            <LimitReachedMessage
              resourceType="groups"
              current={usageCheck.current}
              limit={usageCheck.limit}
              tier={tierName}
            />
          ) : (
            <div className="bg-surface shadow rounded-lg p-6">
              <GroupForm mode="create" availablePeople={availablePeople} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
