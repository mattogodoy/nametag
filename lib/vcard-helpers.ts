/**
 * Client-side utilities for vCard export
 * Handles photo fetching, base64 encoding, and file downloads
 */

import { addPhotoToVCard } from './vcard';

export interface PhotoData {
  base64: string;
  mimeType: string;
}

export interface ExportProgress {
  current: number;
  total: number;
}

/**
 * Fetch photo from URL and convert to base64
 */
export async function fetchPhotoAsBase64(photoUrl: string): Promise<PhotoData> {
  // Check if already a data URI
  if (photoUrl.startsWith('data:')) {
    const match = photoUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      return {
        mimeType: match[1],
        base64: match[2],
      };
    }
  }

  // Fetch from URL
  const response = await fetch(photoUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch photo: ${response.statusText}`);
  }

  const blob = await response.blob();

  // Convert to base64 via FileReader
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read photo as data URL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  // Extract MIME type and base64 data
  const match = base64.match(/^data:(.*?);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid data URL format');
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

/**
 * Fetch photo from URL and add to vCard with proper base64 encoding and line folding
 */
export async function addPhotoToVCardFromUrl(
  vcard: string,
  photoUrl: string
): Promise<string> {
  try {
    const photoData = await fetchPhotoAsBase64(photoUrl);
    return addPhotoToVCard(vcard, photoData.base64, photoData.mimeType);
  } catch (error) {
    console.warn('Failed to encode photo for vCard:', error);
    // Return vCard without photo rather than failing entirely
    return vcard;
  }
}

/**
 * Generate safe filename for VCF export
 */
export function generateVcfFilename(name: string, date: Date = new Date()): string {
  // Sanitize name for filename
  const safeName = name
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();

  const timestamp = date.toISOString().split('T')[0];

  return `${safeName}_${timestamp}.vcf`;
}

/**
 * Generate filename for bulk export
 */
export function generateBulkVcfFilename(count: number, date: Date = new Date()): string {
  const timestamp = date.toISOString().split('T')[0];
  return `nametag_contacts_${count}_${timestamp}.vcf`;
}

/**
 * Trigger browser download of VCF file
 */
export function downloadVcf(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export multiple people with progress updates
 * Yields to UI thread between batches to keep interface responsive
 */
export async function exportPeopleWithProgress(
  vcards: string[],
  onProgress?: (progress: ExportProgress) => void
): Promise<string> {
  const BATCH_SIZE = 10;
  const processedVCards: string[] = [];

  for (let i = 0; i < vcards.length; i += BATCH_SIZE) {
    const batch = vcards.slice(i, i + BATCH_SIZE);
    processedVCards.push(...batch);

    // Update progress
    if (onProgress) {
      onProgress({
        current: Math.min(i + BATCH_SIZE, vcards.length),
        total: vcards.length,
      });
    }

    // Yield to UI thread
    if (i + BATCH_SIZE < vcards.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Join with blank line between vCards
  return processedVCards.join('\r\n');
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Estimate VCF file size for large exports
 */
export function estimateVcfSize(vcardCount: number, avgVcardSize: number = 2000): string {
  const bytes = vcardCount * avgVcardSize;

  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
