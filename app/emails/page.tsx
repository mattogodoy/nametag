import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import EmailCenter from '@/components/EmailCenter';
import { getTranslations } from 'next-intl/server';

const PAGE_SIZE = 30;

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; filter?: string; personId?: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('emailCenter');

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const search = params.q?.trim() || '';
  const filter = params.filter || 'all';
  const personId = params.personId || '';
  const skip = (page - 1) * PAGE_SIZE;

  // Check if user has Google integration
  const integration = await prisma.googleIntegration.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  let emails: Array<{
    id: string;
    gmailThreadId: string;
    subject: string | null;
    snippet: string | null;
    fromEmail: string;
    fromName: string | null;
    toEmails: string[];
    date: Date;
    hasAttachments: boolean;
    isRead: boolean;
    people: Array<{
      role: string;
      person: { id: string; name: string; surname: string | null; photo: string | null };
    }>;
  }> = [];
  let totalCount = 0;

  if (integration) {
    // Build where clause
    const where: Record<string, unknown> = {
      integrationId: integration.id,
    };

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { fromName: { contains: search, mode: 'insensitive' } },
        { fromEmail: { contains: search, mode: 'insensitive' } },
        { snippet: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (personId) {
      where.people = { some: { personId } };
    }

    if (filter === 'unread') {
      where.isRead = false;
    } else if (filter === 'attachments') {
      where.hasAttachments = true;
    }

    [totalCount, emails] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.findMany({
        where,
        select: {
          id: true,
          gmailThreadId: true,
          subject: true,
          snippet: true,
          fromEmail: true,
          fromName: true,
          toEmails: true,
          date: true,
          hasAttachments: true,
          isRead: true,
          people: {
            select: {
              role: true,
              person: {
                select: { id: true, name: true, surname: true, photo: true },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
    ]);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const initialEmails = emails.map((email) => ({
    ...email,
    date: email.date.toISOString(),
    persons: email.people.map((p) => ({
      id: p.person.id,
      name: p.person.name,
      surname: p.person.surname,
      photo: p.person.photo,
      role: p.role,
    })),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/emails"
      />

      <main className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        {!integration ? (
          <div className="bg-surface shadow rounded-lg p-12 text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">{t('title')}</h2>
            <p className="text-muted mb-4">{t('noIntegration')}</p>
            <a
              href="/settings/integrations"
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark transition-colors"
            >
              {t('connectGoogle')}
            </a>
          </div>
        ) : (
          <EmailCenter
            initialEmails={initialEmails}
            initialPagination={{ page, pageSize: PAGE_SIZE, totalCount, totalPages }}
            initialFilter={filter}
            initialSearch={search}
            initialPersonId={personId}
          />
        )}
      </main>
    </div>
  );
}
