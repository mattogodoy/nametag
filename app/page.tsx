import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-4xl w-full text-center">
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.svg"
            alt="NameTag Logo"
            width={192}
            height={192}
            priority
          />
        </div>
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
          NameTag
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
          Never forget a name again
        </p>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
          Your personal relationships manager. Track people, their connections, and important details.
          Visualize your network and stay connected with the people who matter.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-semibold border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-blue-600 dark:text-blue-400 text-3xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Manage People
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Keep track of everyone in your network with detailed profiles and notes.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-green-600 dark:text-green-400 text-3xl mb-4">🔗</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Track Relationships
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Map connections between people and understand your network structure.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-purple-600 dark:text-purple-400 text-3xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Visualize Networks
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              See your relationships in interactive network graphs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
