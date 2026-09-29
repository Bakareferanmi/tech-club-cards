type IconProps = { className?: string };

export function CodeBracketsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 46 36" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 4 L3 18 L16 32"
        stroke="currentColor"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28.5 3 L17.5 33"
        stroke="currentColor"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path
        d="M30 4 L43 18 L30 32"
        stroke="currentColor"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UserFieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 18.4c.7-3 3.3-4.6 6.5-4.6s5.8 1.6 6.5 4.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IdFieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 10h4.2M7.5 13.2h6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="14.2" y="8.8" width="3.4" height="2.6" rx="0.4" fill="currentColor" />
    </svg>
  );
}

export function PeopleFieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="8.2" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.4 17.8c.5-2.4 2.5-3.7 4.6-3.7 2.1 0 4.1 1.3 4.6 3.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="16.2" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M15 14.4c2 .2 3.6 1.3 4.2 3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CalendarFieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4.2" y="5.5" width="15.6" height="13.2" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.2 9.4h15.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.2 4.2v2.8M15.8 4.2v2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 16h.01M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function PhoneScanIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="7.2" y="3.2" width="9.6" height="17.6" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11 18.4h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
