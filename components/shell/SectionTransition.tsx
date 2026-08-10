import type { ReactNode } from "react";

export function SectionTransition({ sectionKey, children }: { sectionKey: string; children: ReactNode }) {
  return <div key={sectionKey} className="section-enter motion-reduce:animate-none">{children}</div>;
}

