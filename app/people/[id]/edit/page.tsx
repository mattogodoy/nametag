import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PersonForm from '@/components/PersonForm';
import Navigation from '@/components/Navigation';
import { formatGraphName } from '@/lib/nameUtils';
import { canEnableReminder } from '@/lib/billing/subscription';
import { getTranslations } from 'next-intl/server';
import { getUserDisplayPreferences } from '@/lib/user-preferences';

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('people');

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [person, groups, relationshipTypes, reminderCheck, preferences, cardDavConnection, customFieldTemplates, notificationPreferences] = await Promise.all([
    prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        groups: true,
        relationshipToUser: true,
        importantDates: {
          where: { deletedAt: null },
          orderBy: {
            date: 'asc',
          },
        },
        phoneNumbers: true,
        emails: true,
        addresses: true,
        urls: true,
        cardDavMapping: {
          select: { id: true },
        },
        customFieldValues: {
          where: { template: { deletedAt: null } },
          select: { templateId: true, value: true },
        },
      },
    }),
    prisma.group.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.relationshipType.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      orderBy: {
        label: 'asc',
      },
    }),
    canEnableReminder(session.user.id),
    getUserDisplayPreferences(session.user.id),
    prisma.cardDavConnection.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    }),
    prisma.customFieldTemplate.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    }),
    // select is an allowlist: only this column can ever reach this page, so
    // the password hash and other sensitive columns never enter process
    // memory for this request in the first place.
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { defaultReminderLeadDays: true },
    }),
  ]);

  if (!person) {
    notFound();
  }

  // Convert Prisma Decimal objects to plain numbers for client components
  const serializedPerson = {
    ...person,
    addresses: person.addresses.map((address) => ({
      ...address,
      latitude: address.latitude === null ? null : Number(address.latitude),
      longitude: address.longitude === null ? null : Number(address.longitude),
    })),
  };

  const { dateFormat, nameOrder, nameDisplayFormat } = preferences;

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/people"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href={`/people/${person.id}`}
              className="text-primary hover:underline text-sm"
            >
              {t('backToPerson', { name: formatGraphName(person, nameOrder, nameDisplayFormat) })}
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-6">
            {t('editPerson', { name: formatGraphName(person, nameOrder, nameDisplayFormat) })}
          </h1>

          <div className="bg-surface shadow rounded-lg p-6">
            <PersonForm
              person={serializedPerson}
              customFieldTemplates={customFieldTemplates}
              groups={groups}
              relationshipTypes={relationshipTypes}
              mode="edit"
              dateFormat={dateFormat}
              hasCardDavConnection={!!cardDavConnection}
              nameOrder={nameOrder}
              defaultReminderLeadDays={notificationPreferences?.defaultReminderLeadDays ?? 0}
              reminderLimit={{
                canCreate: reminderCheck.allowed,
                current: reminderCheck.current,
                limit: reminderCheck.limit,
                isUnlimited: reminderCheck.isUnlimited,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
