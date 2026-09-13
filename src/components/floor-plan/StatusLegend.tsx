import { STATUS_META, STATUS_ORDER } from "./statusMeta";

export function StatusLegend() {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
        Estado
      </span>
      <ul className="flex flex-col gap-1.5">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status];
          return (
            <li key={status} className="flex items-center gap-2 text-[13px] text-fg-muted">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dotClass}`} />
              {meta.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
