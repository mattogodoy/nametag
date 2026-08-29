export default function TooltipIcon({ tooltip }: { tooltip: string }) {
  return (
    <div className="group relative inline-block">
      <svg
        className="w-4 h-4 text-muted cursor-help"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-surface-elevated text-foreground text-xs rounded-lg z-10 pointer-events-none w-max max-w-[min(280px,90vw)]">
        {tooltip}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-elevated"></div>
      </div>
    </div>
  );
}
