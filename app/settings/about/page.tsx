import { getVersion, isPreRelease } from '@/lib/version';
import { isSaasMode } from '@/lib/features';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About - Settings',
  description: 'Version information and details about NameTag',
};

export default function AboutPage() {
  const version = getVersion();
  const isPre = isPreRelease();
  const showSupportDevelopment = !isSaasMode();

  return (
    <div className="space-y-6">
      {/* App Information */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          About NameTag
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-muted">Version</span>
            <span className="font-mono font-medium text-foreground">
              v{version}
              {isPre && (
                <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">
                  (pre-release)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-muted">License</span>
            <span className="text-foreground">AGPL-3.0</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-muted">Repository</span>
            <a
              href="https://github.com/mattogodoy/nametag"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              GitHub →
            </a>
          </div>
        </div>
      </div>

      {/* Release Information */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">
          Release Information
        </h3>

        <div className="space-y-3">
          <p className="text-sm text-muted">
            View the full changelog and release notes on GitHub:
          </p>

          <div className="space-y-2">
            <a
              href={`https://github.com/mattogodoy/nametag/releases/tag/v${version}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Release notes for v{version}
            </a>

            <br />

            <a
              href="https://github.com/mattogodoy/nametag/blob/master/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Full changelog
            </a>
          </div>
        </div>
      </div>

      {/* Open Source */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">
          Open Source
        </h3>

        <p className="text-sm text-muted mb-4">
          NameTag is open source software licensed under AGPL-3.0. This means you can:
        </p>

        <ul className="space-y-2 text-sm text-muted">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>View and modify the source code</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Self-host your own instance</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Contribute improvements back to the community</span>
          </li>
        </ul>

        <div className="mt-4 pt-4 border-t border-border">
          <a
            href="https://github.com/mattogodoy/nametag/blob/master/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Learn how to contribute →
          </a>
        </div>
      </div>

      {/* Support */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">
          Support
        </h3>

        <div className="space-y-3 text-sm text-muted">
          <p>
            Found a bug or have a feature request?{' '}
            <a
              href="https://github.com/mattogodoy/nametag/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Open an issue on GitHub
            </a>
          </p>

          <p>
            Need help with self-hosting?{' '}
            <a
              href="https://github.com/mattogodoy/nametag/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Start a discussion
            </a>
          </p>

          <p>
            Security issue?{' '}
            <a
              href="https://github.com/mattogodoy/nametag/blob/master/SECURITY.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              See security policy
            </a>
          </p>
        </div>
      </div>

      {/* Support Development - Only show in self-hosted mode */}
      {showSupportDevelopment && (
        <div className="bg-surface shadow rounded-lg p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">
            Support Development
          </h3>

          <div className="space-y-4">
            <p className="text-sm text-muted">
              If you find NameTag useful and want to support its development, you can buy me a coffee! ☕
            </p>

            <a
              href="https://www.buymeacoffee.com/mattogodoy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img
                src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                alt="Buy Me A Coffee"
                className="h-[60px] w-[217px]"
              />
            </a>

            <p className="text-xs text-gray-500 dark:text-gray-500">
              Your support helps keep this project alive and continuously improving!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
