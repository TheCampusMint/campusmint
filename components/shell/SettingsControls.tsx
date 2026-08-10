import type { ReactNode } from "react";

type ToggleRowProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-slate-200 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[var(--app-accent)] peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--app-accent)]" />
    </label>
  );
}

type SelectRowProps = {
  label: string;
  value: string;
  children: ReactNode;
  onChange: (value: string) => void;
};

export function SelectRow({ label, value, children, onChange }: SelectRowProps) {
  return (
    <label className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-bold text-slate-900">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="max-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]">
        {children}
      </select>
    </label>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="max-w-[62%] text-right font-bold text-slate-900">{value}</span>
    </div>
  );
}
