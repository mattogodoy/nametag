import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PersonForm from '@/components/PersonForm';
import Navigation from '@/components/Navigation';
import LimitReachedMessage from '@/components/LimitReachedMessage';
import { canCreateResource, canEnableReminder } from '@/lib/billing/subscription';
import { TIER_INFO } from '@/lib/billing/constants';

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; knownThrough?: string; relationshipType?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  // Check if user can create more people and reminders
  const [usageCheck, reminderCheck] = await Promise.all([
    canCreateResource(session.user.id, 'people'),
    canEnableReminder(session.user.id),
  ]);

  const [groups, relationshipTypes, people] = await Promise.all([
    prisma.group.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.relationshipType.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        label: 'asc',
      },
    }),
    prisma.person.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
        groups: {
          select: {
            groupId: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    }),
  ]);

  const tierName = TIER_INFO[usageCheck.tier].name;

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/people"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-foreground mb-6">
            Add New Person
          </h1>

          {!usageCheck.allowed ? (
            <LimitReachedMessage
              resourceType="people"
              current={usageCheck.current}
              limit={usageCheck.limit}
              tier={tierName}
            />
          ) : (
            <div className="bg-surface shadow rounded-lg p-6">
              <PersonForm
                groups={groups}
                relationshipTypes={relationshipTypes}
                availablePeople={people}
                userName={session.user.name || session.user.email || 'You'}
                mode="create"
                initialName={params.name}
                initialKnownThrough={params.knownThrough}
                initialRelationshipType={params.relationshipType}
                reminderLimit={{
                  canCreate: reminderCheck.allowed,
                  current: reminderCheck.current,
                  limit: reminderCheck.limit,
                  isUnlimited: reminderCheck.isUnlimited,
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
