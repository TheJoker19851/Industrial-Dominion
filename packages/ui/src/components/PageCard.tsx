import type { PropsWithChildren } from 'react';

export function PageCard({ children }: PropsWithChildren) {
  return (
    <div className="rounded-2xl border border-slate-800 p-4">{children}</div>
  );
}
