'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDateFormatExample } from '@/lib/date-format';

interface DateFormatSelectorProps {
  userId: string;
  currentFormat: 'MDY' | 'DMY' | 'YMD';
}

export default function DateFormatSelector({ userId, currentFormat }: DateFormatSelectorProps) {
  const router = useRouter();
  const [dateFormat, setDateFormat] = useState(currentFormat);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const formats: Array<{ value: 'MDY' | 'DMY' | 'YMD'; label: string }> = [
    { value: 'MDY', label: 'MM/DD/YYYY' },
    { value: 'DMY', label: 'DD/MM/YYYY' },
    { value: 'YMD', label: 'YYYY-MM-DD' },
  ];

  const handleFormatChange = async (newFormat: 'MDY' | 'DMY' | 'YMD') => {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/user/date-format', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dateFormat: newFormat }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Failed to update date format');
        return;
      }

      setDateFormat(newFormat);
      setMessage('Date format updated successfully');
      router.refresh();

      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      setMessage('Failed to update date format');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-base-content/60 mb-4">
        Choose how dates are displayed throughout the app
      </p>

      <div className="space-y-3">
        {formats.map((format) => (
          <button
            key={format.value}
            onClick={() => handleFormatChange(format.value)}
            disabled={isLoading}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              dateFormat === format.value
                ? 'border-primary bg-primary/10'
                : 'border-base-content/20 hover:border-primary/50'
            } disabled:opacity-50`}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">
                  {format.label}
                </div>
                <div className="text-sm text-base-content/60">
                  Example: {getDateFormatExample(format.value)}
                </div>
              </div>
              {dateFormat === format.value && (
                <span className="icon-[tabler--circle-check-filled] size-6 text-primary" />
              )}
            </div>
          </button>
        ))}
      </div>

      {message && (
        <div className={`mt-4 text-sm ${message.includes('success') ? 'text-success' : 'text-error'}`}>
          {message}
        </div>
      )}
    </div>
  );
}
