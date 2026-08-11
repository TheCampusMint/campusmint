type MintLeafIconProps = {
  className?: string;
};

/** Organic two-leaf Campus Mint mark. */
export function MintLeafIcon({ className = "" }: MintLeafIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-5 w-5 overflow-visible ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M12.2 21C12 15.8 12.8 11.5 15.5 7.4"
        strokeWidth="1.9"
      />

      <path
        d="M14.8 8.1C15.7 4.8 18.6 2.8 22 3c-.2 3.6-2.5 6.4-5.8 6.8-1.1.1-1.8-.5-1.4-1.7Z"
        strokeWidth="1.9"
      />

      <path
        d="M11.9 14.8C9.3 11.6 6.1 10.5 2.5 11.5c1 3.7 3.9 6.2 7.3 5.9 1.2-.1 1.8-1.1 2.1-2.6Z"
        strokeWidth="1.9"
      />

      <path
        d="M15.6 7.7c1.5-.8 2.9-1.5 4.5-2"
        strokeWidth="1.25"
        opacity=".75"
      />

      <path
        d="M11.5 14.6c-1.8-.7-3.5-1.1-5.5-1.2"
        strokeWidth="1.25"
        opacity=".75"
      />
    </svg>
  );
}
