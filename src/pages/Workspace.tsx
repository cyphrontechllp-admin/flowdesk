import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DecisionPacket } from "../components/DecisionPacket";
import { BarList, Donut, EmptyState, Legend, Panel, PriorityPill, QUEUE_COLOR, QueueDot, PageHeader } from "../components/ui";
import { isDueToday, isOpen, isOverdue, SORTS, summarize, type SortKey } from "../domain/metrics";
import { QUEUES, QUEUE_LABEL, type HandoffRequest, type Queue } from "../domain/types";
import { formatDue } from "../lib/format";
import { useDocumentTitle } from "../lib/theme";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useApp } from "../state/app";

type View = "open" | "closed" | "all";
const VIEWS: { key: View; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

export default function Workspace() {
  useDocumentTitle("Workspace");
  const { requests } = useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const wide = useMediaQuery("(min-width: 1041px)");
  const search = useRef<HTMLInputElement>(null);

  const queue = QUEUES.includes(params.get("queue") as Queue) ? (params.get("queue") as Queue) : null;
  const view: View = VIEWS.some((v) => v.key === params.get("view")) ? (params.get("view") as View) : "open";
  const sort: SortKey = (params.get("sort") as SortKey) in SORTS ? (params.get("sort") as SortKey) : "due";
  const q = params.get("q") ?? "";

  const summary = useMemo(() => summarize(requests), [requests]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return requests
      .filter((r) => (view === "all" ? true : view === "open" ? isOpen(r) : !isOpen(r)))
      .filter((r) => !queue || r.queue === queue)
      .filter((r) => !needle || `${r.id} ${r.client} ${r.title} ${r.owner} ${r.summary}`.toLowerCase().includes(needle))
      .sort(SORTS[sort].fn);
  }, [requests, view, queue, q, sort]);

  const selected = id ? requests.find((r) => r.id === id) : undefined;

  function setParam(key: string, value: string | null) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  // The search box keeps its own text and pushes to the URL after a short pause, so typing never
  // races the router. A URL change we did not make (e.g. "Clear filters") is copied back into the box.
  const [searchText, setSearchText] = useState(q);
  const pushedSearch = useRef(q);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (q !== pushedSearch.current) {
      pushedSearch.current = q;
      setSearchText(q);
    }
  }, [q]);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  function onSearchChange(value: string) {
    setSearchText(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      pushedSearch.current = value;
      setParam("q", value || null);
    }, 200);
  }

  // On wide screens the packet is always visible, so open the first row by default.
  useEffect(() => {
    if (wide && !id && visible[0]) navigate({ pathname: `/workspace/${visible[0].id}`, search: params.toString() }, { replace: true });
  }, [wide, id, visible, navigate, params]);

  // On small screens the packet replaces the list, so start it at the top.
  useEffect(() => {
    if (id && !wide) window.scrollTo(0, 0);
  }, [id, wide]);

  // "/" jumps to search, as in most queue tools.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const queueSlices = summary.byQueue.map((row) => ({ key: row.key, label: QUEUE_LABEL[row.key], count: row.count, color: QUEUE_COLOR[row.key] }));
  const showPacket = !!id;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations desk"
        title="Escalations before handoff"
        note="Track support, billing, and delivery handoffs before they miss an owner, a decision, or a customer update."
        actions={
          <Link className="button button--primary" to="/intake">
            New request
          </Link>
        }
      />

      <section className="kpis" aria-label="Desk summary">
        <div>
          <strong>{summary.open}</strong>
          <span>Open handoffs</span>
        </div>
        <div className={summary.overdue ? "is-alert" : ""}>
          <strong>{summary.overdue}</strong>
          <span>Overdue</span>
        </div>
        <div>
          <strong>{summary.dueToday}</strong>
          <span>Due today</span>
        </div>
        <div className={summary.awaitingDecision ? "is-watch" : ""}>
          <strong>{summary.awaitingDecision}</strong>
          <span>Waiting on a decision</span>
        </div>
        <div>
          <strong>{summary.closedThisWeek}</strong>
          <span>Closed this week</span>
        </div>
      </section>

      <div className="insights">
        <Panel eyebrow="Desk mix" title="Open by queue">
          <div className="mix">
            <Donut slices={queueSlices} total={summary.open} label="Open handoffs by queue" />
            <Legend items={queueSlices} />
          </div>
        </Panel>
        <Panel eyebrow="Attention" title="Priority pressure">
          <BarList rows={summary.byPriority.map((r) => ({ key: r.key, label: r.key, count: r.count, color: r.key === "High" ? "var(--c-risk)" : r.key === "Medium" ? "var(--c-approval)" : "var(--c-support)" }))} />
        </Panel>
        <Panel eyebrow="Ownership" title="Open by owner">
          {summary.byOwner.length ? <BarList rows={summary.byOwner.slice(0, 4).map((r) => ({ key: r.owner, label: r.owner, count: r.count }))} /> : <p className="muted">No open handoffs.</p>}
        </Panel>
      </div>

      <div className={`work${showPacket ? " has-selection" : ""}`}>
        <section className="ledger" aria-labelledby="ledger-title">
          <div className="ledger__head">
            <div>
              <p className="eyebrow">Work queue</p>
              <h2 id="ledger-title">Handoff ledger</h2>
            </div>
            <span className="muted" aria-live="polite">
              {visible.length} shown
            </span>
          </div>

          <div className="toolbar">
            <label className="search">
              <span className="sr-only">Search handoffs</span>
              <input ref={search} type="search" value={searchText} placeholder="Search client, title, owner  ( / )" onChange={(event) => onSearchChange(event.target.value)} />
            </label>
            <label className="select-inline">
              <span className="sr-only">Sort by</span>
              <select value={sort} onChange={(event) => setParam("sort", event.target.value === "due" ? null : event.target.value)}>
                {Object.entries(SORTS).map(([key, s]) => (
                  <option key={key} value={key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="tabs" role="group" aria-label="Filter by queue">
            <button type="button" aria-pressed={!queue} onClick={() => setParam("queue", null)}>
              All
            </button>
            {QUEUES.map((key) => (
              <button key={key} type="button" aria-pressed={queue === key} onClick={() => setParam("queue", key)}>
                {QUEUE_LABEL[key]}
              </button>
            ))}
          </div>
          <div className="tabs tabs--sub" role="group" aria-label="Filter by state">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => setParam("view", v.key === "open" ? null : v.key)}>
                {v.label}
              </button>
            ))}
          </div>

          {visible.length ? (
            <ul className="rows">
              {visible.map((r) => (
                <Row key={r.id} request={r} selected={r.id === id} search={params.toString()} />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No handoffs match"
              action={
                q || queue || view !== "open" ? (
                  <button className="button button--secondary" type="button" onClick={() => setParams({}, { replace: true })}>
                    Clear filters
                  </button>
                ) : (
                  <Link className="button button--secondary" to="/intake">
                    Log a request
                  </Link>
                )
              }
            >
              {q || queue || view !== "open" ? "Try a different search or filter." : "Every handoff is closed. Nice work."}
            </EmptyState>
          )}
        </section>

        <aside className="rail" aria-label="Decision packet">
          <Link className="back-link" to={{ pathname: "/workspace", search: params.toString() }}>
            ← Back to queue
          </Link>
          {selected ? (
            <DecisionPacket key={selected.id} request={selected} />
          ) : (
            <EmptyState title={id ? `${id} was not found` : "Select a queue item"}>
              {id ? "It may have been removed. Pick another handoff from the queue." : "Review the customer context, ownership call, and next handoff."}
            </EmptyState>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ request, selected, search }: { request: HandoffRequest; selected: boolean; search: string }) {
  const now = Date.now();
  const late = isOverdue(request, now);
  return (
    <li>
      <Link className={`row${selected ? " is-selected" : ""}`} to={{ pathname: `/workspace/${request.id}`, search }} aria-current={selected ? "true" : undefined}>
        <div className="row__main">
          <span className="row__id">
            {request.id} · {request.client}
          </span>
          <strong>{request.title}</strong>
          <small>{request.summary}</small>
        </div>
        <div className="row__meta">
          <PriorityPill priority={request.priority} />
          <span>{request.owner}</span>
          <span className={late ? "is-late" : isDueToday(request, now) ? "is-soon" : ""}>{formatDue(request.dueAt, isOpen(request), now)}</span>
        </div>
        <div className="row__state">
          <QueueDot queue={request.queue} />
          {QUEUE_LABEL[request.queue]} · {request.status}
        </div>
      </Link>
    </li>
  );
}
