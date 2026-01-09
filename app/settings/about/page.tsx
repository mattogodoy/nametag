import { getVersion, isPreRelease } from '@/lib/version';
import { isSaasMode } from '@/lib/features';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'About - Settings',
  description: 'Version information and details about Nametag',
};

export default async function AboutPage() {
  const t = await getTranslations('settings.about');
  const version = getVersion();
  const isPre = isPreRelease();
  const showSupportDevelopment = !isSaasMode();

  return (
    <div className="space-y-6">
      {/* App Information */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('aboutNametag')}
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-muted">{t('version')}</span>
            <span className="font-mono font-medium text-foreground">
              v{version}
              {isPre && (
                <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">
                  {t('preRelease')}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-muted">{t('license')}</span>
            <span className="text-foreground">AGPL-3.0</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-muted">{t('repository')}</span>
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
          {t('releaseInformation')}
        </h3>

        <div className="space-y-3">
          <p className="text-sm text-muted">
            {t('viewChangelog')}
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
              {t('releaseNotes', { version })}
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
              {t('fullChangelog')}
            </a>
          </div>
        </div>
      </div>

      {/* Open Source */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">
          {t('openSource')}
        </h3>

        <p className="text-sm text-muted mb-4">
          {t('openSourceDescription')}
        </p>

        <ul className="space-y-2 text-sm text-muted">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{t('viewAndModify')}</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{t('selfHost')}</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{t('contributeBack')}</span>
          </li>
        </ul>

        <div className="mt-4 pt-4 border-t border-border">
          <a
            href="https://github.com/mattogodoy/nametag/blob/master/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t('learnToContribute')}
          </a>
        </div>
      </div>

      {/* Support */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">
          {t('support')}
        </h3>

        <div className="space-y-3 text-sm text-muted">
          <p>
            {t('foundBug')}{' '}
            <a
              href="https://github.com/mattogodoy/nametag/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {t('openIssue')}
            </a>
          </p>

          <p>
            {t('needHelp')}{' '}
            <a
              href="https://github.com/mattogodoy/nametag/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {t('startDiscussion')}
            </a>
          </p>

          <p>
            {t('securityIssue')}{' '}
            <a
              href="https://github.com/mattogodoy/nametag/blob/master/SECURITY.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {t('seeSecurityPolicy')}
            </a>
          </p>
        </div>
      </div>

      {/* Support Development - Only show in self-hosted mode */}
      {showSupportDevelopment && (
        <div className="bg-surface shadow rounded-lg p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">
            {t('supportDevelopment')}
          </h3>

          <div className="space-y-4">
            <p className="text-sm text-muted">
              {t('supportMessage')}
            </p>

            <a
              href="https://www.buymeacoffee.com/mattogodoy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                alt="Buy Me A Coffee"
                className="h-[60px] w-[217px]"
              />
            </a>

            <p className="text-xs text-gray-500 dark:text-gray-500">
              {t('supportNote')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
