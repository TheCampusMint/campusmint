type MintLeafIconProps = {
  className?: string;
};

/** Small CSS-drawn brand mark that stays crisp without an icon dependency. */
export function MintLeafIcon({ className = "" }: MintLeafIconProps) {
  return (
    <span aria-hidden="true" className={`relative block h-5 w-5 ${className}`}>
      <span className="absolute left-[4px] top-[1px] h-[13px] w-[9px] -rotate-[38deg] rounded-[80%_20%_80%_20%] border-2 border-current" />
      <span className="absolute bottom-[1px] left-[10px] h-[10px] w-0.5 rotate-[35deg] rounded-full bg-current" />
    </span>
  );
}
