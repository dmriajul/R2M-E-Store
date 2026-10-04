/** Card-network marks as inline SVG (no brand icons ship with lucide v1). */

export function VisaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 16" aria-label="Visa" role="img" className={className}>
      <path
        fill="#1A1F71"
        d="M19.6 15.2h-4.3L18 1.1h4.3l-2.7 14.1ZM11.4 1.1 7.3 10.8 6.8 8.4 5.4 1.9C5.4 1.9 5.2 1.1 4.2 1.1H0l.06.28c1.06.23 2.27.6 3.32 1.05 1.28.55 1.63 1.28 1.63 1.28l3.9 11.5h4.5l6.9-14.1h-4.5Z"
      />
      <path
        fill="#1A1F71"
        d="M44.6 15.2H48l-3-14.1h-2.9c-1.35 0-1.68 1.04-1.68 1.04l-5.5 13.06h4.6l.92-2.53h5.6l.52 2.53Zm-4.86-5.34 2.3-6.36 1.3 6.36h-3.6ZM28.7 4.6l.63-3.5S27.9.8 26.4.8c-1.6 0-4.2.7-4.2 3.2 0 2.5 3.5 2.53 3.5 3.85 0 0-.1 1.15-2.1 1.15-1.9 0-3-.6-3-.6l-.63 3.6s1 1.2 4 1.2c2.3 0 5-1.2 5-3.9 0-2.5-3.6-2.7-3.6-3.85 0 0 .1-1 1.9-1 1.5 0 2.4.55 2.4.55Z"
      />
    </svg>
  );
}

export function MastercardMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 16" aria-label="Mastercard" role="img" className={className}>
      <circle cx="15" cy="8" r="7.4" fill="#EB001B" />
      <circle cx="27" cy="8" r="7.4" fill="#F79E1B" />
      <path
        fill="#FF5F00"
        d="M21 2.5a7.4 7.4 0 0 0 0 11 7.4 7.4 0 0 0 0-11Z"
      />
    </svg>
  );
}
