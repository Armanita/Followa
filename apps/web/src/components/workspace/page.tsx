export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  icon,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-b border-workspace-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-[10px] font-semibold tracking-wide text-workspace-soft">{eyebrow}</p>}
        <div className="flex items-center gap-3">
          {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-400/20 bg-brand-400/10 text-brand-200">{icon}</span>}
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h1>
            {description && <p className="mt-1 text-xs leading-6 text-workspace-muted">{description}</p>}
          </div>
        </div>
        {meta && <div className="mt-3 text-[10px] font-medium text-workspace-soft">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </section>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-workspace-border bg-workspace-surface p-3 shadow-card">{children}</div>;
}

export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-workspace-border px-5 py-4">
      <div>
        <h2 className="text-sm font-black text-white">{title}</h2>
        {description && <p className="mt-1 text-[10px] text-workspace-soft">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');
  const sizeClass = size === 'lg' ? 'h-14 w-14 text-sm rounded-2xl' : size === 'sm' ? 'h-8 w-8 text-[9px] rounded-lg' : 'h-10 w-10 text-[10px] rounded-xl';
  return <span className={`grid shrink-0 place-items-center border border-brand-400/20 bg-brand-400/10 font-black text-brand-200 ${sizeClass}`}>{initials || 'ف'}</span>;
}

export function StatusDot({ tone = 'neutral' }: { tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  const colors = { success: 'bg-emerald-400', warning: 'bg-amber-400', danger: 'bg-red-400', info: 'bg-blue-400', neutral: 'bg-workspace-soft' };
  return <span className={`h-2 w-2 shrink-0 rounded-full ${colors[tone]}`} />;
}
