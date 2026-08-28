interface SettingsMessageProps {
  message: string | null;
  isSuccess: boolean;
  className?: string;
}

export default function SettingsMessage({ message, isSuccess, className = '' }: SettingsMessageProps) {
  if (!message) return null;

  return (
    <p
      className={`text-sm ${isSuccess ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'} ${className}`}
      role="status"
    >
      {message}
    </p>
  );
}
