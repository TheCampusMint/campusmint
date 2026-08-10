"use client";

import { useId, useMemo, useState } from "react";

import { searchScore } from "@/lib/campus-data/normalization";

export type AutocompleteOption = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  rank?: number;
};

type Props = {
  label: string;
  placeholder: string;
  options: AutocompleteOption[];
  value?: string;
  onSelect: (option: AutocompleteOption) => void;
  onOther?: (query: string) => void;
  otherLabel?: string;
  disabled?: boolean;
};

export function SearchableAutocomplete({
  label, placeholder, options, value = "", onSelect, onOther, otherLabel = "Other / Not listed", disabled,
}: Props) {
  const id = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleOptions = useMemo(() => options
    .map((option) => ({ option, score: searchScore(query, [option.label, ...(option.keywords ?? [])]) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.option.rank ?? 0) - (b.option.rank ?? 0)
      || a.option.label.localeCompare(b.option.label))
    .slice(0, 20)
    .map(({ option }) => option), [options, query]);

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={open && visibleOptions.length
          ? `${id}-option-${Math.min(activeIndex, visibleOptions.length - 1)}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "ArrowDown") {
            event.preventDefault(); setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, Math.max(visibleOptions.length - 1, 0)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true); setActiveIndex((current) => Math.max(current - 1, 0));
          }
          const activeOption = visibleOptions[Math.min(activeIndex, visibleOptions.length - 1)];
          if (event.key === "Enter" && activeOption) {
            event.preventDefault();
            setQuery(activeOption.label); onSelect(activeOption); setOpen(false);
          }
        }}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
      />
      {open && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          <div id={`${id}-listbox`} role="listbox">
            {visibleOptions.map((option, index) => (
              <button
                key={option.id}
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { setQuery(option.label); onSelect(option); setOpen(false); }}
                className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100 ${index === activeIndex ? "bg-slate-100" : ""}`}
              >
                <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                {option.description && <span className="block text-xs text-slate-500">{option.description}</span>}
              </button>
            ))}
            {visibleOptions.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">No catalog match.</p>}
          </div>
          {onOther && query.trim() && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onOther(query); setOpen(false); }}
              className="mt-1 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {otherLabel}: “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
