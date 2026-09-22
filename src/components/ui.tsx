import type { ReactNode } from "react";
import { QUEUE_LABEL, type Priority, type Queue } from "../domain/types";

export const QUEUE_COLOR: Record<Queue, string> = {
  risk: "var(--c-risk)",
  approval: "var(--c-approval)",
  billing: "var(--c-billing)",
  support: "var(--c-support)",
};

export function PriorityPill({ priority }: { priority: Priority }) {
  return <span className={`pill pill--${priority.toLowerCase()}`}>{priority}</span>;
}

export function QueueDot({ queue }: { queue: Queue }) {
  return <span className="dot" style={{ background: QUEUE_COLOR[queue] }} aria-hidden="true" />;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

export function PageHeader({ eyebrow, title, note, actions }: { eyebrow: string; title: string; note?: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {note ? <p className="page-head__note">{note}</p> : null}
      </div>
      {actions ? <div className="page-head__actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({ eyebrow, title, children, className = "" }: { eyebrow?: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel__head">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function Donut({ slices, label, total }: { slices: { key: string; label: string; count: number; color: string }[]; label: string; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const summary = slices.map((s) => `${s.label} ${s.count}`).join(", ");
  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${label}: ${summary}`}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--line)" strokeWidth="12" />
        {total > 0 &&
          slices
            .filter((s) => s.count > 0)
            .map((s) => {
              const length = (s.count / total) * circumference;
              const circle = (
                <circle
                  key={s.key}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="12"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                />
              );
              offset += length;
              return circle;
            })}
      </svg>
      <div className="donut__center" aria-hidden="true">
        <strong>{total}</strong>
        <span>open</span>
      </div>
    </div>
  );
}

export function BarList({ rows, max }: { rows: { key: string; label: string; count: number; color?: string }[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="bars">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="bars__label">
            <span>{row.label}</span>
            <strong>{row.count}</strong>
          </div>
          <div className="bars__track" aria-hidden="true">
            <span style={{ width: `${(row.count / top) * 100}%`, background: row.color ?? "var(--accent)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Legend({ items }: { items: { key: string; label: string; count: number; color: string }[] }) {
  return (
    <ul className="legend">
      {items.map((item) => (
        <li key={item.key}>
          <i style={{ background: item.color }} aria-hidden="true" />
          {item.label} <strong>{item.count}</strong>
        </li>
      ))}
    </ul>
  );
}

export { QUEUE_LABEL };
