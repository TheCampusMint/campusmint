type EventDetailsPanelProps = {
  title?: string | null;
  when?: string | null;
  where?: string | null;
  description?: string | null;
  linkedToCanonicalEvent?: boolean;
};

/** Shared Event detail treatment; future redesigns can replace this component alone. */
export function EventDetailsPanel({ title, when, where, description, linkedToCanonicalEvent }: EventDetailsPanelProps) {
  return (
    <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Event details</p>
      {title && <h3 className="mt-1 text-lg font-black">{title}</h3>}
      {when && <p className="mt-2 font-semibold"><span className="uppercase">When</span> · {when}</p>}
      {where && <p className="mt-1 font-semibold"><span className="uppercase">Where</span> · {where}</p>}
      {description && <p className="mt-2">{description}</p>}
      {linkedToCanonicalEvent && <p className="mt-2 text-xs text-slate-500">Linked to the existing Campus Mint Event record.</p>}
    </section>
  );
}
