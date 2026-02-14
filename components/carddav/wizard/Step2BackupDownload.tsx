'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import type { WizardData } from './Step1ServerConfig';

interface Step2BackupDownloadProps {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2BackupDownload({
  data,
  onUpdate,
  onNext,
  onBack,
}: Step2BackupDownloadProps) {
  const tw = useTranslations('settings.carddav.wizard');

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadResult, setDownloadResult] = useState<'success' | 'empty' | 'error' | null>(null);

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    setDownloadResult(null);

    try {
      const response = await fetch('/api/carddav/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: data.serverUrl,
          username: data.username,
          password: data.password,
        }),
      });

      if (!response.ok) {
        setDownloadResult('error');
        return;
      }

      const contactCount = parseInt(response.headers.get('X-Contact-Count') || '0', 10);

      if (contactCount === 0) {
        setDownloadResult('empty');
        onUpdate({ backupDownloaded: true });
        return;
      }

      const blob = await response.blob();
      const date = new Date().toISOString().split('T')[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nametag-backup-${date}.vcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadResult('success');
      onUpdate({ backupDownloaded: true });
    } catch {
      setDownloadResult('error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">
          {tw('backupWarningTitle')}
        </h3>
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {tw('backupWarningMessage')}
        </p>
      </div>

      {/* Download button */}
      <div className="flex flex-col items-center gap-4 py-4">
        <Button
          type="button"
          onClick={handleDownloadBackup}
          disabled={isDownloading}
          size="lg"
          className="bg-gray-600 text-white hover:bg-gray-700 border-0"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {isDownloading ? tw('backupDownloading') : tw('backupButton')}
        </Button>
      </div>

      {/* Result messages */}
      {downloadResult === 'success' && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {'\u2713'} {tw('backupComplete')}
          </p>
        </div>
      )}

      {downloadResult === 'empty' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {tw('backupEmptyMessage')}
          </p>
        </div>
      )}

      {downloadResult === 'error' && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {'\u2717'} {tw('backupFailed')}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between pt-4 border-t border-border">
        <Button type="button" onClick={onBack} variant="secondary">
          {tw('back')}
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!data.backupDownloaded}
        >
          {tw('next')}
        </Button>
      </div>
    </div>
  );
}
