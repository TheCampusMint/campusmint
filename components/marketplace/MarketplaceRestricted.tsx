import { getUserRoleLabel } from "@/data/userRoles";
import type { UniversityTheme } from "@/data/universities";
import type { TemporaryUser } from "@/types/user";

export function MarketplaceRestricted({ user, theme }: { user: TemporaryUser; theme: UniversityTheme }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="p-8 text-center sm:p-12" style={{ backgroundColor: theme.accent }}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm" aria-hidden="true">🔒</div>
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>Student community only</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-950">Marketplace access is restricted</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">Only verified students from this university community may browse inventory, buy, sell, make offers, save listings, or message sellers.</p>
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white bg-white/80 p-4 text-sm text-slate-600">
          Current development role: <strong className="text-slate-900">{getUserRoleLabel(user.role)}</strong>
          <p className="mt-2 text-xs leading-5 text-slate-500">During development, select the Student role to test Marketplace. Production access will require verified-student identity.</p>
        </div>
      </div>
    </section>
  );
}
