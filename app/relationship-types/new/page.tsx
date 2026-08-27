import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RelationshipTypeForm from '@/components/RelationshipTypeForm';
import Navigation from '@/components/Navigation';
import { getTranslations } from 'next-intl/server';
import { formatFullName } from '@/lib/nameUtils';
import { getUserDisplayPreferences } from '@/lib/user-preferences';

const PREVIEW_PEOPLE_LIMIT = 200;

export default async function NewRelationshipTypePage() {
  const session = await auth();
  const t = await getTranslations('relationshipTypes');

  if (!session?.user) {
    redirect('/login');
  }

  const { nameOrder, nameDisplayFormat } = await getUserDisplayPreferences(session.user.id);

  // Get all available types for inverse relationship selection
  const [availableTypes, groups, templates, people, genders] = await Promise.all([
    prisma.relationshipType.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        label: true,
        color: true,
        inverseId: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.group.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.customFieldTemplate.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, name: true, type: true, options: true },
      orderBy: { order: 'asc' },
    }),
    prisma.person.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        surname: true,
        middleName: true,
        secondLastName: true,
        nickname: true,
        displayNameOverride: true,
      },
      orderBy: { name: 'asc' },
      take: PREVIEW_PEOPLE_LIMIT,
    }),
    prisma.person.findMany({
      where: { userId: session.user.id, deletedAt: null, gender: { not: null } },
      select: { gender: true },
      distinct: ['gender'],
    }),
  ]);

  const previewPeople = people.map((person) => ({
    id: person.id,
    name: formatFullName(person, nameOrder, nameDisplayFormat),
  }));
  const genderSuggestions = genders
    .map((entry) => entry.gender)
    .filter((gender): gender is string => !!gender && gender.trim().length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/relationship-types"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href="/relationship-types"
              className="text-primary hover:underline text-sm"
            >
              {t('backToTypes')}
            </Link>
          </div>

          <div className="bg-surface shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-foreground mb-6">
              {t('createRelationshipType')}
            </h1>
            <RelationshipTypeForm
              availableTypes={availableTypes}
              mode="create"
              groups={groups}
              templates={templates}
              people={previewPeople}
              genderSuggestions={genderSuggestions}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
