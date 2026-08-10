import type { UniversityTheme } from "@/data/universities";

export function SettingsPanel({ theme, onClose }: { theme: UniversityTheme; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="settings-title" className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: theme.primary }}>Campus Mint</p><h2 id="settings-title" className="mt-1 text-2xl font-black text-slate-950">Settings</h2></div>
          <button type="button" onClick={onClose} aria-label="Close settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600">×</button>
        </div>
        <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
          {["Account", "Privacy", "University verification", "Notifications", "Appearance", "Blocked users"].map((item) => (
            <button key={item} type="button" className="flex w-full items-center justify-between bg-white px-4 py-4 text-left text-sm font-bold text-slate-800 hover:bg-slate-50"><span>{item}</span><span aria-hidden="true" className="text-slate-300">›</span></button>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">Settings are a development shell for now. Existing privacy controls remain available from your profile.</p>
      </section>
    </div>
  );
}
