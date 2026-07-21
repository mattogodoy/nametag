const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXTENSIONS = ['.heic', '.heif'];

export function isHeicFile(file: File): boolean {
  if (HEIC_MIME_TYPES.includes(file.type.toLowerCase())) {
    return true;
  }
  if (!file.type || file.type === 'application/octet-stream') {
    const name = file.name.toLowerCase();
    return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
  }
  return false;
}

export async function convertHeicToJpeg(file: File): Promise<Blob> {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch('/api/photos/convert', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    const message = body?.error || 'Conversion failed';
    throw new Error(message);
  }

  return response.blob();
}
