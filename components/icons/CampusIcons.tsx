import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true };

export function SearchIcon(props: IconProps) { return <svg {...base} {...props}><circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.2 4.2"/></svg>; }
export function FoodIcon(props: IconProps) { return <svg {...base} {...props}><path d="M7 3v7M4.5 3v4.5A2.5 2.5 0 0 0 7 10v11M9.5 3v4.5A2.5 2.5 0 0 1 7 10M16.5 3c2 2.3 2.3 6.1.5 8.5l-1.3 1.7V21M16.5 3v10.2"/></svg>; }
export function CalendarIcon(props: IconProps) { return <svg {...base} {...props}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>; }
export function SellIcon(props: IconProps) { return <svg {...base} {...props}><path d="M3 11.2V5a2 2 0 0 1 2-2h6.2a2 2 0 0 1 1.4.6l7.8 7.8a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0l-7.8-7.8A2 2 0 0 1 3 11.2Z"/><circle cx="8" cy="8" r="1"/></svg>; }
export function PinIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) { return <svg {...base} fill={filled ? "currentColor" : "none"} {...props}><path d="m8 3 8 0-1.4 6 3.4 3H6l3.4-3L8 3Z"/><path d="M12 12v9"/></svg>; }
export function BellIcon(props: IconProps) { return <svg {...base} {...props}><path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3V9Z"/><path d="M9.8 19a2.5 2.5 0 0 0 4.4 0"/></svg>; }
export function MessageIcon(props: IconProps) { return <svg {...base} {...props}><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2.2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v8Z"/></svg>; }
export function ClockIcon(props: IconProps) { return <svg {...base} {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>; }
export function LocationIcon(props: IconProps) { return <svg {...base} {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>; }
