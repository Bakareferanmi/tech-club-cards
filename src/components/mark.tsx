export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect width="32" height="32" rx="8" className="fill-surface-2" />
      <rect x="9" y="11" width="14" height="10" rx="2" className="stroke-foreground" strokeWidth="1.6" />
      <path d="M12 21.5V23.2C12 24.3 13.8 25 16 25s4-.7 4-1.8V21.5" className="stroke-foreground" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="22.5" cy="13.2" r="1.35" className="fill-rec" />
    </svg>
  );
}
