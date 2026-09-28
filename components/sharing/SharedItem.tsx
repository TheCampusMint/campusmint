import type { ReactNode } from "react";
export function SharedItem({children}:{children:ReactNode}) {
  return <main className="min-h-dvh bg-[var(--app-background)] px-4 py-8 text-[var(--app-text-primary)]"><article className="mx-auto max-w-xl space-y-5 rounded-3xl bg-[var(--app-surface)] p-5 sm:p-7">{children}</article></main>;
}
