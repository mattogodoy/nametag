import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        currentPath="/relationship-types"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Relationship Types
            </h1>
            <Link
              href="/relationship-types/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create Custom Type
            </Link>
          </div>

          {/* Default Types Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Default Types
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {defaultTypes.map((type) => (
                <div
                  key={type.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4"
                  style={{ borderLeftColor: type.color || '#3B82F6' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {type.label}
                      </h3>
                      {type.inverse && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                          Inverse: {type.inverse.label}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Used {type._count.relationships} time(s)
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Types Section */}
          {customTypes.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Custom Types
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customTypes.map((type) => (
                  <div
                    key={type.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4"
                    style={{ borderLeftColor: type.color || '#3B82F6' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {type.label}
                        </h3>
                        {type.inverse && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                            Inverse: {type.inverse.label}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Used {type._count.relationships} time(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-4">
                      <Link
                        href={`/relationship-types/${type.id}/edit`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {customTypes.length === 0 && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                No custom relationship types yet. Create one to get started!
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
