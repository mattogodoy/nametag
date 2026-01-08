import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AccountManagement from '@/components/AccountManagement';
import { prisma } from '@/lib/prisma';

export default async function AccountSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const [groups, peopleCount] = await Promise.all([
    prisma.group.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.person.count({
      where: { userId: session.user.id },
    }),
  ]);

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-foreground mb-4">
        Account Management
      </h2>
      <p className="text-muted mb-6">
        Export your data, import from a backup, or delete your account.
      </p>
      <AccountManagement groups={groups} peopleCount={peopleCount} />
    </div>
  );
}
