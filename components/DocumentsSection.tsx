'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type DocumentSummary = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  source: string;
  driveWebViewUrl: string | null;
  ocrStatus: string;
  createdAt: string;
};

interface DocumentsSectionProps {
  personId: string;
  documents: DocumentSummary[];
  showUpload?: boolean;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return '📦';
  return '📎';
}

function getOcrStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-500 bg-green-500/10';
    case 'processing': return 'text-yellow-500 bg-yellow-500/10';
    case 'failed': return 'text-red-500 bg-red-500/10';
    case 'pending': return 'text-muted bg-surface';
    case 'skipped': return 'text-muted bg-surface';
    default: return 'text-muted bg-surface';
  }
}

export default function DocumentsSection({ personId, documents, showUpload }: DocumentsSectionProps) {
  const t = useTranslations('documents');
  const [uploading, setUploading] = useState(false);
  const [localDocs, setLocalDocs] = useState(documents);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/people/${personId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setLocalDocs((prev) => [data.data, ...prev]);
        }
        toast.success(t('uploadSuccess'));
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Upload failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          {t('title')}
        </h3>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-muted">
          {t('count', { count: localDocs.length })}
        </span>
      </div>

      {localDocs.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">{t('empty')}</p>
      ) : (
        <div className="space-y-2">
          {localDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg"
            >
              {/* File icon */}
              <span className="text-lg flex-shrink-0" role="img" aria-label={doc.mimeType}>
                {getFileIcon(doc.mimeType)}
              </span>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {doc.fileName}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {doc.fileSize && (
                    <span className="text-xs text-muted">
                      {formatFileSize(doc.fileSize)}
                    </span>
                  )}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                    doc.source === 'email_attachment' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'
                  }`}>
                    {doc.source === 'email_attachment' ? t('emailAttachment') : t('manualUpload')}
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getOcrStatusColor(doc.ocrStatus)}`}>
                    {t(`ocr${doc.ocrStatus.charAt(0).toUpperCase() + doc.ocrStatus.slice(1)}` as 'ocrPending' | 'ocrProcessing' | 'ocrCompleted' | 'ocrFailed' | 'ocrSkipped')}
                  </span>
                </div>
              </div>

              {/* View in Drive link */}
              {doc.driveWebViewUrl && (
                <a
                  href={doc.driveWebViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-primary hover:text-primary-dark transition-colors"
                  title={t('viewInDrive')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {showUpload && (
        <div
          className="mt-4 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          {uploading ? (
            <p className="text-sm text-muted">{t('uploading')}</p>
          ) : (
            <>
              <svg className="w-8 h-8 text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-muted">{t('uploadDescription')}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
