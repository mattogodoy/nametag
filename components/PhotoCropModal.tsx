'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface PhotoCropModalProps {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

// Server stores the photo at 256x256; 512 gives 2x headroom for retina displays
// while keeping the upload payload small regardless of source resolution.
const OUTPUT_SIZE = 512;
const JPEG_QUALITY = 0.92;

function canvasHasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

// imageSrc must be a same-origin data URL or blob URL — the alpha scan below
// uses getImageData(), which throws SecurityError on cross-origin tainted canvases.
async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      );
      // Output JPEG by default for compact uploads; only fall back to PNG when
      // the source actually has transparency (server does not need to convert).
      const hasAlpha = canvasHasAlpha(ctx, OUTPUT_SIZE, OUTPUT_SIZE);
      const mimeType = hasAlpha ? 'image/png' : 'image/jpeg';
      const quality = hasAlpha ? undefined : JPEG_QUALITY;
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        mimeType,
        quality
      );
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = imageSrc;
  });
}

export default function PhotoCropModal({ imageSrc, onConfirm, onCancel }: PhotoCropModalProps) {
  const t = useTranslations('people.photo');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } catch {
      toast.error(t('uploadError'));
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 pb-[env(safe-area-inset-bottom)]">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{t('cropTitle')}</h2>
        </div>

        <div className="relative h-80 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={5}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-4 py-3">
          <label className="block text-sm font-medium text-muted mb-1">
            {t('zoom')}
          </label>
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-foreground bg-surface-elevated border border-border rounded-md hover:bg-surface-hover disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || !croppedAreaPixels}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-hover disabled:opacity-50"
          >
            {isProcessing ? t('processing') : t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
