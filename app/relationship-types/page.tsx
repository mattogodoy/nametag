import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import EmptyState from '@/components/EmptyState';
import DeleteRelationshipTypeButton from '@/components/DeleteRelationshipTypeButton';

export default async function RelationshipTypesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const relationshipTypes = await prisma.relationshipType.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      inverse: {
        select: {
          id: true,
          name: true,
          label: true,
        },
      },
      _count: {
        select: {
          relationships: true,
          peopleWithRelation: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Calculate total usage count (person-to-person + user-to-person relationships)
  const relationshipTypesWithUsage = relationshipTypes.map((type) => ({
    ...type,
    totalUsageCount: type._count.relationships + type._count.peopleWithRelation,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/relationship-types"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              Relationship Types
            </h1>
            <Link
              href="/relationship-types/new"
              className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50"
            >
              Create New Type
            </Link>
          </div>

          {relationshipTypesWithUsage.length > 0 ? (
            <div className="bg-surface shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-surface-elevated">
                  <tr>
                    <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Color
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Relationship
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Inverse Relationship
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-gray-200 dark:divide-gray-700">
                  {relationshipTypesWithUsage.map((type) => (
                    <tr key={type.id} className="hover:bg-surface-elevated">
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: type.color || '#3B82F6' }}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">
                          {type.label}
                        </div>
                        <div className="text-xs text-muted">
                          Used {type.totalUsageCount} time(s)
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                        {type.inverse ? (
                          <span className="text-sm text-foreground">
                            {type.inverse.label}
                          </span>
                        ) : (
                          <span className="text-sm text-muted">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-3">
                          <Link
                            href={`/relationship-types/${type.id}/edit`}
                            className="text-primary hover:text-primary-dark transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <DeleteRelationshipTypeButton
                            relationshipTypeId={type.id}
                            relationshipTypeName={type.label}
                            usageCount={type.totalUsageCount}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-surface shadow rounded-lg">
              <EmptyState
                icon={
                  <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-lg inline-block">
                    <svg className="w-12 h-12 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                }
                title="No relationship types"
                description="Create relationship types to categorize the connections in your network."
                actionLabel="Create Relationship Type"
                actionHref="/relationship-types/new"
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
