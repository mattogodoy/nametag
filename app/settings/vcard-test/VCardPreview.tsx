'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ParsedVCardDataEnhanced } from '@/lib/carddav/vcard-parser';

interface VCardPreviewProps {
  parsedData: ParsedVCardDataEnhanced;
}

export default function VCardPreview({ parsedData }: VCardPreviewProps) {
  const t = useTranslations('settings.vcardTest');

  return (
    <div className="space-y-6">
      {/* Parsed Data Section */}
      <div className="bg-surface shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{t('parsedTitle')}</h2>
              <p className="text-sm text-muted mt-1">{t('parsedDescription')}</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">{t('version')}:</span>
              <span className="font-mono font-semibold text-foreground">
                {parsedData.version}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Identity */}
          <Section title={t('preview.identity')}>
            <Field label="Full Name" value={parsedData.name} />
            <Field label="Surname" value={parsedData.surname} />
            <Field label="Middle Name" value={parsedData.middleName} />
            <Field label="Prefix" value={parsedData.prefix} />
            <Field label="Suffix" value={parsedData.suffix} />
            <Field label="Nickname" value={parsedData.nickname} />
            <Field label="UID" value={parsedData.uid} mono />
          </Section>

          {/* Professional */}
          {(parsedData.organization || parsedData.jobTitle) && (
            <Section title={t('preview.professional')}>
              <Field label="Organization" value={parsedData.organization} />
              <Field label="Job Title" value={parsedData.jobTitle} />
            </Section>
          )}

          {/* Phone Numbers */}
          {parsedData.phoneNumbers.length > 0 && (
            <Section title={t('preview.phones')}>
              {parsedData.phoneNumbers.map((phone, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded uppercase">
                    {phone.type}
                  </span>
                  <span className="text-sm text-foreground font-mono">{phone.number}</span>
                </div>
              ))}
            </Section>
          )}

          {/* Email Addresses */}
          {parsedData.emails.length > 0 && (
            <Section title={t('preview.emails')}>
              {parsedData.emails.map((email, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded uppercase">
                    {email.type}
                  </span>
                  <span className="text-sm text-foreground font-mono">{email.email}</span>
                </div>
              ))}
            </Section>
          )}

          {/* Addresses */}
          {parsedData.addresses.length > 0 && (
            <Section title={t('preview.addresses')}>
              {parsedData.addresses.map((addr, idx) => (
                <div key={idx} className="space-y-1">
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded uppercase">
                    {addr.type}
                  </span>
                  <div className="text-sm text-muted pl-3">
                    {addr.streetLine1 && <div>{addr.streetLine1}</div>}
                    {addr.streetLine2 && <div>{addr.streetLine2}</div>}
                    <div>
                      {[addr.locality, addr.region, addr.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                    {addr.country && <div>{addr.country}</div>}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* URLs */}
          {parsedData.urls.length > 0 && (
            <Section title={t('preview.urls')}>
              {parsedData.urls.map((url, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded uppercase">
                    {url.type}
                  </span>
                  <a
                    href={url.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-mono"
                  >
                    {url.url}
                  </a>
                </div>
              ))}
            </Section>
          )}

          {/* IM Handles */}
          {parsedData.imHandles.length > 0 && (
            <Section title={t('preview.imHandles')}>
              {parsedData.imHandles.map((im, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 px-2 py-1 rounded uppercase">
                    {im.protocol}
                  </span>
                  <span className="text-sm text-foreground font-mono">{im.handle}</span>
                </div>
              ))}
            </Section>
          )}

          {/* Locations */}
          {parsedData.locations.length > 0 && (
            <Section title={t('preview.locations')}>
              {parsedData.locations.map((loc, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-xs font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/30 px-2 py-1 rounded uppercase">
                    {loc.type}
                  </span>
                  <span className="text-sm text-foreground font-mono">
                    {loc.latitude}, {loc.longitude}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {/* Important Dates */}
          {parsedData.importantDates.length > 0 && (
            <Section title={t('preview.dates')}>
              {parsedData.importantDates.map((date, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 px-2 py-1 rounded">
                    {date.title}
                  </span>
                  <span className="text-sm text-foreground">
                    {date.date.toLocaleDateString()}
                  </span>
                </div>
              ))}
              {parsedData.lastContact && (
                <div className="flex items-start gap-3">
                  <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 px-2 py-1 rounded">
                    Last Contact
                  </span>
                  <span className="text-sm text-foreground">
                    {parsedData.lastContact.toLocaleDateString()}
                  </span>
                </div>
              )}
            </Section>
          )}

          {/* Other Information */}
          {(parsedData.photo || parsedData.gender || parsedData.notes) && (
            <Section title={t('preview.other')}>
              {parsedData.photo && (
                <PhotoField photo={parsedData.photo} />
              )}
              <Field label="Gender" value={parsedData.gender} />
              {parsedData.notes && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted uppercase">Notes</span>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 text-sm text-foreground whitespace-pre-wrap">
                    {parsedData.notes}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Groups/Categories */}
          {parsedData.categories.length > 0 && (
            <Section title={t('preview.groups')}>
              <div className="flex flex-wrap gap-2">
                {parsedData.categories.map((category, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Custom Fields */}
          {parsedData.customFields.length > 0 && (
            <Section title={t('preview.customFields')}>
              {parsedData.customFields.map((field, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted uppercase font-mono">
                      {field.key}
                    </span>
                    {field.type && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                        {field.type}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-foreground pl-3">{field.value}</div>
                </div>
              ))}
            </Section>
          )}
        </div>
      </div>

      {/* Unknown Properties Section */}
      <div className="bg-surface shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-foreground">{t('unknownTitle')}</h2>
          <p className="text-sm text-muted mt-1">{t('unknownDescription')}</p>
        </div>

        <div className="p-6">
          {parsedData.unknownProperties.length === 0 ? (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-green-500 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="mt-4 text-sm font-medium text-green-600 dark:text-green-400">
                {t('noUnknown')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {parsedData.unknownProperties.map((prop, idx) => (
                <div
                  key={idx}
                  className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3"
                >
                  <div className="flex items-start gap-2">
                    <svg
                      className="h-5 w-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {prop.group && (
                          <span className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-300">
                            {prop.group}.
                          </span>
                        )}
                        <span className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-300">
                          {prop.key}
                        </span>
                        {Object.entries(prop.params).map(([key, value]) => (
                          <span
                            key={key}
                            className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded"
                          >
                            {key}={Array.isArray(value) ? value.join(',') : value}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 text-sm text-amber-800 dark:text-amber-200 break-all">
                        {prop.value}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PhotoFieldProps {
  photo: string;
}

function PhotoField({ photo }: PhotoFieldProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Check if it's a data URI (embedded image)
  const isDataUri = photo.startsWith('data:');
  const isUrl = photo.startsWith('http://') || photo.startsWith('https://');

  // Extract info for data URIs
  let photoDisplayText = photo;
  let photoMetadata = '';

  if (isDataUri) {
    // Extract mime type and calculate size
    const match = photo.match(/^data:([^;]+);base64,(.*)$/);
    if (match) {
      const mimeType = match[1];
      const base64Data = match[2];
      const sizeInBytes = (base64Data.length * 3) / 4; // Approximate size
      const sizeInKB = (sizeInBytes / 1024).toFixed(1);

      photoDisplayText = 'Embedded image (data URI)';
      photoMetadata = `${mimeType}, ~${sizeInKB} KB`;
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted uppercase">Photo</span>
      <div className="flex items-start gap-3">
        {!imageError && (
          <div className="relative w-16 h-16 flex-shrink-0">
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
            <img
              src={photo}
              alt="Contact photo"
              className={`w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </div>
        )}
        {imageError && (
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border border-gray-200 dark:border-gray-700 flex-shrink-0">
            <svg
              className="w-8 h-8 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-foreground font-mono break-all">
            {photoDisplayText}
          </div>
          {photoMetadata && (
            <div className="mt-1 text-xs text-muted">
              {photoMetadata}
            </div>
          )}
          {imageError && (
            <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Image failed to load
              {isUrl && ' (may require authentication or CORS)'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2">
        {title}
      </h3>
      <div className="space-y-3 pl-2">{children}</div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value?: string;
  mono?: boolean;
  truncate?: boolean;
}

function Field({ label, value, mono = false, truncate = false }: FieldProps) {
  if (!value) return null;

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted uppercase">{label}</span>
      <div
        className={`text-sm text-foreground ${mono ? 'font-mono' : ''} ${
          truncate ? 'truncate' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}
