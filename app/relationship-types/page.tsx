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
      OR: [
        { userId: null }, // Default types
        { userId: session.user.id }, // User's custom types
      ],
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
        },
      },
    },
    orderBy: [
      { isDefault: 'desc' },
      { name: 'asc' },
    ],
  });

  const defaultTypes = relationshipTypes.filter((type) => type.isDefault);
  const customTypes = relationshipTypes.filter((type) => !type.isDefault);

  return (
    <div className="min-h-screen bg-base-200">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/relationship-types"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">
              Relationship Types
            </h1>
            <Link
              href="/relationship-types/new"
              className="btn btn-primary"
            >
              <span className="icon-[tabler--plus] size-5" />
              Create Custom Type
            </Link>
          </div>

          {/* Default Types Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              Default Types
            </h2>
            <div className="card bg-base-100 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="hidden sm:table-cell">Color</th>
                      <th>Relationship</th>
                      <th className="hidden md:table-cell">Inverse Relationship</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defaultTypes.map((type) => (
                      <tr key={type.id} className="hover">
                        <td className="hidden sm:table-cell">
                          <div
                            className="w-8 h-8 rounded"
                            style={{ backgroundColor: type.color || '#3B82F6' }}
                          />
                        </td>
                        <td>
                          <div className="font-medium">
                            {type.label}
                          </div>
                          <div className="text-xs text-base-content/60">
                            Used {type._count.relationships} time(s)
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          {type.inverse ? (
                            <span>{type.inverse.label}</span>
                          ) : (
                            <span className="text-base-content/40">—</span>
                          )}
                        </td>
                        <td className="text-right">
                          <span className="badge badge-ghost">Default</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Custom Types Section */}
          {customTypes.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Custom Types
              </h2>
              <div className="card bg-base-100 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="hidden sm:table-cell">Color</th>
                        <th>Relationship</th>
                        <th className="hidden md:table-cell">Inverse Relationship</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customTypes.map((type) => (
                        <tr key={type.id} className="hover">
                          <td className="hidden sm:table-cell">
                            <div
                              className="w-8 h-8 rounded"
                              style={{ backgroundColor: type.color || '#3B82F6' }}
                            />
                          </td>
                          <td>
                            <div className="font-medium">
                              {type.label}
                            </div>
                            <div className="text-xs text-base-content/60">
                              Used {type._count.relationships} time(s)
                            </div>
                          </td>
                          <td className="hidden md:table-cell">
                            {type.inverse ? (
                              <span>{type.inverse.label}</span>
                            ) : (
                              <span className="text-base-content/40">—</span>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-1">
                              <Link
                                href={`/relationship-types/${type.id}/edit`}
                                className="btn btn-ghost btn-square btn-sm"
                                title="Edit"
                              >
                                <span className="icon-[tabler--edit] size-4" />
                              </Link>
                              <DeleteRelationshipTypeButton
                                relationshipTypeId={type.id}
                                relationshipTypeName={type.label}
                                usageCount={type._count.relationships}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {customTypes.length === 0 && (
            <div className="card bg-base-100 shadow-lg">
              <EmptyState
                icon={
                  <div className="p-4 bg-secondary/20 rounded-lg inline-block">
                    <span className="icon-[tabler--link] size-12 text-secondary" />
                  </div>
                }
                title="No custom relationship types"
                description="You're using the default relationship types. Create custom types to better represent the unique connections in your network."
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
