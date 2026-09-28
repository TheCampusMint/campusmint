"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SelectorOption = { id: string; label: string; detail?: string };

export function SearchableSelector({ label, value, options, onChange, placeholder, loading = false }: {
  label: string; value: string; options: SelectorOption[]; onChange: (value: string) => void;
  placeholder?: string; loading?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) resultsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open, query]);
  const selected = options.find((option) => option.id === value);
  const matches = options.filter((option) => `${option.label} ${option.detail ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 30);
  function choose(next: string) { onChange(next); setOpen(false); setQuery(""); }
  return <div className="relative min-w-0" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id} className="mb-1 block text-xs font-semibold text-[var(--app-text-secondary)]">{label}</label>
    <div className="flex items-center gap-2 rounded-2xl bg-[var(--app-surface-elevated)] px-3">
      <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`}
        aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
        value={open ? query : selected?.label ?? ""} placeholder={placeholder ?? `Search ${label.toLocaleLowerCase()}`}
        className="cm-composer-field min-w-0 flex-1 bg-transparent py-3 text-base outline-none sm:text-sm"
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setActive((index) => Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
          }
          if (event.key === "Enter" && open) { event.preventDefault(); if (matches[active]) choose(matches[active].id); }
        }} />
      {value && <button type="button" aria-label={`Remove ${label.toLocaleLowerCase()}`} className="rounded-full px-1 py-2 text-lg text-[var(--app-text-secondary)]" onClick={() => choose("")}>×</button>}
    </div>
    {open && <div ref={resultsRef} className="mt-1 max-h-44 overflow-y-auto rounded-2xl bg-[var(--app-surface-elevated)] p-1">
      <ul id={`${id}-options`} role="listbox" aria-label={label}>
        {matches.map((option, index) => <li id={`${id}-${index}`} key={option.id} role="option" aria-selected={value === option.id} data-active={active === index}
          className={`cursor-pointer rounded-xl px-3 py-2 text-sm ${active === index ? "bg-[var(--app-accent-soft)]" : ""}`}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option.id)}>
          <span className="block font-semibold">{option.label}</span>
          {option.detail && <span className="block text-xs text-[var(--app-text-secondary)]">{option.detail}</span>}
        </li>)}
      </ul>
      {matches.length === 0 && <p role="status" className="px-3 py-2 text-xs text-[var(--app-text-secondary)]">{loading ? "Loading…" : "No matches"}</p>}
    </div>}
  </div>;
}
