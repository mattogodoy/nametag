import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PersonForm from '@/components/PersonForm';
import Navigation from '@/components/Navigation';
import { formatFullName } from '@/lib/nameUtils';

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [person, groups, relationshipTypes] = await Promise.all([
    prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        groups: true,
        relationshipToUser: true,
        importantDates: {
          orderBy: {
            date: 'asc',
          },
        },
      },
    }),
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
        OR: [{ userId: session.user.id }, { isDefault: true }],
      },
      orderBy: {
        label: 'asc',
      },
    }),
  ]);

  if (!person) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/people"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href={`/people/${person.id}`}
              className="link link-primary text-sm flex items-center gap-1"
            >
              <span className="icon-[tabler--arrow-left] size-4" />
              Back to {formatFullName(person)}
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-6">
            Edit {formatFullName(person)}
          </h1>

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <PersonForm person={person} groups={groups} relationshipTypes={relationshipTypes} mode="edit" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
