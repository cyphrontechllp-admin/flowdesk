import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BarList, Legend, PageHeader, Panel, QUEUE_COLOR } from "../components/ui";
import { downloadCsv, requestsToCsv } from "../domain/csv";
import { summarize, throughput } from "../domain/metrics";
import { QUEUE_LABEL } from "../domain/types";
import { shortDay, timeAgo } from "../lib/format";
import { useDocumentTitle } from "../lib/theme";
import { useApp } from "../state/app";

export default function Reports() {
  useDocumentTitle("Reports");
  const { requests } = useApp();
  const summary = useMemo(() => summarize(requests), [requests]);
  const days = useMemo(() => throughput(requests), [requests]);
  const peak = Math.max(1, ...days.flatMap((d) => [d.created, d.closed]));

  const recent = useMemo(
    () =>
      requests
        .flatMap((r) => r.history.map((h) => ({ ...h, request: r })))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 8),
    [requests],
  );

  const queueRows = summary.byQueue.map((r) => ({ key: r.key, label: QUEUE_LABEL[r.key], count: r.count, color: QUEUE_COLOR[r.key] }));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Desk review"
        title="Where work is getting stuck"
        note="A practical read on which handoffs are waiting on people, payments, approvals, or client access."
        actions={
          <button className="button button--secondary" type="button" onClick={() => downloadCsv("flowdesk-handoffs.csv", requestsToCsv(requests))}>
            Download CSV
          </button>
        }
      />

      <section className="kpis" aria-label="Report metrics">
        <div>
          <strong>{summary.open}</strong>
          <span>Open handoffs</span>
        </div>
        <div className={summary.overdue ? "is-alert" : ""}>
          <strong>{summary.overdue}</strong>
          <span>Overdue</span>
        </div>
        <div className={summary.awaitingDecision ? "is-watch" : ""}>
          <strong>{summary.awaitingDecision}</strong>
          <span>Decision holds</span>
        </div>
        <div>
          <strong>{summary.closedThisWeek}</strong>
          <span>Closed this week</span>
        </div>
      </section>

      <div className="grid-2">
        <Panel eyebrow="Trend" title="Opened vs closed, last 7 days">
          <div className="trend" role="img" aria-label={`Opened and closed per day: ${days.map((d) => `${shortDay(d.date)} ${d.created} opened ${d.closed} closed`).join("; ")}`}>
            {days.map((d) => (
              <div key={d.date.toISOString()} className="trend__day">
                <div className="trend__bars">
                  <span className="trend__bar trend__bar--open" style={{ height: `${(d.created / peak) * 100}%` }} />
                  <span className="trend__bar trend__bar--closed" style={{ height: `${(d.closed / peak) * 100}%` }} />
                </div>
                <small>{shortDay(d.date)}</small>
              </div>
            ))}
          </div>
          <Legend
            items={[
              { key: "o", label: "Opened", count: days.reduce((n, d) => n + d.created, 0), color: "var(--c-approval)" },
              { key: "c", label: "Closed", count: days.reduce((n, d) => n + d.closed, 0), color: "var(--c-support)" },
            ]}
          />
        </Panel>

        <Panel eyebrow="Load map" title="What is blocking handoff">
          <BarList rows={queueRows} />
        </Panel>

        <Panel eyebrow="Owner load" title="Open handoffs by owner">
          {summary.byOwner.length ? <BarList rows={summary.byOwner.map((r) => ({ key: r.owner, label: r.owner, count: r.count }))} /> : <p className="muted">No open handoffs.</p>}
        </Panel>

        <Panel eyebrow="Handoff states" title="Current status mix">
          <BarList rows={summary.byStatus.map((r) => ({ key: r.status, label: r.status, count: r.count, color: r.status === "Resolved" ? "var(--c-support)" : "var(--accent)" }))} />
        </Panel>
      </div>

      <Panel eyebrow="Desk trail" title="Recent movement">
        <ul className="feed">
          {recent.map((item) => (
            <li key={item.id}>
              <Link to={`/workspace/${item.request.id}?view=all`}>
                <strong>
                  {item.request.id} · {item.request.client}
                </strong>
                <span>{item.text}</span>
              </Link>
              <small>
                {item.actor} · {timeAgo(item.at)}
              </small>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
