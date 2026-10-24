export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? 'brand-mark'}
      viewBox="0 0 42 42"
      fill="none"
      aria-hidden
    >
      <path
        d="M21 3.5 36.5 12.4v17.2L21 38.5 5.5 29.6V12.4L21 3.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M5.5 12.4 21 21.2l15.5-8.8M21 21.2v17.3"
        stroke="currentColor"
        strokeOpacity=".42"
        strokeWidth="1.1"
      />
      <path
        d="M10.5 27.5 31.8 14.3"
        stroke="#ffb15e"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="31.8" cy="14.3" r="2.1" fill="#ffb15e" />
      <circle cx="10.5" cy="27.5" r="2.1" fill="#8de6c2" />
    </svg>
  );
}
